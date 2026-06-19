import os
import json
import time as _time  # noqa: F401 — keep for Railway redeploy trigger
from pathlib import Path

from fastapi import FastAPI, HTTPException, Header, UploadFile, File, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
import telebot
import bot as bot_module

import sheets
import auth
import db

app = FastAPI(title="SOOQ.TJ API")


@app.on_event("startup")
def on_startup():
    try:
        db.init_db()
        print("[startup] PostgreSQL: OK ✓")
    except Exception as e:
        print(f"[startup] PostgreSQL: FAILED — {e}")
    try:
        auth.reload_partners_from_db()
    except Exception as e:
        print(f"[startup] auth.reload_partners_from_db FAILED — {e}")
    try:
        sheets.ensure_connected()
        sheets.get_products()
        print("[startup] Google Sheets: warmed up ✓")
    except Exception as e:
        print(f"[startup] Google Sheets: FAILED — {e}")
    # ── Auto-register Telegram webhook on every boot ──
    try:
        import requests as _rq
        token = os.getenv("BOT_TOKEN", "")
        if token:
            url = f"{BACKEND_URL}/webhook"
            resp = _rq.post(
                f"https://api.telegram.org/bot{token}/setWebhook",
                json={"url": url, "drop_pending_updates": False},
                timeout=10,
            )
            print(f"[startup] setWebhook → {url} | {resp.text[:300]}")
        else:
            print("[startup] BOT_TOKEN missing — skipping setWebhook")
    except Exception as e:
        print(f"[startup] setWebhook FAILED — {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_ID = int(os.getenv("ADMIN_ID", "7555325054"))
bot = bot_module.bot  # reuse bot instance that has all handlers registered


def _notify_staff(text: str, exclude_uid: int | None = None):
    """Send a Telegram message to admin + all drivers + all partners."""
    recipients = set()
    recipients.add(ADMIN_ID)
    recipients.update(auth._active_drivers)
    recipients.update(auth._partner_ids)
    if exclude_uid:
        recipients.discard(exclude_uid)
    for uid in recipients:
        try:
            bot.send_message(uid, text, parse_mode="Markdown")
        except Exception as e:
            print(f"[notify_staff] uid={uid} error: {e}")

# ─── AUTH ───────────────────────────────────────────────────

def get_current_user(x_init_data: str = Header(default=""), x_user_id: str = Header(default="")):
    user = auth.validate_init_data(x_init_data, x_user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user["role"] = auth.get_role(user["id"])
    return user


def require_admin(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def require_driver_or_admin(user=Depends(get_current_user)):
    if user["role"] not in ("admin", "driver"):
        raise HTTPException(status_code=403, detail="Driver/Admin only")
    return user


def require_admin_or_partner(user=Depends(get_current_user)):
    if user["role"] not in ("admin", "partner"):
        raise HTTPException(status_code=403, detail="Admin/Partner only")
    return user


WEBAPP_URL  = "https://sooqtj-lang.github.io/sooqtj-bot"  # hardcoded — bypass stale env
BACKEND_URL = "https://web-production-748b4.up.railway.app"

STATUS_MESSAGES = {
    "Подтверждён": (
        "✅ Ваш заказ #{id} подтверждён!\n\n"
        "Мы рады, что вы выбрали нас. Заказ будет доставлен "
        "в течение 24 часов. Гарантируем качество и скорость. "
        "Спасибо за доверие! 🙏"
    ),
    "В пути": (
        "🚗 Ваш заказ #{id} уже в пути!\n\n"
        "Курьер выехал и скоро будет у вас. "
        "Пожалуйста, будьте на связи — ждать совсем немного!"
    ),
    "Доставлен": (
        "📦 Ваш заказ #{id} доставлен!\n\n"
        "Надеемся, товар оправдал ожидания. "
        "Будем рады видеть вас снова! 🛍"
    ),
    "Отменён": (
        "😔 Ваш заказ #{id} отменён.\n\n"
        "Нам очень жаль. Если причина в нас — "
        "пожалуйста, оставьте отзыв, чтобы мы стали лучше."
    ),
    "Возврат": (
        "↩️ Ваш заказ #{id} оформлен на возврат.\n\n"
        "Курьер свяжется с вами для уточнения деталей."
    ),
}


# ─── HEALTH ─────────────────────────────────────────────────

@app.get("/health")
def health():
    status = {"ok": True, "sheets": False, "db": False}
    try:
        sheets.ensure_connected()
        status["sheets"] = True
    except Exception as e:
        status["sheets_error"] = str(e)
    try:
        db._conn()
        status["db"] = db._pg_ok
    except Exception as e:
        status["db_error"] = str(e)
    return status


# ─── WEBHOOK ────────────────────────────────────────────────

@app.post("/webhook")
async def webhook(update: dict):
    update_obj = telebot.types.Update.de_json(json.dumps(update))
    bot.process_new_updates([update_obj])
    return {"ok": True}


# ─── ME + ROLE ──────────────────────────────────────────────

@app.get("/api/me")
def me(user=Depends(get_current_user)):
    return user

@app.get("/api/role")
def get_role_endpoint(user_id: int):
    role = auth.get_role(user_id)
    print(f"[role] user_id={user_id} → {role}")
    return {"role": role, "user_id": user_id}


@app.post("/api/_admin/setup-bot")
def setup_bot(user=Depends(require_admin)):
    """Force re-register Telegram webhook + return current webhook info."""
    import requests as _rq
    token = os.getenv("BOT_TOKEN", "")
    if not token:
        raise HTTPException(status_code=500, detail="BOT_TOKEN missing in env")
    url = f"{BACKEND_URL}/webhook"
    set_resp = _rq.post(
        f"https://api.telegram.org/bot{token}/setWebhook",
        json={"url": url, "drop_pending_updates": True},
        timeout=10,
    ).json()
    info_resp = _rq.get(
        f"https://api.telegram.org/bot{token}/getWebhookInfo",
        timeout=10,
    ).json()
    return {
        "webapp_url": WEBAPP_URL,
        "set":        set_resp,
        "info":       info_resp,
    }


@app.get("/api/_diag/notify/{order_id}")
def _diag_notify(order_id: str, user=Depends(require_admin)):
    """Admin-only: probe why notifications might not reach the client."""
    import os as _os
    token = _os.getenv("BOT_TOKEN", "")
    diag = {
        "order_id":       order_id,
        "bot_token_set":  bool(token),
        "bot_token_len":  len(token),
        "client_uid":     None,
        "send_attempted": False,
        "send_ok":        False,
        "send_error":     None,
    }
    try:
        diag["client_uid"] = sheets.get_order_user_id(order_id)
    except Exception as e:
        diag["send_error"] = f"sheet lookup error: {e}"
        return diag
    if not diag["client_uid"]:
        diag["send_error"] = "user_id not found in sheet row"
        return diag
    try:
        diag["send_attempted"] = True
        bot.send_message(diag["client_uid"], f"🧪 Тестовое сообщение по заказу #{order_id}")
        diag["send_ok"] = True
    except Exception as e:
        diag["send_error"] = f"telegram send error: {e}"
    return diag


# ─── PRODUCTS ───────────────────────────────────────────────

@app.get("/api/products")
def get_products():
    return sheets.get_products()


class ProductIn(BaseModel):
    name: str
    category: str
    photo_url: str = ""
    price: float
    qty: int
    cost: float | None = None


@app.post("/api/products")
def add_product(data: ProductIn, user=Depends(require_admin)):
    product_id = sheets.add_product(
        data.name, data.category, data.photo_url, data.price, data.qty, cost=data.cost
    )
    return {"id": product_id}


@app.put("/api/products/{row_index}")
def update_product(row_index: int, data: ProductIn, user=Depends(require_admin)):
    ok = sheets.update_product(
        row_index, data.name, data.category, data.photo_url, data.price, data.qty, cost=data.cost
    )
    return {"ok": ok}


@app.delete("/api/products/{row_index}")
def delete_product(row_index: int, user=Depends(require_admin)):
    ok = sheets.delete_product(row_index)
    return {"ok": ok}


# ─── ADMIN: bulk price recalculation ────────────────────────
# Pricing map (kept in sync with mini-app/src/costCalculation.js).
# Volume per unit (m³) + yuan price (extracted from the source xlsx).
_PRICING_MAP = {
    "ORM-513":  {"vol_m3": 0.0510,  "yuan": 285},
    "ORM-8028": {"vol_m3": 0.01275, "yuan": 60},
    "ORM-8823": {"vol_m3": 0.0360,  "yuan": 135},
    "ORM-8860": {"vol_m3": 0.0445,  "yuan": 148},
    "ORM-8821": {"vol_m3": 0.02875, "yuan": 108},
    "ORM-3579": {"vol_m3": 0.03167, "yuan": 155},
    "ORM-3595": {"vol_m3": 0.0200,  "yuan": 110},
    "ORM-925":  {"vol_m3": 0.0034,  "yuan": 43},
    "ORM-8031": {"vol_m3": 0.01017, "yuan": 49},
    "ORM-8011": {"vol_m3": 0.0105,  "yuan": 55},
    "ORM-3311": {"vol_m3": 0.0340,  "yuan": 195},
    "ORM-3313": {"vol_m3": 0.0340,  "yuan": 108},
    "ORM-213":  {"vol_m3": 0.0464,  "yuan": 298},
    "ORM-211":  {"vol_m3": 0.0380,  "yuan": 235},
    "ORM-6807": {"vol_m3": 0.04235, "yuan": 450},
    "ORM-3536": {"vol_m3": 0.0098,  "yuan": 88},
    "ORM-8060": {"vol_m3": 0.00792, "yuan": 48},
}
_CARGO_USD_PER_CBM = 200.0
_USD_TO_TJS        = 10.5
_YUAN_TO_TJS       = 1.37
_DELIVERY_TJS      = 20.0
_MARKUP            = 2.0


_NAME_TO_CODE = {
    "моющий пылесос": "ORM-513",
}

# ── Manual sale prices (somoni) set by owner ─────────────────
_MANUAL_PRICES: dict[str, float] = {
    "ORM-513":  770,
    "ORM-8028": 250,
    "ORM-8823": 470,
    "ORM-8860": 570,
    "ORM-8821": 470,
    "ORM-3579": 550,
    "ORM-3595": 450,
    "ORM-925":  189,
    "ORM-8031": 230,
    "ORM-8011": 250,
    "ORM-3311": 650,
    "ORM-3313": 430,
    "ORM-213":  850,
    "ORM-211":  750,
    "ORM-6807": 1250,
    "ORM-3536": 289,
    "ORM-8060": 179,
}


def _extract_orm_code(product: dict) -> str | None:
    """Find ORM-XXX in any field of the product dict (handles swapped Артикул/Категория).
    Falls back to mapping by product name for legacy rows missing the code."""
    import re
    for v in product.values():
        s = str(v or "")
        m = re.search(r"ORM-\d+", s, re.IGNORECASE)
        if m:
            return m.group(0).upper()
    # name-based fallback
    name = str(product.get("Название (RU)") or product.get("Название") or "").strip().lower()
    if name in _NAME_TO_CODE:
        return _NAME_TO_CODE[name]
    return None


@app.post("/api/_admin/recalc-prices")
def recalc_prices(user=Depends(require_admin)):
    """Recompute cost & selling price for every product and write back to Sheets."""
    products = sheets.get_products()
    updated, skipped = [], []
    for p in products:
        row_index = p.get("_index")
        if row_index is None:
            skipped.append({"id": p.get("ID"), "reason": "no _index"})
            continue
        code = _extract_orm_code(p)
        if not code:
            skipped.append({"id": p.get("ID"), "reason": "no ORM code"})
            continue
        # Match base code (strip color suffix like 白色/黑色 for 8031/8011)
        base_code = code
        if base_code not in _PRICING_MAP:
            for key in _PRICING_MAP:
                if base_code.startswith(key):
                    base_code = key
                    break
        info = _PRICING_MAP.get(base_code)
        if not info:
            skipped.append({"id": p.get("ID"), "code": code, "reason": "no pricing data"})
            continue

        yuan      = info["yuan"]
        cargo_tjs = info["vol_m3"] * _CARGO_USD_PER_CBM * _USD_TO_TJS
        base_tjs  = yuan * _YUAN_TO_TJS
        cost_tjs  = base_tjs + cargo_tjs + _DELIVERY_TJS
        price_tjs = cost_tjs * _MARKUP

        ok = sheets.update_product_prices(row_index, yuan, cost_tjs, price_tjs, article=code)
        if ok:
            updated.append({
                "id": p.get("ID"), "code": code, "yuan": yuan,
                "cost": round(cost_tjs, 1), "price": round(price_tjs),
            })
        else:
            skipped.append({"id": p.get("ID"), "code": code, "reason": "sheets write failed"})

    return {"updated": updated, "skipped": skipped, "count": len(updated)}


@app.post("/api/products/{row_index}/photo")
async def upload_product_photo(row_index: int, request: Request,
                                file: UploadFile = File(...),
                                user=Depends(require_admin)):
    """Upload → compress to WebP (~70x smaller) → publish to GitHub Pages CDN.
    Also keeps a compressed Postgres copy as instant fallback while Pages rebuilds."""
    raw = await file.read()

    # 1. Compress to WebP (fast on slow internet)
    try:
        webp = _compress_to_webp(raw)
    except Exception as e:
        print(f"[upload] compress failed, using raw: {e}")
        webp = raw

    # 2. Resolve the product's article (ORM-XXX) → becomes the filename
    article = None
    try:
        for p in sheets.get_products():
            if p.get("_index") == row_index:
                article = _extract_orm_code(p)
                break
    except Exception as e:
        print(f"[upload] article lookup error: {e}")

    # 3. Postgres fallback copy (instant, covers the ~1-2 min Pages rebuild gap)
    image_id = db.save_image(webp, "image/webp")
    fallback_url = f"{_public_base(request)}/api/image/{image_id}" if image_id else ""

    # 4. Publish to GitHub Pages CDN if we know the article + have a token
    pages_url = ""
    committed = False
    if article:
        committed = _github_put_file(
            f"mini-app/public/products/{article}.webp",
            webp,
            f"photo: {article} via admin upload",
        )
        if committed:
            pages_url = f"{PAGES_BASE}/products/{article}.webp"

    # 5. Sheet URL = Pages (preferred) else Postgres fallback
    final_url = pages_url or fallback_url
    if final_url:
        sheets.update_product_photo(row_index, final_url)

    return {
        "url":          final_url,
        "pages_url":    pages_url,
        "fallback_url": fallback_url,
        "article":      article,
        "committed":    committed,
        "size_kb":      round(len(webp) / 1024, 1),
        "row_index":    row_index,
    }


# ─── PHOTO UPLOAD ────────────────────────────────────────────

def _public_base(request: Request) -> str:
    """Build the public HTTPS base URL from the Host header.
    request.base_url is unreliable behind Railway's proxy (returns http:// and
    an internal host), which causes mixed-content blocking in the HTTPS mini-app."""
    host = request.headers.get("host", "")
    if host:
        return f"https://{host}"
    return str(request.base_url).rstrip("/").replace("http://", "https://")


# ─── Image compression + GitHub Pages publishing ────────────
GITHUB_TOKEN   = os.getenv("GITHUB_TOKEN", "")
GITHUB_REPO    = os.getenv("GITHUB_REPO", "sooqtj-lang/sooqtj-bot")
GITHUB_BRANCH  = os.getenv("GITHUB_BRANCH", "main")
PAGES_BASE     = "https://sooqtj-lang.github.io/sooqtj-bot"


def _compress_to_webp(content: bytes, max_px: int = 800, quality: int = 80) -> bytes:
    """Resize to max_px on the long edge and re-encode as WebP (~50-80KB).
    ~70x smaller than a typical 3-4MB phone photo → fast on slow internet."""
    import io
    from PIL import Image
    im = Image.open(io.BytesIO(content)).convert("RGB")
    w, h = im.size
    scale = min(max_px / w, max_px / h, 1.0)
    if scale < 1.0:
        im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=6)
    return buf.getvalue()


def _github_put_file(repo_path: str, data: bytes, message: str) -> bool:
    """Create/update a file in the GitHub repo via Contents API.
    Triggers GitHub Actions → Pages rebuild. Returns True on success."""
    if not GITHUB_TOKEN:
        print("[github] GITHUB_TOKEN missing — skipping repo commit")
        return False
    import base64 as _b64
    import requests as _rq
    api = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{repo_path}"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
    }
    # Need current sha if file already exists (update vs create)
    sha = None
    try:
        r = _rq.get(api, headers=headers, params={"ref": GITHUB_BRANCH}, timeout=10)
        if r.status_code == 200:
            sha = r.json().get("sha")
    except Exception as e:
        print(f"[github] get sha error: {e}")
    payload = {
        "message": message,
        "content": _b64.b64encode(data).decode("ascii"),
        "branch": GITHUB_BRANCH,
    }
    if sha:
        payload["sha"] = sha
    try:
        r = _rq.put(api, headers=headers, json=payload, timeout=20)
        if r.status_code in (200, 201):
            print(f"[github] committed {repo_path} ({len(data)} bytes)")
            return True
        print(f"[github] PUT failed {r.status_code}: {r.text[:200]}")
        return False
    except Exception as e:
        print(f"[github] PUT error: {e}")
        return False


@app.post("/api/upload-photo")
async def upload_photo(request: Request, file: UploadFile = File(...), user=Depends(require_admin)):
    raw = await file.read()
    try:
        webp = _compress_to_webp(raw)
    except Exception:
        webp = raw
    image_id = db.save_image(webp, "image/webp")
    if not image_id:
        raise HTTPException(status_code=500, detail="Не удалось сохранить фото (БД недоступна)")
    return {"url": f"{_public_base(request)}/api/image/{image_id}"}


@app.post("/api/upload-logo")
async def upload_logo(request: Request, file: UploadFile = File(...), user=Depends(require_admin)):
    content = await file.read()
    mime = file.content_type or "image/png"
    ok = db.save_named_image("logo", content, mime)
    if not ok:
        raise HTTPException(status_code=500, detail="Не удалось сохранить лого (БД недоступна)")
    # cache-bust with timestamp so the new logo shows immediately
    import time as _t
    return {"url": f"{_public_base(request)}/api/image/logo?v={int(_t.time())}"}


@app.get("/api/image/{image_ref}")
def serve_image(image_ref: str):
    row = db.get_image(int(image_ref)) if image_ref.isdigit() else db.get_named_image(image_ref)
    if not row:
        raise HTTPException(status_code=404, detail="Изображение не найдено")
    data, mime = row
    return Response(content=data, media_type=mime,
                    headers={"Cache-Control": "public, max-age=86400"})


# ─── ORDERS ─────────────────────────────────────────────────

class OrderIn(BaseModel):
    name: str
    phone: str
    address: str
    product_id: str
    product_name: str
    quantity: int = 1
    price: float
    article: str = ""


class OrderItemIn(BaseModel):
    product_id: str
    product_name: str
    quantity: int = 1
    price: float
    article: str = ""


class BatchOrderIn(BaseModel):
    name: str
    phone: str
    address: str
    items: list[OrderItemIn]


@app.post("/api/orders")
def create_order(data: OrderIn, user=Depends(get_current_user)):
    order_id = sheets.create_order(
        user["id"], data.name, data.phone, data.address,
        data.product_id, data.product_name, data.quantity, data.price,
        article=data.article,
    )
    # Decrement stock in Google Sheets
    try:
        sheets.decrement_product_qty(data.product_id, data.quantity)
    except Exception as e:
        print(f"[orders] decrement_product_qty failed: {e}")
    # Save / update client profile in PostgreSQL
    db.upsert_client(user["id"], data.name, data.phone, data.address, data.price)
    try:
        art_line = f"🔖 Арт.: `{data.article}`\n" if data.article else ""
        _notify_staff(
            f"🛒 *НОВЫЙ ЗАКАЗ #{order_id}!*\n\n"
            f"👤 {data.name}\n"
            f"📱 {data.phone}\n"
            f"📦 {data.product_name} x{data.quantity}\n"
            f"{art_line}"
            f"📍 {data.address}\n"
            f"💰 {data.price} сомони",
        )
    except Exception:
        pass
    return {"id": order_id}


class ManualOrderIn(BaseModel):
    name: str
    phone: str
    address: str
    product_id: str = ""
    product_name: str
    quantity: int = 1
    price: float
    source: str = ""   # "Instagram", "WhatsApp", "Звонок", etc.
    article: str = ""


@app.post("/api/orders/manual")
def create_manual_order(data: ManualOrderIn, user=Depends(require_admin)):
    """Admin-only: register an order received via external channels.
    Stored with user_id=0 since there's no linked Telegram client.
    Source label is appended to the address for traceability."""
    address_with_src = (
        f"{data.address} [{data.source}]" if data.source else data.address
    )
    order_id = sheets.create_order(
        0, data.name, data.phone, address_with_src,
        data.product_id or "MANUAL",
        data.product_name, data.quantity, data.price,
        article=data.article,
    )
    # Decrement stock for manual orders too (if product_id is real)
    if data.product_id and data.product_id != "MANUAL":
        try:
            sheets.decrement_product_qty(data.product_id, data.quantity)
        except Exception as e:
            print(f"[orders/manual] decrement_product_qty failed: {e}")
    try:
        art_line = f"🔖 Арт.: `{data.article}`\n" if data.article else ""
        _notify_staff(
            f"📝 *РУЧНОЙ ЗАКАЗ #{order_id}*"
            + (f" ({data.source})" if data.source else "")
            + f"\n\n"
            f"👤 {data.name}\n"
            f"📱 {data.phone}\n"
            f"📍 {data.address}\n"
            f"📦 {data.product_name} x{data.quantity}\n"
            f"{art_line}"
            f"💰 {data.price:.0f} сомони",
        )
    except Exception:
        pass
    return {"id": order_id}


@app.post("/api/orders/batch")
def create_order_batch(data: BatchOrderIn, user=Depends(get_current_user)):
    """Create multiple orders (full cart) and send ONE combined notification."""
    if not data.items:
        raise HTTPException(status_code=400, detail="Корзина пуста")

    order_ids = []
    total = 0.0
    for item in data.items:
        order_id = sheets.create_order(
            user["id"], data.name, data.phone, data.address,
            item.product_id, item.product_name, item.quantity, item.price,
            article=item.article,
        )
        order_ids.append(order_id)
        total += item.price
        # Decrement stock for each cart item
        try:
            sheets.decrement_product_qty(item.product_id, item.quantity)
        except Exception as e:
            print(f"[orders/batch] decrement_product_qty failed: {e}")

    # Save / update client profile in PostgreSQL (once for the whole cart)
    db.upsert_client(user["id"], data.name, data.phone, data.address, total)

    # Build ONE combined notification
    try:
        lines = "\n".join(
            f"  • {it.product_name} x{it.quantity} — {it.price:.0f} сом"
            + (f"  🔖 `{it.article}`" if it.article else "")
            for it in data.items
        )
        first_id = order_ids[0]
        _notify_staff(
            f"🛒 *НОВЫЙ ЗАКАЗ #{first_id}*"
            + (f" (+{len(order_ids)-1} поз.)" if len(order_ids) > 1 else "")
            + f"\n\n"
            f"👤 {data.name}\n"
            f"📱 {data.phone}\n"
            f"📍 {data.address}\n\n"
            f"📦 *Товары:*\n{lines}\n\n"
            f"💰 *Итого: {total:.0f} сомони*",
        )
    except Exception:
        pass

    return {"ids": order_ids}


@app.get("/api/orders/my")
def my_orders(user=Depends(get_current_user)):
    return sheets.get_orders(user_id=user["id"])


@app.get("/api/orders")
def all_orders(user=Depends(require_admin_or_partner)):
    return sheets.get_orders()


@app.get("/api/deliveries")
def deliveries(user=Depends(require_driver_or_admin)):
    orders = sheets.get_orders()
    return [o for o in orders if o.get("status") in ("Новый", "В пути")]


class StatusIn(BaseModel):
    status: str


class OrderEditIn(BaseModel):
    name: str | None = None
    phone: str | None = None
    address: str | None = None
    product_name: str | None = None
    quantity: int | None = None
    price: float | None = None
    status: str | None = None


@app.put("/api/orders/{order_id}")
def update_order(order_id: str, data: StatusIn, user=Depends(require_driver_or_admin)):
    ok = sheets.update_order_status(order_id, data.status)

    notified = False
    notify_error = None
    client_uid = None

    if ok and data.status in STATUS_MESSAGES:
        client_uid = sheets.get_order_user_id(order_id)
        if not client_uid:
            notify_error = f"order #{order_id}: user_id not found in sheet"
            print(f"[notify] {notify_error}")
        else:
            msg = STATUS_MESSAGES[data.status].format(id=order_id)
            try:
                if data.status == "Отменён":
                    import telebot.types as tg_types
                    markup = tg_types.InlineKeyboardMarkup()
                    markup.add(tg_types.InlineKeyboardButton(
                        "✍️ Оставить отзыв",
                        web_app=tg_types.WebAppInfo(url=f"{WEBAPP_URL}?review=1")
                    ))
                    bot.send_message(client_uid, msg, reply_markup=markup)
                else:
                    bot.send_message(client_uid, msg)
                notified = True
                print(f"[notify] sent to uid={client_uid} status={data.status}")
            except Exception as e:
                notify_error = f"telegram send failed: {e}"
                print(f"[notify] failed uid={client_uid}: {e}")
    elif ok and data.status not in STATUS_MESSAGES:
        notify_error = f"no template for status '{data.status}'"

    return {
        "ok":           ok,
        "notified":     notified,
        "notify_error": notify_error,
        "client_uid":   client_uid,
    }


@app.patch("/api/orders/{order_id}/edit")
def edit_order(order_id: str, data: OrderEditIn, user=Depends(require_admin)):
    fields = {k: v for k, v in data.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    ok = sheets.update_order_fields(order_id, fields)
    if not ok:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"ok": True}


@app.delete("/api/orders/{order_id}")
def delete_order(order_id: str, user=Depends(require_admin)):
    ok = sheets.delete_order(order_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"ok": True}


# ─── STATS ──────────────────────────────────────────────────

@app.get("/api/stats")
def stats(user=Depends(require_admin)):
    try:
        return sheets.get_stats()
    except Exception as e:
        print(f"[stats] error: {e}")
        return {"today_count": 0, "today_sum": 0, "month_count": 0, "month_sum": 0, "total_count": 0}


# ─── CLIENTS ────────────────────────────────────────────────

@app.get("/api/clients")
def get_clients(user=Depends(require_admin_or_partner)):
    return db.get_clients()


# ─── REVIEWS ────────────────────────────────────────────────

class ReviewIn(BaseModel):
    text: str
    rating: int = 5


@app.post("/api/reviews")
def submit_review(data: ReviewIn, user=Depends(get_current_user)):
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Пустой отзыв")
    name = user.get("first_name", "") or user.get("username", "") or ""
    db.add_review(user["id"], name, data.text.strip(), data.rating)
    return {"ok": True}


@app.get("/api/reviews")
def get_reviews_endpoint(user=Depends(require_admin_or_partner)):
    return db.get_reviews()


class ExpenseIn(BaseModel):
    name: str
    amount: float


@app.get("/api/expenses")
def list_expenses(user=Depends(require_admin_or_partner)):
    return db.get_expenses()


@app.post("/api/expenses")
def create_expense(data: ExpenseIn, user=Depends(require_admin)):
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="Название обязательно")
    if data.amount < 0:
        raise HTTPException(status_code=400, detail="Сумма не может быть отрицательной")
    new_id = db.add_expense(data.name, float(data.amount))
    if not new_id:
        raise HTTPException(status_code=500, detail="Не удалось сохранить расход")
    return {"id": new_id}


@app.delete("/api/expenses/{expense_id}")
def remove_expense(expense_id: int, user=Depends(require_admin)):
    ok = db.delete_expense(expense_id)
    return {"ok": ok}


class BroadcastIn(BaseModel):
    text: str


@app.get("/api/version")
def version():
    return {"v": "cf7c453", "reset_stats": "yes"}


@app.post("/api/_admin/apply-manual-prices")
def apply_manual_prices(user=Depends(require_admin)):
    """Write the owner-set sale prices from _MANUAL_PRICES into Sheets.
    Updates 'Продажная цена' and 'Цена со скидкой' only — does NOT touch cost or qty."""
    products = sheets.get_products()
    updated, skipped = [], []
    for p in products:
        row_index = p.get("_index")
        if row_index is None:
            skipped.append({"reason": "no _index"})
            continue
        code = _extract_orm_code(p)
        if not code or code not in _MANUAL_PRICES:
            skipped.append({"id": p.get("ID"), "code": code, "reason": "not in price list"})
            continue
        price = _MANUAL_PRICES[code]
        ok = sheets.set_sale_price(row_index, price)
        if ok:
            updated.append({"id": p.get("ID"), "code": code, "price": price})
        else:
            skipped.append({"id": p.get("ID"), "code": code, "reason": "sheets write failed"})
    return {"updated": updated, "skipped": skipped, "count": len(updated)}


@app.post("/api/_admin/reset-stats")
def reset_stats(user=Depends(require_admin)):
    """Hard reset: clears all orders from Sheets + clients/expenses/reviews from Postgres."""
    result = {"ok": True, "orders_deleted": 0, "clients_deleted": 0,
              "expenses_deleted": 0, "reviews_deleted": 0, "errors": []}
    try:
        result["orders_deleted"] = sheets.clear_orders()
    except Exception as e:
        result["errors"].append(f"sheets: {e}")
        print(f"[reset-stats] sheets error: {e}")
    try:
        db_result = db.reset_all_data()
        result["clients_deleted"]  = db_result.get("clients", 0)
        result["expenses_deleted"] = db_result.get("expenses", 0)
        result["reviews_deleted"]  = db_result.get("reviews", 0)
    except Exception as e:
        result["errors"].append(f"db: {e}")
        print(f"[reset-stats] db error: {e}")
    print(f"[reset-stats] done: {result}")
    return result


@app.post("/api/_admin/reset-except-delivered")
def reset_except_delivered(user=Depends(require_admin)):
    """Partial reset: delete non-delivered orders, keep expenses, reset clients+reviews."""
    result = {"ok": True, "orders_deleted": 0, "orders_kept": 0,
              "clients_deleted": 0, "reviews_deleted": 0, "errors": []}
    try:
        r = sheets.delete_orders_except_delivered()
        result["orders_deleted"] = r.get("deleted", 0)
        result["orders_kept"]    = r.get("kept", 0)
        if "error" in r:
            result["errors"].append(f"sheets: {r['error']}")
    except Exception as e:
        result["errors"].append(f"sheets: {e}")
        print(f"[reset-partial] sheets error: {e}")
    try:
        conn = db._conn()
        if conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM clients"); result["clients_deleted"] = cur.rowcount
                cur.execute("DELETE FROM reviews")
                result["reviews_deleted"] = cur.rowcount
            conn.commit()
    except Exception as e:
        result["errors"].append(f"db: {e}")
        print(f"[reset-partial] db error: {e}")
    print(f"[reset-partial] done: {result}")
    return result


@app.post("/api/broadcast")
def broadcast(data: BroadcastIn, user=Depends(require_admin)):
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Пустое сообщение")
    user_ids = db.get_client_user_ids()
    sent, failed = 0, 0
    for uid in user_ids:
        try:
            bot.send_message(uid, data.text)
            sent += 1
        except Exception as e:
            print(f"[broadcast] failed uid={uid}: {e}")
            failed += 1
    return {"sent": sent, "failed": failed, "total": len(user_ids)}


# ─── STATIC: uploads + mini-app SPA ─────────────────────────

uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

dist = Path("mini-app/dist")
if dist.exists():
    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        resp = FileResponse(dist / "index.html")
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
        return resp
