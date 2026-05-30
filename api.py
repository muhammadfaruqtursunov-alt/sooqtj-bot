import os
import json
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_ID = int(os.getenv("ADMIN_ID", "7555325054"))
bot = bot_module.bot  # reuse bot instance that has all handlers registered

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


WEBAPP_URL = os.getenv("WEBAPP_URL", "https://sooqtj-lang.github.io/sooqtj-bot")

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


@app.post("/api/products")
def add_product(data: ProductIn, user=Depends(require_admin)):
    product_id = sheets.add_product(
        data.name, data.category, data.photo_url, data.price, data.qty
    )
    return {"id": product_id}


@app.put("/api/products/{row_index}")
def update_product(row_index: int, data: ProductIn, user=Depends(require_admin)):
    ok = sheets.update_product(
        row_index, data.name, data.category, data.photo_url, data.price, data.qty
    )
    return {"ok": ok}


@app.delete("/api/products/{row_index}")
def delete_product(row_index: int, user=Depends(require_admin)):
    ok = sheets.delete_product(row_index)
    return {"ok": ok}


@app.post("/api/products/{row_index}/photo")
async def upload_product_photo(row_index: int, request: Request,
                                file: UploadFile = File(...),
                                user=Depends(require_admin)):
    """Upload a photo and assign it to a specific product row (writes Фото 1 column only)."""
    content = await file.read()
    mime = file.content_type or "image/jpeg"
    image_id = db.save_image(content, mime)
    if not image_id:
        raise HTTPException(status_code=500, detail="Не удалось сохранить фото (БД недоступна)")
    photo_url = f"{_public_base(request)}/api/image/{image_id}"
    ok = sheets.update_product_photo(row_index, photo_url)
    if not ok:
        raise HTTPException(status_code=500, detail="Не удалось записать URL фото в таблицу")
    return {"url": photo_url, "row_index": row_index}


# ─── PHOTO UPLOAD ────────────────────────────────────────────

def _public_base(request: Request) -> str:
    """Build the public HTTPS base URL from the Host header.
    request.base_url is unreliable behind Railway's proxy (returns http:// and
    an internal host), which causes mixed-content blocking in the HTTPS mini-app."""
    host = request.headers.get("host", "")
    if host:
        return f"https://{host}"
    return str(request.base_url).rstrip("/").replace("http://", "https://")


@app.post("/api/upload-photo")
async def upload_photo(request: Request, file: UploadFile = File(...), user=Depends(require_admin)):
    content = await file.read()
    mime = file.content_type or "image/jpeg"
    image_id = db.save_image(content, mime)
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
    # Save / update client profile in PostgreSQL
    db.upsert_client(user["id"], data.name, data.phone, data.address, data.price)
    try:
        art_line = f"🔖 Арт.: `{data.article}`\n" if data.article else ""
        bot.send_message(
            ADMIN_ID,
            f"🛒 *НОВЫЙ ЗАКАЗ #{order_id}!*\n\n"
            f"👤 {data.name}\n"
            f"📱 {data.phone}\n"
            f"📦 {data.product_name} x{data.quantity}\n"
            f"{art_line}"
            f"📍 {data.address}\n"
            f"💰 {data.price} сомони",
            parse_mode="Markdown",
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
    try:
        art_line = f"🔖 Арт.: `{data.article}`\n" if data.article else ""
        bot.send_message(
            ADMIN_ID,
            f"📝 *РУЧНОЙ ЗАКАЗ #{order_id}*"
            + (f" ({data.source})" if data.source else "")
            + f"\n\n"
            f"👤 {data.name}\n"
            f"📱 {data.phone}\n"
            f"📍 {data.address}\n"
            f"📦 {data.product_name} x{data.quantity}\n"
            f"{art_line}"
            f"💰 {data.price:.0f} сомони",
            parse_mode="Markdown",
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
        bot.send_message(
            ADMIN_ID,
            f"🛒 *НОВЫЙ ЗАКАЗ #{first_id}*"
            + (f" (+{len(order_ids)-1} поз.)" if len(order_ids) > 1 else "")
            + f"\n\n"
            f"👤 {data.name}\n"
            f"📱 {data.phone}\n"
            f"📍 {data.address}\n\n"
            f"📦 *Товары:*\n{lines}\n\n"
            f"💰 *Итого: {total:.0f} сомони*",
            parse_mode="Markdown",
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


# ─── STATS ──────────────────────────────────────────────────

@app.get("/api/stats")
def stats(user=Depends(require_admin)):
    return sheets.get_stats()


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
