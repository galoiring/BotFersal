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
    """Add item to grocery list with smart duplicate detection and validation"""
    try:
        import uuid
        from datetime import datetime
        from rapidfuzz import fuzz

        # Normalize name for matching
        normalized_name = normalize_hebrew_text(item_name)

        # Get or create user's list
        user_list = grocery_col.find_one({"user": user})
        if user_list is None:
            # First item - no duplicates possible, no history
            new_item = {
                "id": str(uuid.uuid4()),
                "name": item_name,
                "normalized_name": normalized_name,
                "is_checked": False,
                "added_at": datetime.now(),
                "category": category
            }
            grocery_col.insert_one({
                "user": user,
                "items": [new_item],
                "master_items": []
            })
            update_master_items(user, item_name, normalized_name)
            return new_item

        existing_items = user_list.get("items", [])
        master_items = user_list.get("master_items", [])

        # STEP 1: Check if item already exists in current list (prevent duplicates)
        best_current_match = None
        best_current_similarity = 0
        best_similarity_type = None

        print(f"🔍 Checking if '{item_name}' (normalized: '{normalized_name}') is a duplicate...")
        print(f"   Current list has {len(existing_items)} items")

        for item in existing_items:
            existing_normalized = item.get("normalized_name", normalize_hebrew_text(item["name"]))

            # Calculate different similarity scores
            ratio_score = fuzz.ratio(normalized_name, existing_normalized)
            partial_score = fuzz.partial_ratio(normalized_name, existing_normalized)
            token_score = fuzz.token_set_ratio(normalized_name, existing_normalized)

            # Use partial_ratio for best results (handles "חלב" in "חלב תנובה")
            # But be stricter than token_set_ratio which is too generous
            similarity = max(ratio_score, partial_score)

            if similarity > best_current_similarity:
                best_current_similarity = similarity
                best_current_match = item
                best_similarity_type = f"ratio:{ratio_score}, partial:{partial_score}, token:{token_score}"

            if similarity > 70:
                print(f"   vs '{item['name']}': ratio={ratio_score}%, partial={partial_score}%, token={token_score}%, max={similarity}%")

        if best_current_match:
            print(f"   ✨ Best match: '{best_current_match['name']}' with {best_current_similarity}% ({best_similarity_type})")

        # If we found a very similar item in current list (80%+), it's a duplicate
        # Use 80% threshold with partial_ratio for good balance
        if best_current_similarity >= 80 and best_current_match:
            print(f"   🚫 DUPLICATE DETECTED! Item already in list.")
            # If item is checked, uncheck it (user wants to buy it again)
            if best_current_match["is_checked"]:
                print(f"   ✅ Item was checked - unchecking it")
                toggle_grocery_item(user, best_current_match["id"])
                return {"duplicate": True, "item": best_current_match, "unchecked": True}
            else:
                # Item already exists and is not checked
                print(f"   ⚠️  Item already in list and unchecked")
                return {"duplicate": True, "item": best_current_match, "unchecked": False}

        print(f"   ✅ Not a duplicate in current list (best match: {best_current_similarity}%)")

        # STEP 2: Item not in current list - check if it's similar to purchase history
        # This validates if it's a real product vs a typo
        best_master_match = None
        best_master_similarity = 0
        best_master_name = None

        print(f"   Checking against purchase history ({len(master_items)} items)...")

        for master_item in master_items:
            master_normalized = master_item.get("normalized_name", normalize_hebrew_text(master_item["name"]))

            # Use partial_ratio for consistency with duplicate detection
            ratio_score = fuzz.ratio(normalized_name, master_normalized)
            partial_score = fuzz.partial_ratio(normalized_name, master_normalized)
            similarity = max(ratio_score, partial_score)

            if similarity > best_master_similarity:
                best_master_similarity = similarity
                best_master_match = master_item
                best_master_name = master_item["name"]

            if similarity > 70:
                print(f"   vs history '{master_item['name']}': ratio={ratio_score}%, partial={partial_score}%")

        # STEP 3: Decide what name to use
        # Only use canonical name from history if it's a very close match (90%+)
        # Since master_items only contains purchased items, they should be correct
        final_category = category  # Start with provided category

        if best_master_similarity >= 90 and best_master_name:
            # Use the canonical name from history (almost exact match)
            print(f"   📚 Using canonical name from history: '{best_master_name}' (similarity: {best_master_similarity}%)")
            final_name = best_master_name
            final_normalized = best_master_match["normalized_name"]
            # Also use category from history if not provided
            if not final_category and best_master_match.get("category"):
                final_category = best_master_match["category"]
        else:
            # Use what user typed - trust the autocomplete suggestions
            print(f"   ✏️  Using user's input: '{item_name}'")
            final_name = item_name
            final_normalized = normalized_name

        # If still no category, try to match against common groceries
        if not final_category:
            import grocery
            common_items = grocery.get_common_israeli_groceries()
            for common_item in common_items:
                common_normalized = common_item.get("normalized_name", "")
                similarity = fuzz.ratio(final_normalized, common_normalized)
                if similarity >= 85:  # High match to common item
                    final_category = common_item.get("category")
                    print(f"   🏷️  Matched category '{final_category}' from common items (similarity: {similarity}%)")
                    break

        # Default to "other" if still no category
        if not final_category:
            final_category = "other"

        # Add new item
        new_item = {
            "id": str(uuid.uuid4()),
            "name": final_name,
            "normalized_name": final_normalized,
            "is_checked": False,
            "added_at": datetime.now(),
            "category": final_category
        }

        print(f"   ➕ Adding new item: '{final_name}'")

        grocery_col.update_one(
            {"user": user},
            {"$push": {"items": new_item}}
        )

        # Don't add to master_items yet - only add when item is checked off
        # This prevents typos from polluting the purchase history

        print(f"   ✅ Successfully added item '{final_name}'\n")
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
                    was_checked = item["is_checked"]
                    item["is_checked"] = not item["is_checked"]

                    # If item is being checked (marked as purchased), add to master_items
                    if not was_checked and item["is_checked"]:
                        update_master_items(user, item["name"], item["normalized_name"], item.get("category"))
                        print(f"   📚 Added '{item['name']}' to purchase history")

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


def update_master_items(user, item_name, normalized_name, category=None):
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
                    # Update category if provided and not already set
                    if category and not master_item.get("category"):
                        master_item["category"] = category
                    found = True
                    break

            if not found:
                # Add new master item
                master_items.append({
                    "name": item_name,
                    "normalized_name": normalized_name,
                    "aliases": [item_name],
                    "usage_count": 1,
                    "category": category or "other"
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


def clean_master_items(user):
    """
    Clean up master_items by removing likely typos.
    Validates items against common groceries database.
    """
    try:
        import grocery
        from rapidfuzz import fuzz

        user_list = grocery_col.find_one({"user": user})
        if not user_list:
            return 0

        master_items = user_list.get("master_items", [])
        common_items = grocery.get_common_israeli_groceries()

        cleaned_items = []
        removed_count = 0

        for item in master_items:
            item_name = item.get("name", "")
            item_normalized = item.get("normalized_name", normalize_hebrew_text(item_name))

            # Check if this item matches any common grocery with at least 70% similarity
            is_valid = False
            for common_item in common_items:
                common_normalized = common_item.get("normalized_name", "")
                similarity = fuzz.ratio(item_normalized, common_normalized)

                if similarity >= 70:
                    is_valid = True
                    break

            # Keep items that either:
            # 1. Match common groceries (70%+)
            # 2. Have been used multiple times (usage_count >= 3) - likely a real custom item
            if is_valid or item.get("usage_count", 0) >= 3:
                cleaned_items.append(item)
            else:
                print(f"   🗑️  Removing typo: '{item_name}' (usage: {item.get('usage_count', 0)})")
                removed_count += 1

        if removed_count > 0:
            grocery_col.update_one(
                {"user": user},
                {"$set": {"master_items": cleaned_items}}
            )
            print(f"✅ Cleaned {removed_count} items from purchase history")

        return removed_count
    except Exception as e:
        print(f"❌ Error cleaning master items: {e}")
        return 0


def update_grocery_item_category(user, item_id, new_category):
    """
    Update the category of a specific grocery item

    Args:
        user: Username
        item_id: ID of the item to update
        new_category: New category name

    Returns:
        Updated item dict, or None if not found
    """
    try:
        print(f"🏷️  Updating category for item {item_id} to '{new_category}'")

        user_list = grocery_col.find_one({"user": user})
        if not user_list:
            print("   ❌ User not found")
            return None

        items = user_list.get("items", [])

        # Find and update the item
        updated = False
        for item in items:
            if item["id"] == item_id:
                item["category"] = new_category
                updated = True
                print(f"   ✅ Updated '{item['name']}' to category '{new_category}'")
                break

        if not updated:
            print(f"   ❌ Item {item_id} not found")
            return None

        # Save back to database
        grocery_col.update_one(
            {"user": user},
            {"$set": {"items": items}}
        )

        # Return the updated item
        for item in items:
            if item["id"] == item_id:
                return item

        return None
    except Exception as e:
        print(f"❌ Error updating item category: {e}")
        return None
