# Updated mongo.py - Simple version that works
import datetime
from Shovar import Shovar
import appSettings as appsec
from pymongo import MongoClient
from ShovarFromMongo import ShovarFromMongo

amounts = ['15', '30', '40', '50', '100', '200']

# Simple MongoDB connection (this works!)
client = MongoClient(appsec.mongo_connection_string)
mydb = client["bot_fersal"]
mycol = mydb["shovarim"]


def insert_to_mongo(code):
    mycol.insert_one(code)


def check_if_exist(message):
    return mycol.find_one({"_id": message})


def find_barcode(amount):
    result = mycol.find_one({"amount": amount, "is_used": False})
    if result == 0:
        return None
    else:
        return result


def update_db(shovar):
    myquery = mycol.find_one({"_id": shovar.code})
    new_value = {"$set": {"is_used": True,
                          "date_used": datetime.datetime.now()}}
    mycol.update_one(myquery, new_value)


def check_how_much_money():
    amounts_dict = {}
    for amount in amounts:
        amounts_dict[amount] = 0
    for amount in amounts:
        coupons = mycol.find({"amount": amount, "is_used": False})
        for coupon in coupons:
            new_shovar = convert_mongo_to_shovar(coupon)
            amounts_dict[new_shovar.amount] = amounts_dict[new_shovar.amount] + 1
    return amounts_dict


def coupons_sum(coupons):
    sum_coupons = 0
    for key, value in coupons.items():
        for _ in range(value):
            sum_coupons += int(key)
    return sum_coupons


def convert_mongo_to_shovar(barcode):
    shovar = ShovarFromMongo.dict_to_shovar(barcode)
    new_shovar = Shovar(shovar._id,
                        shovar.code,
                        shovar.amount,
                        shovar.expiry_date,
                        shovar.is_used,
                        shovar.date_added,
                        shovar.date_used)
    return new_shovar

# New Cibus functions


def insert_cibus_voucher(voucher_data):
    """Insert Cibus voucher from email processing"""
    try:
        from datetime import datetime

        voucher_doc = {
            "_id": voucher_data.barcode,
            "code": voucher_data.barcode,
            "amount": str(int(voucher_data.amount)),
            "expiry_date": voucher_data.expiry_date,
            "is_used": False,
            "date_added": datetime.now(),
            "date_used": voucher_data.expiry_date,
            "source": "cibus_email",
            "source_url": getattr(voucher_data, 'source_url', '')
        }

        if check_if_exist(voucher_data.barcode) is None:
            insert_to_mongo(voucher_doc)
            print(
                f"✅ Added Cibus voucher: ₪{voucher_data.amount} - {voucher_data.barcode}")
            return True
        else:
            print(f"⚠️ Voucher {voucher_data.barcode} already exists")
            return False

    except Exception as e:
        print(f"❌ Error inserting Cibus voucher: {e}")
        return False


def scan_cibus_emails():
    """Scan for new Cibus vouchers in email"""
    try:
        from email_processor import CibusEmailProcessor
        import appSettings as appSet

        processor = CibusEmailProcessor(
            appSet.gmail_address,
            appSet.gmail_app_password
        )

        new_vouchers = processor.get_new_vouchers()
        added_count = 0
        total_amount = 0

        for voucher in new_vouchers:
            if insert_cibus_voucher(voucher):
                added_count += 1
                total_amount += voucher.amount

        return added_count, total_amount

    except Exception as e:
        print(f"❌ Error scanning emails: {e}")
        return 0, 0
