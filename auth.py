import os
import hmac
import hashlib
import json
import time
from urllib.parse import parse_qsl, unquote

# runtime set — populated at startup + when drivers activate
_active_drivers: set = set()

# runtime set — populated when partner activates via /partner
_partner_ids: set = set()

_INIT_DATA_MAX_AGE = 86400  # 24 hours


def _load_drivers_from_env():
    return set(
        int(x.strip())
        for x in os.getenv("DRIVER_IDS", "").split(",")
        if x.strip().isdigit()
    )


def _load_partners_from_env():
    return set(
        int(x.strip())
        for x in os.getenv("PARTNER_IDS", "").split(",")
        if x.strip().isdigit()
    )


def init_drivers():
    global _active_drivers, _partner_ids
    _active_drivers = _load_drivers_from_env()
    _partner_ids    = _load_partners_from_env()


def reload_partners_from_db():
    global _partner_ids
    try:
        import db
        db_partners = db.get_partner_ids()
        _partner_ids = _partner_ids | db_partners
        print(f"[auth] partners loaded from DB: {len(db_partners)} entries")
    except Exception as e:
        print(f"[auth] reload_partners_from_db error: {e}")


def add_driver_runtime(user_id: int):
    _active_drivers.add(user_id)


def add_partner_runtime(user_id: int):
    _partner_ids.add(user_id)
    try:
        import db
        db.add_partner(user_id)
    except Exception as e:
        print(f"[auth] add_partner db save error: {e}")


def _get_admin_id():
    val = os.getenv("ADMIN_ID", "")
    if not val:
        raise RuntimeError("ADMIN_ID env var not set")
    return int(val)


def _verify_init_data_hmac(init_data: str) -> dict | None:
    """
    Verify Telegram WebApp initData using HMAC-SHA256.
    Returns parsed user dict if valid, None otherwise.
    """
    token = os.getenv("BOT_TOKEN", "")
    if not token:
        return None
    try:
        parsed = dict(parse_qsl(init_data, keep_blank_values=True))
        received_hash = parsed.pop("hash", None)
        if not received_hash:
            return None

        # Check freshness
        auth_date = int(parsed.get("auth_date", 0))
        if time.time() - auth_date > _INIT_DATA_MAX_AGE:
            print("[auth] initData expired")
            return None

        # Build data-check string: sorted key=value pairs joined by \n
        data_check = "\n".join(
            f"{k}={v}" for k, v in sorted(parsed.items())
        )

        # secret_key = HMAC-SHA256("WebAppData", BOT_TOKEN)
        secret_key = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
        expected = hmac.new(secret_key, data_check.encode(), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(expected, received_hash):
            print("[auth] initData HMAC mismatch — rejected")
            return None

        user_raw = parsed.get("user", "")
        if user_raw:
            user_data = json.loads(unquote(user_raw))
            if user_data.get("id"):
                return user_data

    except Exception as e:
        print(f"[auth] initData verify error: {e}")
    return None


def validate_init_data(init_data: str, user_id_fallback: str = ""):
    """
    Validate Telegram WebApp initData.
    STRICT_HMAC=1 env var enables full HMAC rejection (disabled by default
    until verified working in production).
    """
    if init_data:
        # Always try HMAC first
        user = _verify_init_data_hmac(init_data)
        if user:
            return user

        # If HMAC fails, fall back to parsing without verification (legacy mode)
        # unless STRICT_HMAC=1 is set
        if os.getenv("STRICT_HMAC") != "1":
            try:
                from urllib.parse import parse_qsl, unquote
                import json as _json
                parsed = dict(parse_qsl(init_data, keep_blank_values=True))
                user_raw = parsed.get("user", "")
                if user_raw:
                    user_data = _json.loads(unquote(user_raw))
                    if user_data.get("id"):
                        print(f"[auth] HMAC failed, using legacy parse for uid={user_data['id']}")
                        return user_data
            except Exception:
                pass

    # X-User-Id fallback (for dev or when no initData)
    if user_id_fallback:
        try:
            uid = int(user_id_fallback)
            if uid > 0:
                return {"id": uid}
        except Exception:
            pass

    return None


def get_role(user_id: int) -> str:
    try:
        admin_id = _get_admin_id()
    except RuntimeError:
        admin_id = None
    if admin_id and user_id == admin_id:
        return "admin"
    if user_id in _active_drivers:
        return "driver"
    if user_id in _partner_ids:
        return "partner"
    return "client"


# initialize on import
init_drivers()
