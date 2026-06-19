from __future__ import annotations
import os
import json
import time
import uuid
import gspread
from datetime import datetime
from google.oauth2.service_account import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

SPREADSHEET_ID = os.getenv("SPREADSHEET_ID", "1RoLKPZQY675Bv16GoMZDW7Sv_s77s0lKu-s2mVj3qA8")
PRODUCTS_SHEET = "Товары SOOQ"
ORDERS_SHEET   = "Orders"

# ─────────────────────────────────────────────────────────────
# Connection cache — create ONCE, reuse forever.
# google.oauth2 Credentials auto-refresh the access token.
# ─────────────────────────────────────────────────────────────
_gc = None   # gspread.Client
_ss = None   # Spreadsheet


def _load_info():
    creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
    if creds_json:
        return json.loads(creds_json)
    with open("sooq-496809-a864eade54d5.json") as f:
        return json.load(f)


def ensure_connected():
    """Connect once, reuse on all subsequent calls."""
    global _gc, _ss
    if _gc is not None and _ss is not None:
        return _gc, _ss
    info  = _load_info()
    creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    _gc   = gspread.authorize(creds)
    _ss   = _gc.open_by_key(SPREADSHEET_ID)
    print("[sheets] Connected to Google Sheets ✓")
    return _gc, _ss


def _get_sheet(name: str):
    """Return worksheet by name; reset cache and retry once on error."""
    global _gc, _ss
    for attempt in range(2):
        try:
            _, ss = ensure_connected()
            return ss.worksheet(name)
        except gspread.WorksheetNotFound:
            return None
        except Exception as e:
            print(f"[sheets] _get_sheet('{name}') attempt {attempt} failed: {e}")
            _gc = None
            _ss = None  # force reconnect on next attempt
    return None


ORDERS_HEADER = [
    "id", "user_id", "name", "phone", "address",
    "product_id", "product_name", "quantity", "price",
    "timestamp", "status", "express", "article",
]


def _ensure_orders_sheet():
    """Return Orders worksheet; create it with headers if missing.
    Also migrates legacy sheets by appending any missing trailing columns."""
    ws = _get_sheet(ORDERS_SHEET)
    if ws is None:
        _, ss = ensure_connected()
        ws = ss.add_worksheet(title=ORDERS_SHEET, rows=1000, cols=len(ORDERS_HEADER))
        ws.append_row(ORDERS_HEADER)
        return ws

    # Migration: ensure all expected columns exist in the header row
    try:
        current = ws.row_values(1)
        missing = [h for h in ORDERS_HEADER if h not in current]
        if missing:
            new_header = current + missing
            ws.update("A1", [new_header])
            print(f"[sheets] Orders header migrated: added {missing}")
    except Exception as e:
        print(f"[sheets] header migration skipped: {e}")
    return ws


# ─────────────────────────────────────────────────────────────
# Products — with 60-second in-memory cache
# ─────────────────────────────────────────────────────────────
_products_cache: list | None = None
_products_cache_ts: float    = 0.0
CACHE_TTL: int               = 60  # seconds


def get_products():
    global _products_cache, _products_cache_ts
    now = time.time()
    if _products_cache is not None and (now - _products_cache_ts) < CACHE_TTL:
        print(f"[sheets] get_products: cache hit ({len(_products_cache)} items)")
        return _products_cache
    try:
        ws = _get_sheet(PRODUCTS_SHEET)
        if not ws:
            print("[sheets] get_products: worksheet not found")
            return _products_cache or []
        rows = ws.get_all_records()
        products = []
        for i, row in enumerate(rows):
            if not any(str(v).strip() for v in row.values()):
                continue
            row["_index"] = i
            products.append(row)
        print(f"[sheets] get_products: {len(products)} items (fetched from Sheets)")
        _products_cache    = products
        _products_cache_ts = now
        return products
    except Exception as e:
        print(f"[sheets] get_products error: {e}")
        return _products_cache or []


def _invalidate_products():
    global _products_cache
    _products_cache = None


def _col_letter(idx0: int) -> str:
    """0-based column index → A1 letter (0→A, 26→AA)."""
    s = ""
    n = idx0
    while True:
        s = chr(ord("A") + n % 26) + s
        n = n // 26 - 1
        if n < 0:
            break
    return s


def _find_col(header: list, *names) -> int:
    """Return 0-based index of the first header matching any given name."""
    low = [str(h).strip().lower() for h in header]
    for name in names:
        target = name.strip().lower()
        if target in low:
            return low.index(target)
    return -1


_COLS = {
    "name":      ("Название (RU)", "Название", "name", "col2"),
    "category":  ("Категория", "category", "col3"),
    "photo":     ("Фото 1", "Фото (URL)", "Фото", "photo_url"),
    "price":     ("Продажная цена", "Цена", "price", "col6"),
    "qty":       ("В наличии (шт)", "В наличии", "qty", "col9"),
    "cost_yuan": ("Себестоимость ¥", "Себест. ¥", "cost_yuan"),
    "cost_tjs":  ("Себестоимость сомони", "Себестоимость", "cost_tjs"),
    "price_disc":("Цена со скидкой", "price_disc"),
    "article":   ("Артикул", "article", "ORM"),
}


def add_product(name, category, photo_url, price, qty, cost=None):
    """Append a new product row, placing values in the correct columns by header name."""
    _invalidate_products()
    ws = _get_sheet(PRODUCTS_SHEET)
    if not ws:
        return None
    header = ws.row_values(1)
    product_id = str(uuid.uuid4())[:8].upper()
    row = [""] * max(len(header), 6)

    def setcol(value, key):
        idx = _find_col(header, *_COLS[key])
        if 0 <= idx < len(row):
            row[idx] = value

    id_idx = _find_col(header, "ID", "id")
    if 0 <= id_idx < len(row):
        row[id_idx] = product_id
    setcol(name, "name")
    setcol(category, "category")
    if photo_url:
        setcol(photo_url, "photo")
    setcol(str(price), "price")
    setcol(str(price), "price_disc")  # keep "Цена со скидкой" in sync (что показывает апп)
    setcol(str(qty), "qty")
    if cost is not None:
        setcol(str(cost), "cost_tjs")
    status_idx = _find_col(header, "Статус", "status")
    if 0 <= status_idx < len(row):
        row[status_idx] = "✅ Активен"

    ws.append_row(row)
    return product_id


def update_product(row_index, name, category, photo_url, price, qty, cost=None):
    """Update only the known columns of an existing product row, by header name."""
    _invalidate_products()
    ws = _get_sheet(PRODUCTS_SHEET)
    if not ws:
        return False
    header = ws.row_values(1)
    actual_row = row_index + 2   # +1 header row, +1 for 1-based index

    updates = []  # list of {"range": "X{row}", "values": [[val]]}

    def setcol(value, key):
        idx = _find_col(header, *_COLS[key])
        if idx >= 0:
            updates.append({"range": f"{_col_letter(idx)}{actual_row}", "values": [[value]]})

    setcol(name, "name")
    setcol(category, "category")
    if photo_url:
        setcol(photo_url, "photo")
    setcol(str(price), "price")
    setcol(str(price), "price_disc")  # keep "Цена со скидкой" in sync (что показывает апп)
    setcol(str(qty), "qty")
    if cost is not None:
        setcol(str(cost), "cost_tjs")

    if updates:
        ws.batch_update(updates)
    return True


def update_product_prices(row_index: int, yuan: float, cost_tjs: float, price_tjs: float,
                          article: str = "") -> bool:
    """Batch-update the price columns for a product row.
    Writes: Себестоимость ¥, Себестоимость сомони, Продажная цена, Цена со скидкой,
    and optionally Артикул (if provided)."""
    _invalidate_products()
    ws = _get_sheet(PRODUCTS_SHEET)
    if not ws:
        return False
    header = ws.row_values(1)
    actual_row = row_index + 2

    updates = []

    def setcol(value, key):
        idx = _find_col(header, *_COLS[key])
        if idx >= 0:
            updates.append({
                "range": f"{_col_letter(idx)}{actual_row}",
                "values": [[value]],
            })

    setcol(round(float(yuan), 2),     "cost_yuan")
    setcol(round(float(cost_tjs), 2), "cost_tjs")
    setcol(round(float(price_tjs), 0),"price")
    setcol(round(float(price_tjs), 0),"price_disc")
    if article:
        setcol(article, "article")

    if updates:
        ws.batch_update(updates)
    return True


def update_product_photo(row_index: int, photo_url: str) -> bool:
    """Update only the photo column (Фото 1) for a product, leaving everything else intact."""
    _invalidate_products()
    ws = _get_sheet(PRODUCTS_SHEET)
    if not ws:
        return False
    header = ws.row_values(1)
    col_idx = _find_col(header, *_COLS["photo"])
    if col_idx < 0:
        print(f"[sheets] update_product_photo: photo column not found in header")
        return False
    actual_row = row_index + 2
    ws.update_acell(f"{_col_letter(col_idx)}{actual_row}", photo_url)
    return True


def delete_product(row_index: int) -> bool:
    """Delete a product row by its 0-based index (as returned by get_products _index)."""
    _invalidate_products()
    ws = _get_sheet(PRODUCTS_SHEET)
    if not ws:
        return False
    actual_row = row_index + 2   # +1 header row, +1 for 1-based index
    ws.delete_rows(actual_row)
    return True


# ─────────────────────────────────────────────────────────────
# Orders
# ─────────────────────────────────────────────────────────────

def create_order(user_id, name, phone, address, product_id, product_name, quantity, price, article=""):
    ws        = _ensure_orders_sheet()
    order_id  = str(uuid.uuid4())[:8].upper()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ws.append_row([
        order_id, str(user_id), name, phone, address,
        str(product_id), product_name, str(quantity), str(price),
        timestamp, "Новый", "False", str(article or ""),
    ])
    return order_id


def get_orders(user_id=None):
    ws   = _ensure_orders_sheet()
    rows = ws.get_all_records()
    if user_id:
        rows = [r for r in rows if str(r.get("user_id")) == str(user_id)]
    return rows


def update_order_status(order_id, status):
    ws   = _ensure_orders_sheet()
    rows = ws.get_all_values()
    target = str(order_id).strip()
    for i, row in enumerate(rows):
        if row and str(row[0]).strip() == target:
            ws.update_cell(i + 1, 11, status)
            return True
    return False


def delete_order(order_id: str) -> bool:
    ws = _ensure_orders_sheet()
    try:
        rows = ws.get_all_values()
        target = str(order_id).strip()
        for i, row in enumerate(rows):
            if row and str(row[0]).strip() == target:
                ws.delete_rows(i + 1)
                return True
        return False
    except Exception as e:
        print(f"[sheets] delete_order error: {e}")
        return False


def update_order_fields(order_id: str, fields: dict) -> bool:
    ws = _ensure_orders_sheet()
    try:
        header = ws.row_values(1)
        rows = ws.get_all_values()
        target = str(order_id).strip()
        for i, row in enumerate(rows):
            if not row or str(row[0]).strip() != target:
                continue
            row_num = i + 1
            updates = []
            for key, val in fields.items():
                try:
                    col_idx = header.index(key)
                    updates.append({
                        "range": f"{_col_letter(col_idx)}{row_num}",
                        "values": [[val]],
                    })
                except ValueError:
                    pass
            if updates:
                ws.batch_update(updates)
            return True
        return False
    except Exception as e:
        print(f"[sheets] update_order_fields error: {e}")
        return False


def get_order_user_id(order_id: str):
    """Return the Telegram user_id for a given order, or None.
    Tolerant of values stored as floats, with spaces, or empty.
    """
    ws = _ensure_orders_sheet()
    rows = ws.get_all_values()
    target = str(order_id).strip()
    for row in rows[1:]:  # skip header
        if not row:
            continue
        if str(row[0]).strip() != target:
            continue
        if len(row) < 2:
            return None
        raw = str(row[1]).strip()
        if not raw:
            return None
        # Tolerate floats like "7555325054.0"
        try:
            return int(raw)
        except ValueError:
            try:
                return int(float(raw))
            except (ValueError, TypeError):
                print(f"[sheets] get_order_user_id: bad user_id '{raw}' for order {order_id}")
                return None
    return None


def set_sale_price(row_index: int, price: float) -> bool:
    """Update only 'Продажная цена' and 'Цена со скидкой' for a product row."""
    _invalidate_products()
    ws = _get_sheet(PRODUCTS_SHEET)
    if not ws:
        return False
    try:
        header = ws.row_values(1)
        actual_row = row_index + 2
        updates = []
        for key in ("price", "price_disc"):
            idx = _find_col(header, *_COLS[key])
            if idx >= 0:
                updates.append({"range": f"{_col_letter(idx)}{actual_row}", "values": [[price]]})
        if updates:
            ws.batch_update(updates)
        return True
    except Exception as e:
        print(f"[sheets] set_sale_price error: {e}")
        return False


def decrement_product_qty(product_id: str, quantity: int = 1) -> bool:
    """Decrease 'В наличии (шт)' for the product with the given ID.
    Returns True on success, False if product not found or qty already 0."""
    _invalidate_products()
    ws = _get_sheet(PRODUCTS_SHEET)
    if not ws:
        return False
    try:
        header = ws.row_values(1)
        id_col = _find_col(header, "ID", "id")
        qty_col = _find_col(header, *_COLS["qty"])
        if id_col < 0 or qty_col < 0:
            print(f"[sheets] decrement_product_qty: ID or qty column not found")
            return False
        all_rows = ws.get_all_values()
        for i, row in enumerate(all_rows[1:], start=2):  # skip header, 1-based
            if len(row) > id_col and str(row[id_col]).strip() == str(product_id).strip():
                current = int(row[qty_col]) if (len(row) > qty_col and str(row[qty_col]).strip().isdigit()) else 0
                new_qty = max(0, current - quantity)
                ws.update_cell(i, qty_col + 1, new_qty)
                print(f"[sheets] decrement_product_qty id={product_id} {current}→{new_qty}")
                return True
        print(f"[sheets] decrement_product_qty: product_id={product_id} not found")
        return False
    except Exception as e:
        print(f"[sheets] decrement_product_qty error: {e}")
        return False


def delete_orders_except_delivered() -> dict:
    """Delete all orders EXCEPT those with status 'Доставлен'.
    Rewrites the sheet: header + only delivered rows. Returns counts."""
    ws = _ensure_orders_sheet()
    try:
        all_rows = ws.get_all_values()
        if not all_rows:
            return {"deleted": 0, "kept": 0}
        header = all_rows[0]
        # find status column index
        try:
            status_idx = header.index("status")
        except ValueError:
            status_idx = 10  # fallback: column 11 (0-indexed 10)
        delivered = [r for r in all_rows[1:] if len(r) > status_idx and r[status_idx] == "Доставлен"]
        deleted = len(all_rows) - 1 - len(delivered)
        # Rewrite sheet: clear + header + delivered rows only
        ws.clear()
        ws.update("A1", [header] + delivered)
        print(f"[sheets] delete_orders_except_delivered: kept={len(delivered)} deleted={deleted}")
        return {"deleted": deleted, "kept": len(delivered)}
    except Exception as e:
        print(f"[sheets] delete_orders_except_delivered error: {e}")
        return {"deleted": 0, "kept": 0, "error": str(e)}


def clear_orders() -> int:
    """Clear all order rows and restore only the header. Returns count of deleted rows.
    Uses ws.clear() + single header write instead of row-by-row deletion (avoids timeout)."""
    ws = _ensure_orders_sheet()
    try:
        all_rows = ws.get_all_values()
        count = max(0, len(all_rows) - 1)
        # Atomically wipe the sheet and restore header in 2 API calls
        ws.clear()
        ws.update("A1", [ORDERS_HEADER])
        print(f"[sheets] clear_orders: cleared {count} rows")
        return count
    except Exception as e:
        print(f"[sheets] clear_orders error: {e}")
        return 0


def get_stats():
    ws    = _ensure_orders_sheet()
    rows  = ws.get_all_records()
    today = datetime.now().strftime("%Y-%m-%d")
    month = datetime.now().strftime("%Y-%m")

    today_orders = [r for r in rows if str(r.get("timestamp", "")).startswith(today)]
    month_orders = [r for r in rows if str(r.get("timestamp", "")).startswith(month)]

    return {
        "today_count": len(today_orders),
        "today_sum":   sum(float(r.get("price", 0) or 0) for r in today_orders),
        "month_count": len(month_orders),
        "month_sum":   sum(float(r.get("price", 0) or 0) for r in month_orders),
        "total_count": len(rows),
    }
