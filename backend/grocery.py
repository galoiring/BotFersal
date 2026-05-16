# backend/grocery.py - Grocery list logic with fuzzy matching
from rapidfuzz import fuzz, process
import re
from typing import List, Dict, Tuple


def normalize_hebrew_text(text: str) -> str:
    """
    Normalize Hebrew text for matching
    - Remove nikud (Hebrew diacritics)
    - Remove apostrophes and geresh characters
    - Convert to lowercase
    - Strip whitespace
    """
    if not text:
        return ""

    # Remove nikud (Hebrew diacritics - Unicode range U+0591 to U+05C7)
    text = re.sub(r'[\u0591-\u05C7]', '', text)

    # Remove various apostrophe/geresh characters
    text = text.replace("'", "").replace("׳", "").replace("״", "").replace("'", "").replace("`", "")

    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)

    # Lowercase and strip
    return text.strip().lower()


def find_similar_items(
    query: str,
    existing_items: List[Dict],
    threshold: int = 80,
    limit: int = 8
) -> List[Dict]:
    """
    Find similar items using fuzzy matching

    Args:
        query: The search query
        existing_items: List of existing grocery items with 'name' and 'normalized_name'
        threshold: Minimum similarity score (0-100)
        limit: Maximum number of results

    Returns:
        List of matching items sorted by similarity score
    """
    if not query or not existing_items:
        return []

    # Normalize query
    normalized_query = normalize_hebrew_text(query)

    # Create a list of normalized names for matching
    normalized_names = [item.get('normalized_name', '') for item in existing_items]

    # Use rapidfuzz to find matches
    matches = process.extract(
        normalized_query,
        normalized_names,
        scorer=fuzz.ratio,
        limit=limit
    )

    # Filter by threshold and return original items with scores
    results = []
    for match_text, score, index in matches:
        if score >= threshold:
            item = existing_items[index].copy()
            item['similarity_score'] = score
            results.append(item)

    return results


def detect_duplicate(
    new_item_name: str,
    existing_items: List[Dict],
    strict_threshold: int = 90
) -> Tuple[bool, List[Dict]]:
    """
    Detect if a new item is a duplicate of existing items

    Args:
        new_item_name: Name of new item to check
        existing_items: List of existing items
        strict_threshold: Threshold for considering items as duplicates

    Returns:
        Tuple of (is_duplicate, list_of_potential_duplicates)
    """
    similar = find_similar_items(new_item_name, existing_items, threshold=strict_threshold, limit=5)

    is_duplicate = len(similar) > 0
    return is_duplicate, similar


def get_autocomplete_suggestions(
    query: str,
    master_items: List[Dict],
    current_list_items: List[Dict],
    max_suggestions: int = 8
) -> List[Dict]:
    """
    Get autocomplete suggestions based on query with improved ranking

    Prioritizes:
    1. Exact prefix matches (starts with)
    2. High similarity scores (70+)
    3. Items not currently in the list
    4. Items with higher usage count

    Args:
        query: User's input query
        master_items: User's historical items (with usage_count)
        current_list_items: Items currently in the list
        max_suggestions: Maximum number of suggestions

    Returns:
        List of suggested items with metadata, ranked by relevance
    """
    if not query or len(query) < 2:
        # If query is too short, return frequently used items not in current list
        current_names = {normalize_hebrew_text(item.get('name', '')) for item in current_list_items}

        suggestions = [
            item for item in master_items
            if item.get('normalized_name') not in current_names
        ]

        # Sort by usage count
        suggestions.sort(key=lambda x: x.get('usage_count', 0), reverse=True)
        return suggestions[:max_suggestions]

    # Normalize query for matching
    normalized_query = normalize_hebrew_text(query)

    # Get similar items from master list with higher threshold (75 instead of 60)
    similar = find_similar_items(query, master_items, threshold=70, limit=max_suggestions * 3)

    # Filter out items already in current list
    current_names = {normalize_hebrew_text(item.get('name', '')) for item in current_list_items}
    suggestions = [
        item for item in similar
        if item.get('normalized_name') not in current_names
    ]

    # Add bonus score for items that start with the query (prefix match)
    for item in suggestions:
        normalized_name = item.get('normalized_name', '')

        # Bonus for exact prefix match
        if normalized_name.startswith(normalized_query):
            item['prefix_match'] = True
            item['combined_score'] = item.get('similarity_score', 0) + 20  # Big bonus
        else:
            item['prefix_match'] = False
            item['combined_score'] = item.get('similarity_score', 0)

        # Add small bonus for usage count
        item['combined_score'] += min(item.get('usage_count', 0) * 0.5, 10)

    # Sort by combined score (prefix matches first, then by similarity + usage)
    suggestions.sort(
        key=lambda x: (x.get('prefix_match', False), x.get('combined_score', 0)),
        reverse=True
    )

    return suggestions[:max_suggestions]


def get_common_israeli_groceries() -> List[Dict]:
    """
    Get a comprehensive database of common Israeli grocery items
    These will be pre-populated for new users and help prevent typos
    """
    common_items = [
        # Dairy & Eggs
        {"name": "חלב", "category": "dairy"},
        {"name": "חלב 1%", "category": "dairy"},
        {"name": "חלב 3%", "category": "dairy"},
        {"name": "קוטג'", "category": "dairy"},
        {"name": "קוטג' 5%", "category": "dairy"},
        {"name": "קוטג' 9%", "category": "dairy"},
        {"name": "גבינה צהובה", "category": "dairy"},
        {"name": "גבינה צהובה פרוסה", "category": "dairy"},
        {"name": "גבינה לבנה", "category": "dairy"},
        {"name": "גבינה בולגרית", "category": "dairy"},
        {"name": "גבינת עיזים", "category": "dairy"},
        {"name": "מוצרלה", "category": "dairy"},
        {"name": "פרמזן", "category": "dairy"},
        {"name": "פטה", "category": "dairy"},
        {"name": "יוגורט", "category": "dairy"},
        {"name": "יוגורט יווני", "category": "dairy"},
        {"name": "יוגורט לשתייה", "category": "dairy"},
        {"name": "חמאה", "category": "dairy"},
        {"name": "מרגרינה", "category": "dairy"},
        {"name": "שמנת", "category": "dairy"},
        {"name": "שמנת חמוצה", "category": "dairy"},
        {"name": "שמנת מתוקה", "category": "dairy"},
        {"name": "ביצים", "category": "dairy"},
        {"name": "לבן", "category": "dairy"},
        {"name": "ביו", "category": "dairy"},
        {"name": "גבינת שמנת", "category": "dairy"},

        # Bakery
        {"name": "לחם", "category": "bakery"},
        {"name": "לחם פרוס", "category": "bakery"},
        {"name": "לחם שחור", "category": "bakery"},
        {"name": "לחם מחמצת", "category": "bakery"},
        {"name": "חלה", "category": "bakery"},
        {"name": "פיתה", "category": "bakery"},
        {"name": "לחמניות", "category": "bakery"},
        {"name": "בגט", "category": "bakery"},
        {"name": "לחם טוסט", "category": "bakery"},
        {"name": "לחם מלא", "category": "bakery"},
        {"name": "עוגיות", "category": "bakery"},
        {"name": "ביסקוויטים", "category": "bakery"},
        {"name": "קרקרים", "category": "bakery"},
        {"name": "טורטיה", "category": "bakery"},

        # Vegetables
        {"name": "עגבניות", "category": "vegetables"},
        {"name": "עגבניות שרי", "category": "vegetables"},
        {"name": "מלפפון", "category": "vegetables"},
        {"name": "חסה", "category": "vegetables"},
        {"name": "חסה לב", "category": "vegetables"},
        {"name": "חסה עלים", "category": "vegetables"},
        {"name": "בצל", "category": "vegetables"},
        {"name": "בצל ירוק", "category": "vegetables"},
        {"name": "שום", "category": "vegetables"},
        {"name": "פלפל", "category": "vegetables"},
        {"name": "פלפל אדום", "category": "vegetables"},
        {"name": "פלפל ירוק", "category": "vegetables"},
        {"name": "פלפל צהוב", "category": "vegetables"},
        {"name": "גזר", "category": "vegetables"},
        {"name": "תפוח אדמה", "category": "vegetables"},
        {"name": "בטטה", "category": "vegetables"},
        {"name": "כרוב", "category": "vegetables"},
        {"name": "כרובית", "category": "vegetables"},
        {"name": "ברוקולי", "category": "vegetables"},
        {"name": "קישוא", "category": "vegetables"},
        {"name": "חציל", "category": "vegetables"},
        {"name": "דלעת", "category": "vegetables"},
        {"name": "תירס", "category": "vegetables"},
        {"name": "פטריות", "category": "vegetables"},
        {"name": "כרישה", "category": "vegetables"},
        {"name": "סלרי", "category": "vegetables"},
        {"name": "פטרוזיליה", "category": "vegetables"},
        {"name": "כוסברה", "category": "vegetables"},
        {"name": "שמיר", "category": "vegetables"},
        {"name": "בזיליקום", "category": "vegetables"},
        {"name": "נענע", "category": "vegetables"},
        {"name": "חצילים", "category": "vegetables"},
        {"name": "אבוקדו", "category": "vegetables"},
        {"name": "זנגביל", "category": "vegetables"},

        # Fruits
        {"name": "תפוח", "category": "fruits"},
        {"name": "תפוחים", "category": "fruits"},
        {"name": "בננה", "category": "fruits"},
        {"name": "בננות", "category": "fruits"},
        {"name": "תפוז", "category": "fruits"},
        {"name": "תפוזים", "category": "fruits"},
        {"name": "קלמנטינה", "category": "fruits"},
        {"name": "ענבים", "category": "fruits"},
        {"name": "אבטיח", "category": "fruits"},
        {"name": "מלון", "category": "fruits"},
        {"name": "אגס", "category": "fruits"},
        {"name": "שזיף", "category": "fruits"},
        {"name": "אפרסק", "category": "fruits"},
        {"name": "נקטרינה", "category": "fruits"},
        {"name": "מנגו", "category": "fruits"},
        {"name": "אננס", "category": "fruits"},
        {"name": "קיווי", "category": "fruits"},
        {"name": "תותים", "category": "fruits"},
        {"name": "אוכמניות", "category": "fruits"},
        {"name": "רימון", "category": "fruits"},
        {"name": "דובדבנים", "category": "fruits"},
        {"name": "לימון", "category": "fruits"},
        {"name": "ליים", "category": "fruits"},
        {"name": "פומלה", "category": "fruits"},

        # Pantry - Grains & Pasta
        {"name": "אורז", "category": "pantry"},
        {"name": "אורז לבן", "category": "pantry"},
        {"name": "אורז מלא", "category": "pantry"},
        {"name": "אורז בסמטי", "category": "pantry"},
        {"name": "פסטה", "category": "pantry"},
        {"name": "ספגטי", "category": "pantry"},
        {"name": "מקרוני", "category": "pantry"},
        {"name": "פתיתים", "category": "pantry"},
        {"name": "פתיתי שיבולת שועל", "category": "pantry"},
        {"name": "קורנפלקס", "category": "pantry"},
        {"name": "גרנולה", "category": "pantry"},
        {"name": "קוסקוס", "category": "pantry"},
        {"name": "בורגול", "category": "pantry"},
        {"name": "קינואה", "category": "pantry"},
        {"name": "קמח", "category": "pantry"},
        {"name": "קמח לבן", "category": "pantry"},
        {"name": "קמח מלא", "category": "pantry"},

        # Pantry - Oils & Condiments
        {"name": "שמן", "category": "pantry"},
        {"name": "שמן זית", "category": "pantry"},
        {"name": "שמן קנולה", "category": "pantry"},
        {"name": "שמן חמניות", "category": "pantry"},
        {"name": "חומץ", "category": "pantry"},
        {"name": "חומץ בלסמי", "category": "pantry"},
        {"name": "רוטב סויה", "category": "pantry"},
        {"name": "רוטב טריאקי", "category": "pantry"},
        {"name": "קטשופ", "category": "pantry"},
        {"name": "מיונז", "category": "pantry"},
        {"name": "חרדל", "category": "pantry"},
        {"name": "טחינה", "category": "pantry"},
        {"name": "רוטב עגבניות", "category": "pantry"},
        {"name": "רסק עגבניות", "category": "pantry"},
        {"name": "עגבניות מרוסקות", "category": "pantry"},
        {"name": "ממרח שוקולד", "category": "pantry"},
        {"name": "דבש", "category": "pantry"},
        {"name": "ריבה", "category": "pantry"},

        # Pantry - Baking & Spices
        {"name": "סוכר", "category": "pantry"},
        {"name": "סוכר לבן", "category": "pantry"},
        {"name": "סוכר חום", "category": "pantry"},
        {"name": "מלח", "category": "pantry"},
        {"name": "פלפל שחור", "category": "pantry"},
        {"name": "פלפל אדום", "category": "pantry"},
        {"name": "כורכום", "category": "pantry"},
        {"name": "כמון", "category": "pantry"},
        {"name": "קארי", "category": "pantry"},
        {"name": "פפריקה", "category": "pantry"},
        {"name": "קינמון", "category": "pantry"},
        {"name": "אבקת סוכר", "category": "pantry"},
        {"name": "סודה לשתייה", "category": "pantry"},
        {"name": "אבקת אפייה", "category": "pantry"},
        {"name": "שמרים", "category": "pantry"},
        {"name": "וניל", "category": "pantry"},
        {"name": "אורגנו", "category": "pantry"},
        {"name": "בזיליקום יבש", "category": "pantry"},
        {"name": "שום כתוש", "category": "pantry"},
        {"name": "בצל כתוש", "category": "pantry"},

        # Canned & Preserved
        {"name": "תירס שימורים", "category": "canned"},
        {"name": "טונה", "category": "canned"},
        {"name": "שימורי עגבניות", "category": "canned"},
        {"name": "זיתים", "category": "canned"},
        {"name": "מלפפונים כבושים", "category": "canned"},
        {"name": "חומוס", "category": "canned"},
        {"name": "שעועית", "category": "canned"},
        {"name": "עדשים", "category": "canned"},
        {"name": "חומוס מבושל", "category": "canned"},

        # Meat & Protein
        {"name": "חזה עוף", "category": "meat"},
        {"name": "עוף שלם", "category": "meat"},
        {"name": "שוקיים", "category": "meat"},
        {"name": "כנפיים", "category": "meat"},
        {"name": "בשר טחון", "category": "meat"},
        {"name": "בשר בקר", "category": "meat"},
        {"name": "סטייק", "category": "meat"},
        {"name": "אנטריקוט", "category": "meat"},
        {"name": "נקניקיות", "category": "meat"},
        {"name": "נקניק", "category": "meat"},
        {"name": "נקניקיות עוף", "category": "meat"},
        {"name": "סלמי", "category": "meat"},
        {"name": "נקניק הודו", "category": "meat"},
        {"name": "פסטרמה", "category": "meat"},
        {"name": "שניצל", "category": "meat"},
        {"name": "קבב", "category": "meat"},
        {"name": "דגים", "category": "meat"},
        {"name": "סלמון", "category": "meat"},
        {"name": "דניס", "category": "meat"},
        {"name": "מוסר", "category": "meat"},

        # Drinks
        {"name": "מים", "category": "drinks"},
        {"name": "מים מינרלים", "category": "drinks"},
        {"name": "מים מוגזים", "category": "drinks"},
        {"name": "מיץ תפוזים", "category": "drinks"},
        {"name": "מיץ", "category": "drinks"},
        {"name": "מיץ תפוחים", "category": "drinks"},
        {"name": "קולה", "category": "drinks"},
        {"name": "קוקה קולה", "category": "drinks"},
        {"name": "ספרייט", "category": "drinks"},
        {"name": "פנטה", "category": "drinks"},
        {"name": "משקה אנרגיה", "category": "drinks"},
        {"name": "בירה", "category": "drinks"},
        {"name": "יין", "category": "drinks"},
        {"name": "קפה", "category": "drinks"},
        {"name": "קפה נמס", "category": "drinks"},
        {"name": "תה", "category": "drinks"},
        {"name": "תה ירוק", "category": "drinks"},
        {"name": "מיץ לימון", "category": "drinks"},

        # Snacks
        {"name": "במבה", "category": "snacks"},
        {"name": "ביסלי", "category": "snacks"},
        {"name": "צ'יפס", "category": "snacks"},
        {"name": "חטיף", "category": "snacks"},
        {"name": "פופקורן", "category": "snacks"},
        {"name": "שוקולד", "category": "snacks"},
        {"name": "חטיף גרנולה", "category": "snacks"},
        {"name": "אגוזים", "category": "snacks"},
        {"name": "בוטנים", "category": "snacks"},
        {"name": "שקדים", "category": "snacks"},
        {"name": "אגוזי קשיו", "category": "snacks"},
        {"name": "פיסטוק", "category": "snacks"},
        {"name": "צימוקים", "category": "snacks"},
        {"name": "תמרים", "category": "snacks"},
        {"name": "פירות יבשים", "category": "snacks"},

        # Frozen
        {"name": "גלידה", "category": "frozen"},
        {"name": "ירקות קפואים", "category": "frozen"},
        {"name": "פירות קפואים", "category": "frozen"},
        {"name": "פיצה קפואה", "category": "frozen"},
        {"name": "שניצל קפוא", "category": "frozen"},
        {"name": "נאגטס", "category": "frozen"},
        {"name": "בורקס", "category": "frozen"},
        {"name": "בצק עלים", "category": "frozen"},

        # Household & Cleaning
        {"name": "נייר טואלט", "category": "household"},
        {"name": "מגבות נייר", "category": "household"},
        {"name": "נייר אפייה", "category": "household"},
        {"name": "נייר כסף", "category": "household"},
        {"name": "שקיות אשפה", "category": "household"},
        {"name": "שקיות הקפאה", "category": "household"},
        {"name": "שקיות כריכים", "category": "household"},
        {"name": "נרות", "category": "household"},
        {"name": "סבון כלים", "category": "household"},
        {"name": "נוזל כלים", "category": "household"},
        {"name": "אבקת כביסה", "category": "household"},
        {"name": "מרכך כביסה", "category": "household"},
        {"name": "אקונומיקה", "category": "household"},
        {"name": "מי רצפה", "category": "household"},
        {"name": "סבון רחצה", "category": "household"},
        {"name": "שמפו", "category": "household"},
        {"name": "מרכך שיער", "category": "household"},
        {"name": "משחת שיניים", "category": "household"},
        {"name": "מברשת שיניים", "category": "household"},
        {"name": "דאודורנט", "category": "household"},

        # Baby & Kids
        {"name": "חיתולים", "category": "baby"},
        {"name": "מגבונים", "category": "baby"},
        {"name": "משחת ישבן", "category": "baby"},
        {"name": "מזון לתינוק", "category": "baby"},

        # Pet Food
        {"name": "אוכל לכלב", "category": "pets"},
        {"name": "אוכל לחתול", "category": "pets"},
        {"name": "חול לחתול", "category": "pets"},
    ]

    # Normalize all items
    for item in common_items:
        item['normalized_name'] = normalize_hebrew_text(item['name'])
        # Set usage_count to give priority to more common items
        item['usage_count'] = 0

    return common_items
