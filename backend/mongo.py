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
grocery_col = mydb["grocery_lists"]  # New collection for grocery lists


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


# ============================================================================
# GROCERY LIST FUNCTIONS
# ============================================================================

def get_grocery_list(user):
    """Get user's grocery list"""
    try:
        user_list = grocery_col.find_one({"user": user})
        if user_list is None:
            # Create new list if doesn't exist
            grocery_col.insert_one({
                "user": user,
                "items": [],
                "master_items": []
            })
            return {"items": [], "master_items": []}
        return user_list
    except Exception as e:
        print(f"❌ Error getting grocery list: {e}")
        return {"items": [], "master_items": []}


def add_grocery_item(user, item_name, category=None):
    """Add item to grocery list"""
    try:
        import uuid
        from datetime import datetime

        # Normalize name for matching
        normalized_name = normalize_hebrew_text(item_name)

        new_item = {
            "id": str(uuid.uuid4()),
            "name": item_name,
            "normalized_name": normalized_name,
            "is_checked": False,
            "added_at": datetime.now(),
            "category": category
        }

        # Get or create user's list
        user_list = grocery_col.find_one({"user": user})
        if user_list is None:
            grocery_col.insert_one({
                "user": user,
                "items": [new_item],
                "master_items": []
            })
        else:
            grocery_col.update_one(
                {"user": user},
                {"$push": {"items": new_item}}
            )

        # Add to master items if not already there
        update_master_items(user, item_name, normalized_name)

        return new_item
    except Exception as e:
        print(f"❌ Error adding grocery item: {e}")
        return None


def toggle_grocery_item(user, item_id):
    """Toggle item checked status"""
    try:
        user_list = grocery_col.find_one({"user": user})
        if user_list:
            items = user_list.get("items", [])
            for item in items:
                if item["id"] == item_id:
                    item["is_checked"] = not item["is_checked"]
                    grocery_col.update_one(
                        {"user": user},
                        {"$set": {"items": items}}
                    )
                    return True
        return False
    except Exception as e:
        print(f"❌ Error toggling grocery item: {e}")
        return False


def delete_grocery_item(user, item_id):
    """Delete item from grocery list"""
    try:
        grocery_col.update_one(
            {"user": user},
            {"$pull": {"items": {"id": item_id}}}
        )
        return True
    except Exception as e:
        print(f"❌ Error deleting grocery item: {e}")
        return False


def clear_checked_items(user):
    """Remove all checked items"""
    try:
        user_list = grocery_col.find_one({"user": user})
        if user_list:
            items = user_list.get("items", [])
            unchecked_items = [item for item in items if not item.get("is_checked", False)]
            grocery_col.update_one(
                {"user": user},
                {"$set": {"items": unchecked_items}}
            )
            return True
        return False
    except Exception as e:
        print(f"❌ Error clearing checked items: {e}")
        return False


def normalize_hebrew_text(text):
    """Normalize Hebrew text for matching"""
    import re

    # Remove nikud (Hebrew diacritics)
    text = re.sub(r'[\u0591-\u05C7]', '', text)

    # Remove various apostrophe/geresh characters
    text = text.replace("'", "").replace("׳", "").replace("״", "").replace("'", "")

    # Lowercase and strip whitespace
    return text.strip().lower()


def update_master_items(user, item_name, normalized_name):
    """Update master items database for learning"""
    try:
        user_list = grocery_col.find_one({"user": user})
        if user_list:
            master_items = user_list.get("master_items", [])

            # Check if item already exists in master
            found = False
            for master_item in master_items:
                if master_item.get("normalized_name") == normalized_name:
                    # Increment usage count
                    master_item["usage_count"] = master_item.get("usage_count", 0) + 1
                    # Add alias if different spelling
                    if item_name not in master_item.get("aliases", []):
                        master_item.setdefault("aliases", []).append(item_name)
                    found = True
                    break

            if not found:
                # Add new master item
                master_items.append({
                    "name": item_name,
                    "normalized_name": normalized_name,
                    "aliases": [item_name],
                    "usage_count": 1,
                    "category": None
                })

            grocery_col.update_one(
                {"user": user},
                {"$set": {"master_items": master_items}}
            )
    except Exception as e:
        print(f"❌ Error updating master items: {e}")


def get_user_grocery_history(user):
    """Get all items user has ever added"""
    try:
        user_list = grocery_col.find_one({"user": user})
        if user_list:
            master_items = user_list.get("master_items", [])
            # Return sorted by usage count
            return sorted(master_items, key=lambda x: x.get("usage_count", 0), reverse=True)
        return []
    except Exception as e:
        print(f"❌ Error getting grocery history: {e}")
        return []
