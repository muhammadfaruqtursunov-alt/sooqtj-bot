import os
import json
from urllib.parse import parse_qsl, unquote

# runtime set — populated at startup + when drivers activate
_active_drivers: set = set()

# runtime set — populated when partner activates via /partner
_partner_ids: set = set()


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
    """Merge partner_ids from PostgreSQL with env-based set.
    Called at FastAPI startup AFTER db.init_db()."""
    global _partner_ids
    try:
        import db
        db_partners = db.get_partner_ids()
        _partner_ids = _partner_ids | db_partners
        print(f"[auth] partners loaded: env={_load_partners_from_env()} db={db_partners} → {_partner_ids}")
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
    return int(os.getenv("ADMIN_ID", "7555325054"))


def validate_init_data(init_data: str, user_id_fallback: str = ""):
    if init_data:
        try:
            parsed = dict(parse_qsl(init_data, keep_blank_values=True))
            user_raw = parsed.get("user", "")
            if user_raw:
                user_data = json.loads(unquote(user_raw))
                if user_data.get("id"):
                    return user_data
        except Exception as e:
            print(f"[auth] initData parse error: {e}")

    if user_id_fallback:
        try:
            uid = int(user_id_fallback)
            if uid > 0:
                return {"id": uid}
        except Exception:
            pass

    return None


def get_role(user_id: int) -> str:
    if user_id == _get_admin_id():
        return "admin"
    if user_id in _active_drivers:
        return "driver"
    if user_id in _partner_ids:
        return "partner"
    return "client"


# initialize on import
init_drivers()
