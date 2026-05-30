"""PostgreSQL client database.
Requires DATABASE_URL env var (auto-set by Railway Postgres plugin).
If DATABASE_URL is missing the module degrades gracefully — all functions
become no-ops so the rest of the app keeps working without a DB.
"""
from __future__ import annotations
import os
import logging

# Try DATABASE_URL first; if broken, build from individual PG* vars
DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL or "RAILWAY_PRIVATE_DOMAIN" in DATABASE_URL or "{{" in DATABASE_URL:
    _u  = os.getenv("PGUSER", "")
    _p  = os.getenv("PGPASSWORD", "") or os.getenv("POSTGRES_PASSWORD", "")
    _h  = os.getenv("PGHOST", "")
    _pt = os.getenv("PGPORT", "5432")
    _d  = os.getenv("PGDATABASE", "")
    if _u and _p and _h and _d:
        DATABASE_URL = f"postgresql://{_u}:{_p}@{_h}:{_pt}/{_d}"
        print(f"[db] Built DATABASE_URL from PG vars: host={_h}")
    else:
        print(f"[db] PG vars incomplete: user={bool(_u)} pass={bool(_p)} host={bool(_h)} db={bool(_d)}")

_pg_ok = False
_conn_cache = None  # persistent connection, reused across requests

if DATABASE_URL:
    try:
        import psycopg2
        import psycopg2.extras
        _pg_ok = True
    except ImportError:
        logging.warning("[db] psycopg2 not installed — client DB disabled")
else:
    logging.warning("[db] DATABASE_URL not set — client DB disabled")


def _conn():
    """Return a persistent connection; reconnect automatically if closed."""
    global _conn_cache
    if not _pg_ok:
        return None
    try:
        if _conn_cache is None or _conn_cache.closed:
            _conn_cache = psycopg2.connect(DATABASE_URL)
            print("[db] PostgreSQL connected ✓")
        else:
            # Test if connection is still alive
            _conn_cache.cursor().execute("SELECT 1")
        return _conn_cache
    except Exception:
        # Stale connection — reconnect
        try:
            _conn_cache = psycopg2.connect(DATABASE_URL)
            print("[db] PostgreSQL reconnected ✓")
            return _conn_cache
        except Exception as e:
            logging.error(f"[db] reconnect failed: {e}")
            _conn_cache = None
            return None


def init_db():
    """Create tables if they don't exist."""
    if not _pg_ok:
        return
    conn = _conn()
    if conn is None:
        return
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS clients (
                    user_id        BIGINT PRIMARY KEY,
                    name           TEXT    NOT NULL DEFAULT '',
                    phone          TEXT    NOT NULL DEFAULT '',
                    address        TEXT    NOT NULL DEFAULT '',
                    first_order_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    last_order_at  TIMESTAMP NOT NULL DEFAULT NOW(),
                    total_orders   INT   NOT NULL DEFAULT 1,
                    total_spent    FLOAT NOT NULL DEFAULT 0
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS reviews (
                    id         SERIAL PRIMARY KEY,
                    user_id    BIGINT NOT NULL,
                    name       TEXT   NOT NULL DEFAULT '',
                    text       TEXT   NOT NULL,
                    rating     INTEGER NOT NULL DEFAULT 5,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS partners (
                    user_id  BIGINT PRIMARY KEY,
                    added_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS images (
                    id         SERIAL PRIMARY KEY,
                    key        TEXT,
                    mime       TEXT NOT NULL DEFAULT 'image/jpeg',
                    data       BYTEA NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS images_key_uidx ON images(key) WHERE key IS NOT NULL")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS expenses (
                    id         SERIAL PRIMARY KEY,
                    name       TEXT NOT NULL,
                    amount     NUMERIC(12,2) NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
        conn.commit()
        print("[db] init_db OK")
    except Exception as e:
        logging.error(f"[db] init_db error: {e}")
        conn.rollback()


def upsert_client(user_id: int, name: str, phone: str, address: str, spent: float):
    """Save or update a client after a purchase."""
    if not _pg_ok or not user_id:
        return
    conn = _conn()
    if conn is None:
        return
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO clients (user_id, name, phone, address, total_orders, total_spent)
                VALUES (%s, %s, %s, %s, 1, %s)
                ON CONFLICT (user_id) DO UPDATE SET
                    name          = EXCLUDED.name,
                    phone         = EXCLUDED.phone,
                    address       = EXCLUDED.address,
                    last_order_at = NOW(),
                    total_orders  = clients.total_orders + 1,
                    total_spent   = clients.total_spent + EXCLUDED.total_spent
            """, (user_id, name, phone, address, spent))
        conn.commit()
        print(f"[db] upsert_client user_id={user_id}")
    except Exception as e:
        logging.error(f"[db] upsert_client error: {e}")
        conn.rollback()


def get_clients() -> list[dict]:
    """Return all clients ordered by last purchase."""
    if not _pg_ok:
        return []
    conn = _conn()
    if conn is None:
        return []
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    user_id, name, phone, address,
                    TO_CHAR(first_order_at, 'YYYY-MM-DD') AS first_order,
                    TO_CHAR(last_order_at,  'YYYY-MM-DD') AS last_order,
                    total_orders, total_spent
                FROM clients
                ORDER BY last_order_at DESC
            """)
            return [dict(r) for r in cur.fetchall()]
    except Exception as e:
        logging.error(f"[db] get_clients error: {e}")
        return []


def add_review(user_id: int, name: str, text: str, rating: int = 5):
    """Save a client review."""
    if not _pg_ok or not user_id:
        return
    conn = _conn()
    if conn is None:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO reviews (user_id, name, text, rating) VALUES (%s, %s, %s, %s)",
                (user_id, name or '', text, max(1, min(5, rating)))
            )
        conn.commit()
        print(f"[db] add_review user_id={user_id}")
    except Exception as e:
        logging.error(f"[db] add_review error: {e}")
        conn.rollback()


def get_reviews() -> list[dict]:
    """Return all reviews newest first."""
    if not _pg_ok:
        return []
    conn = _conn()
    if conn is None:
        return []
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, user_id, name, text, rating,
                       TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
                FROM reviews
                ORDER BY created_at DESC
            """)
            return [dict(r) for r in cur.fetchall()]
    except Exception as e:
        logging.error(f"[db] get_reviews error: {e}")
        return []


def add_partner(user_id: int):
    """Persist a partner user_id (idempotent)."""
    if not _pg_ok or not user_id:
        return
    conn = _conn()
    if conn is None:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO partners (user_id) VALUES (%s) ON CONFLICT (user_id) DO NOTHING",
                (user_id,),
            )
        conn.commit()
        print(f"[db] add_partner user_id={user_id}")
    except Exception as e:
        logging.error(f"[db] add_partner error: {e}")
        conn.rollback()


def get_partner_ids() -> set:
    """Return set of all partner user_ids."""
    if not _pg_ok:
        return set()
    conn = _conn()
    if conn is None:
        return set()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id FROM partners")
            return {r[0] for r in cur.fetchall()}
    except Exception as e:
        logging.error(f"[db] get_partner_ids error: {e}")
        return set()


def save_image(data: bytes, mime: str = "image/jpeg") -> int | None:
    """Store an image, return its numeric id."""
    if not _pg_ok or not data:
        return None
    conn = _conn()
    if conn is None:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO images (mime, data) VALUES (%s, %s) RETURNING id",
                (mime, psycopg2.Binary(data)),
            )
            new_id = cur.fetchone()[0]
        conn.commit()
        print(f"[db] save_image id={new_id} ({len(data)} bytes)")
        return new_id
    except Exception as e:
        logging.error(f"[db] save_image error: {e}")
        conn.rollback()
        return None


def save_named_image(key: str, data: bytes, mime: str = "image/png") -> bool:
    """Store/replace an image under a named key (e.g. 'logo')."""
    if not _pg_ok or not data or not key:
        return False
    conn = _conn()
    if conn is None:
        return False
    try:
        with conn.cursor() as cur:
            # DELETE+INSERT avoids ON CONFLICT mismatch with the partial unique index
            cur.execute("DELETE FROM images WHERE key = %s", (key,))
            cur.execute(
                "INSERT INTO images (key, mime, data) VALUES (%s, %s, %s)",
                (key, mime, psycopg2.Binary(data)),
            )
        conn.commit()
        print(f"[db] save_named_image key={key} ({len(data)} bytes)")
        return True
    except Exception as e:
        logging.error(f"[db] save_named_image error: {e}")
        conn.rollback()
        return False


def get_image(image_id: int):
    """Return (bytes, mime) for a numeric image id, or None."""
    if not _pg_ok:
        return None
    conn = _conn()
    if conn is None:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT data, mime FROM images WHERE id = %s", (image_id,))
            row = cur.fetchone()
            if not row:
                return None
            return bytes(row[0]), row[1]
    except Exception as e:
        logging.error(f"[db] get_image error: {e}")
        return None


def get_named_image(key: str):
    """Return (bytes, mime) for a named image key, or None."""
    if not _pg_ok:
        return None
    conn = _conn()
    if conn is None:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT data, mime FROM images WHERE key = %s", (key,))
            row = cur.fetchone()
            if not row:
                return None
            return bytes(row[0]), row[1]
    except Exception as e:
        logging.error(f"[db] get_named_image error: {e}")
        return None


def add_expense(name: str, amount: float) -> int | None:
    if not _pg_ok or not name.strip():
        return None
    conn = _conn()
    if conn is None:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO expenses (name, amount) VALUES (%s, %s) RETURNING id",
                (name.strip(), amount),
            )
            new_id = cur.fetchone()[0]
        conn.commit()
        return new_id
    except Exception as e:
        logging.error(f"[db] add_expense error: {e}")
        conn.rollback()
        return None


def get_expenses() -> list[dict]:
    if not _pg_ok:
        return []
    conn = _conn()
    if conn is None:
        return []
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, name, amount::float AS amount,
                       TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
                FROM expenses
                ORDER BY created_at DESC
            """)
            return [dict(r) for r in cur.fetchall()]
    except Exception as e:
        logging.error(f"[db] get_expenses error: {e}")
        return []


def delete_expense(expense_id: int) -> bool:
    if not _pg_ok:
        return False
    conn = _conn()
    if conn is None:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM expenses WHERE id = %s", (expense_id,))
        conn.commit()
        return True
    except Exception as e:
        logging.error(f"[db] delete_expense error: {e}")
        conn.rollback()
        return False


def get_client_user_ids() -> list[int]:
    """Return list of all client user_ids for broadcast."""
    if not _pg_ok:
        return []
    conn = _conn()
    if conn is None:
        return []
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id FROM clients")
            return [r[0] for r in cur.fetchall()]
    except Exception as e:
        logging.error(f"[db] get_client_user_ids error: {e}")
        return []
