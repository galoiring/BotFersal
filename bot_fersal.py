import time
import menu
import mongo
import telebot
import tenbis_report
import generate_barcode
from Shovar import Shovar
import appSettings as appSet
from ShovarFromMongo import ShovarFromMongo
from email_processor import CibusEmailProcessor

# bot init
bot = telebot.TeleBot(appSet.botToken)

# globals
message_ids = {}
barcode_ids = {}
global_shovar = []

email_processor = None


def initialize_email_processor():
    """Initialize email processor with credentials"""
    global email_processor
    try:
        # You'll need to add these to your appSettings.py
        email_processor = CibusEmailProcessor(
            email_address="gal.cibus@gmail.com",
            password=appSet.gmail_app_password  # Add this to appSettings.py
        )
        return True
    except Exception as e:
        print(f"Failed to initialize email processor: {e}")
        return False


def scan_cibus_emails_handler(call):
    """Handle Cibus email scanning"""
    scanning_msg = bot.send_message(
        call.message.chat.id, "📧 סורק אימיילים של Cibus...")

    try:
        added_count, total_amount = mongo.scan_cibus_emails()

        delete_message(call, scanning_msg.message_id)

        if added_count > 0:
            result_msg = bot.send_message(
                call.message.chat.id,
                f"✅ נמצאו {added_count} שוברי Cibus חדשים בסך {total_amount:.0f}₪!"
            )
        else:
            result_msg = bot.send_message(
                call.message.chat.id,
                "ℹ️ לא נמצאו שוברי Cibus חדשים"
            )

        time.sleep(5)
        delete_message(call, result_msg.message_id)

    except Exception as e:
        delete_message(call, scanning_msg.message_id)
        error_msg = bot.send_message(
            call.message.chat.id, f"❌ שגיאה בסריקת אימיילים: {e}")
        time.sleep(3)
        delete_message(call, error_msg.message_id)


@bot.message_handler(commands=['תפריט'])
def handle_command_adminwindow(message):
    print(f'All Users are: {appSet.user_name}')
    if message.from_user.username in appSet.user_name:
        print(f'Answering to user: {message.from_user.username}')
        bot.send_message(chat_id=message.chat.id,
                         text="BotFersal",
                         reply_markup=menu.menu(),
                         parse_mode='HTML')


@bot.callback_query_handler(func=lambda call: True)
def handle_query(call):
    local_shovar = []

    if call.data.startswith("coupon"):
        result = mongo.check_how_much_money()
        coupon_sum = mongo.coupons_sum(result)
        try:
            bot.edit_message_text(chat_id=call.message.chat.id,
                                  text="סה''כ כסף בשוברים: " +
                                  str(coupon_sum) + "₪",
                                  message_id=call.message.message_id,
                                  reply_markup=menu.coupon_menu(result),
                                  parse_mode='HTML')
        except telebot.apihelper.ApiTelegramException as e:
            if "message is not modified" in str(e):
                # Message content is the same, just answer the callback to remove loading state
                bot.answer_callback_query(callback_query_id=call.id)
            else:
                raise e

    if call.data.startswith("scan"):
        if call.data == "scan":  # Original 10bis scan
            ten_bis_api(call)
        elif call.data == "scan_cibus":  # New Cibus scan
            scan_cibus_emails_handler(call)

    if call.data.startswith("two_hundred"):
        barcode = mongo.find_barcode("200")
        find_or_not(barcode, call, local_shovar, 200)
    if call.data.startswith("hundred"):
        barcode = mongo.find_barcode("100")
        find_or_not(barcode, call, local_shovar, 100)
    if call.data.startswith("fifty"):
        barcode = mongo.find_barcode("50")
        find_or_not(barcode, call, local_shovar, 50)
    if call.data.startswith("forty"):
        barcode = mongo.find_barcode("40")
        find_or_not(barcode, call, local_shovar, 40)
    if call.data.startswith("thirty"):
        barcode = mongo.find_barcode("30")
        find_or_not(barcode, call, local_shovar, 30)
    if call.data.startswith("fifteen"):
        barcode = mongo.find_barcode("15")
        find_or_not(barcode, call, local_shovar, 15)
    if call.data.startswith("Used"):
        if global_shovar[:1] != None:
            mongo.update_db(global_shovar[0])
            global_shovar.clear()
        delete_message(call, call.message.message_id)
        delete_barcode_message(call)
    if call.data.startswith("Not Used"):
        if (global_shovar[:1] != None):
            global_shovar.clear()
        delete_message(call, call.message.message_id)
        delete_barcode_message(call)
    if call.data.startswith("Back"):
        try:
            bot.edit_message_text(chat_id=call.message.chat.id,
                                  text="BotFersal",
                                  message_id=call.message.message_id,
                                  reply_markup=menu.menu(),
                                  parse_mode='HTML')
        except telebot.apihelper.ApiTelegramException as e:
            if "message is not modified" in str(e):
                bot.answer_callback_query(callback_query_id=call.id)
            else:
                raise e

    if call.data.startswith("refresh"):
        result = mongo.check_how_much_money()
        coupon_sum = mongo.coupons_sum(result)

        # Get current message text to compare
        current_text = f"סה''כ כסף בשוברים: {coupon_sum}₪"

        try:
            bot.edit_message_text(chat_id=call.message.chat.id,
                                  text=current_text,
                                  message_id=call.message.message_id,
                                  reply_markup=menu.coupon_menu(result),
                                  parse_mode='HTML')
        except telebot.apihelper.ApiTelegramException as e:
            if "message is not modified" in str(e):
                # If content is the same, just answer the callback query to remove loading state
                bot.answer_callback_query(
                    callback_query_id=call.id,
                    text="השוברים מעודכנים ✅",
                    show_alert=False
                )
            else:
                raise e

    if call.data.startswith("close"):
        bot.delete_message(chat_id=call.message.chat.id,
                           message_id=call.message.message_id)

    if call.data.startswith("scan_cibus"):
        scan_cibus_emails_handler(call)


def find_or_not(barcode, call, local_shovar, amount):
    if None == barcode:
        bot.answer_callback_query(
            callback_query_id=call.id, show_alert=True, text=f"לא קיים שובר על סך {amount}₪")
    else:
        local_shovar.append(convert_mongo_to_shovar(barcode))
        global_shovar.append(local_shovar[0])
        new_file = generate_barcode.generate_barcode(local_shovar[0].code)
        message_id = bot.send_photo(
            chat_id=call.message.chat.id, photo=new_file).message_id
        if call.message.chat.id in barcode_ids.keys():
            barcode_ids[call.message.chat.id].append(message_id)
        else:
            barcode_ids[call.message.chat.id] = [message_id]
        menu.use_or_not(bot, call)


# TODO move to functions
def convert_mongo_to_shovar(barcode):
    shovar = ShovarFromMongo.dict_to_shovar(barcode)
    new_shovar = Shovar(shovar._id, shovar.code, shovar.amount, shovar.expiry_date, shovar.is_used, shovar.date_added,
                        shovar.date_used)
    return new_shovar


def delete_messages(call):
    for message_id in message_ids[call.message.chat.id]:
        bot.delete_message(call.message.chat.id, message_id)
    message_ids.clear()


def delete_message(call, message_id):
    bot.delete_message(call.message.chat.id, message_id)


def delete_barcode_message(call):
    for message_id in barcode_ids[call.message.chat.id]:
        bot.delete_message(call.message.chat.id, message_id)
    barcode_ids.clear()


def ten_bis_api(call):
    sent_msg = bot.send_message(
        call.message.chat.id, "יש להכניס את קוד האימות שקיבלת כעת")
    (email, headers, resp_json, session) = tenbis_report.auth_tenbis()
    if (email, headers, resp_json, session) == None:
        time.sleep(3)
        delete_message(call, sent_msg.message_id)
        delete_message(call, sent_msg.from_user.id)
        temp = bot.send_message(call.message.chat.id, "נתונים שגויים")
        time.sleep(5)
        delete_message(call, temp.message_id)
    else:
        time.sleep(3)
        delete_message(call, sent_msg.message_id)
        bot.register_next_step_handler(
            sent_msg, otp_handler, email, headers, resp_json, session, call)


def otp_handler(call, email, headers, resp_json, session, original_call):
    otp = call.text
    delete_message(original_call, call.id)
    count = 0
    amount = 0
    string = "מתוך השוברים שסרקתי, השוברים הבאים כבר שמורים אצלי:" + "\n"
    str_len = len(string)
    if otp.isdigit() and len(otp) == 5:
        scanning_message = bot.send_message(
            original_call.message.chat.id, "סורק 🧐")
        session = tenbis_report.auth_otp(
            email, headers, resp_json, session, otp)
        ten_bis = tenbis_report.main_procedure(session)
        for shovar in ten_bis:
            if mongo.check_if_exist(shovar.code) == None:
                count += 1
                amount += int(shovar.amount)
                mongo.insert_to_mongo(shovar.for_mongo())
            else:
                string += str(shovar.code) + "\n"
        delete_message(original_call, scanning_message.message_id)
        finish = bot.send_message(original_call.message.chat.id, "סיימתי 😁")
        time.sleep(2)
        delete_message(original_call, finish.message_id)

        if len(string) > str_len:
            temp = bot.send_message(original_call.message.chat.id, string)
            time.sleep(5)
            delete_message(original_call, temp.message_id)
        if count > 0:
            temp = bot.send_message(
                original_call.message.chat.id, f"נוספו {count} שוברים חדשים על סך {amount}₪")
            time.sleep(5)
            delete_message(original_call, temp.message_id)
    else:
        temp = bot.send_message(
            original_call.message.chat.id, "קוד לא תקין, נא ללחוץ על 'סריקה' שוב")
        time.sleep(5)
        delete_message(original_call, temp.message_id)


@bot.callback_query_handler(func=lambda call: call.data.startswith("scan_email"))
def handle_email_scan(call):
    scanning_msg = bot.send_message(
        call.message.chat.id, "📧 Scanning emails for vouchers...")

    try:
        added_count, total_amount = scan_cibus_emails()

        bot.delete_message(call.message.chat.id, scanning_msg.message_id)

        if added_count > 0:
            result_msg = bot.send_message(
                call.message.chat.id,
                f"✅ Found {added_count} new vouchers worth ₪{total_amount:.0f}!"
            )
        else:
            result_msg = bot.send_message(
                call.message.chat.id,
                "ℹ️ No new vouchers found in email"
            )

        time.sleep(5)
        bot.delete_message(call.message.chat.id, result_msg.message_id)

    except Exception as e:
        bot.delete_message(call.message.chat.id, scanning_msg.message_id)
        error_msg = bot.send_message(
            call.message.chat.id, f"❌ Email scan failed: {e}")
        time.sleep(3)
        bot.delete_message(call.message.chat.id, error_msg.message_id)


bot.infinity_polling()
