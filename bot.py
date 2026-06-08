import os
import requests
import telebot
from telebot import types

TOKEN        = os.getenv("BOT_TOKEN")
ADMIN_ID     = int(os.getenv("ADMIN_ID", "7555325054"))
WEBAPP_URL   = "https://sooqtj-lang.github.io/sooqtj-bot"  # hardcoded — bypass stale Railway env
DRIVER_CODE  = os.getenv("DRIVER_CODE", "")
PARTNER_CODE = os.getenv("PARTNER_CODE", "ALISHER-9274")

_pending_partner: set = set()

# Railway API для обновления DRIVER_IDS
_RAILWAY_TOKEN   = os.getenv("RAILWAY_TOKEN", "")
_PROJECT_ID      = "36856888-fab8-4664-80a0-e4e8c99371f0"
_SERVICE_ID      = "2f4cabf6-fc39-4670-9321-bc7df9a6496d"
_ENVIRONMENT_ID  = "d289ca25-6f1e-48e1-bf6b-9e69ddbc75c6"

bot = telebot.TeleBot(TOKEN)


def is_admin(message):
    return message.chat.id == ADMIN_ID


def make_markup(label, uid=None):
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
    if WEBAPP_URL:
        url = f"{WEBAPP_URL}?uid={uid}" if uid else WEBAPP_URL
        markup.add(types.KeyboardButton(label, web_app=types.WebAppInfo(url=url)))
    return markup


def _save_driver_to_railway(user_id: int):
    """Добавляет user_id в DRIVER_IDS через Railway API."""
    if not _RAILWAY_TOKEN:
        return
    current = os.getenv("DRIVER_IDS", "")
    ids = [x.strip() for x in current.split(",") if x.strip().isdigit()]
    if str(user_id) in ids:
        return
    ids.append(str(user_id))
    new_value = ",".join(ids)
    try:
        requests.post(
            "https://backboard.railway.app/graphql/v2",
            headers={"Authorization": f"Bearer {_RAILWAY_TOKEN}", "Content-Type": "application/json"},
            json={"query": f"""mutation {{
                variableUpsert(input: {{
                    projectId: "{_PROJECT_ID}",
                    serviceId: "{_SERVICE_ID}",
                    environmentId: "{_ENVIRONMENT_ID}",
                    name: "DRIVER_IDS",
                    value: "{new_value}"
                }})
            }}"""},
            timeout=5,
        )
        print(f"[driver] saved {user_id} to Railway DRIVER_IDS={new_value}")
    except Exception as e:
        print(f"[driver] Railway update error: {e}")


@bot.message_handler(commands=["start"])
def start(message):
    uid = message.chat.id
    if is_admin(message):
        bot.send_message(
            message.chat.id,
            "👑 Добро пожаловать, администратор!",
            reply_markup=make_markup("📊 Открыть панель управления", uid),
        )
    else:
        name = message.from_user.first_name or "друг"
        bot.send_message(
            message.chat.id,
            f"Привет, {name}! 👋\n\n"
            "Добро пожаловать в SOOQ.TJ — ваш надёжный магазин с быстрой доставкой прямо к двери.\n\n"
            "Нажмите кнопку ниже, чтобы начать покупки 👇",
            reply_markup=make_markup("🛍 Открыть магазин SOOQ", uid),
        )


@bot.message_handler(commands=["driver"])
def driver_start(message):
    if not DRIVER_CODE:
        bot.send_message(message.chat.id, "❌ Активация водителей не настроена.")
        return
    msg = bot.send_message(message.chat.id, "🚚 Введите код активации водителя:")
    bot.register_next_step_handler(msg, driver_activate)


def driver_activate(message):
    if message.text.strip() == DRIVER_CODE:
        import auth
        auth.add_driver_runtime(message.chat.id)
        _save_driver_to_railway(message.chat.id)
        bot.send_message(
            message.chat.id,
            "✅ Вы активированы как водитель!\n\nНажмите кнопку для просмотра доставок:",
            reply_markup=make_markup("🚚 Мои доставки", message.chat.id),
        )
    else:
        bot.send_message(message.chat.id, "❌ Неверный код.\n\nПопробуйте ещё раз: /driver")


@bot.message_handler(commands=["partner"])
def partner_start(message):
    _pending_partner.add(message.chat.id)
    msg = bot.send_message(message.chat.id, "🔐 Введите код доступа партнёра:")
    bot.register_next_step_handler(msg, partner_activate)


def _save_partner_to_railway(user_id: int):
    """Добавляет user_id в PARTNER_IDS через Railway API."""
    if not _RAILWAY_TOKEN:
        return
    current = os.getenv("PARTNER_IDS", "")
    ids = [x.strip() for x in current.split(",") if x.strip().isdigit()]
    if str(user_id) in ids:
        return
    ids.append(str(user_id))
    new_value = ",".join(ids)
    try:
        requests.post(
            "https://backboard.railway.app/graphql/v2",
            headers={"Authorization": f"Bearer {_RAILWAY_TOKEN}", "Content-Type": "application/json"},
            json={"query": f"""mutation {{
                variableUpsert(input: {{
                    projectId: "{_PROJECT_ID}",
                    serviceId: "{_SERVICE_ID}",
                    environmentId: "{_ENVIRONMENT_ID}",
                    name: "PARTNER_IDS",
                    value: "{new_value}"
                }})
            }}"""},
            timeout=5,
        )
        print(f"[partner] saved {user_id} to Railway PARTNER_IDS={new_value}")
    except Exception as e:
        print(f"[partner] Railway update error: {e}")


def partner_activate(message):
    _pending_partner.discard(message.chat.id)
    if message.text.strip() == PARTNER_CODE:
        import auth
        auth.add_partner_runtime(message.chat.id)
        _save_partner_to_railway(message.chat.id)
        bot.send_message(
            message.chat.id,
            "✅ Добро пожаловать, партнёр!\n\nОткройте мини-апп и обновите страницу — вам будет доступна панель аналитики.",
            reply_markup=make_markup("📊 Открыть панель", message.chat.id),
        )
    else:
        bot.send_message(message.chat.id, "❌ Неверный код.\n\nПопробуйте ещё раз: /partner")


if __name__ == "__main__":
    print("🤖 SOOQ.TJ Bot запущен (polling mode)...")
    bot.polling(none_stop=True)
