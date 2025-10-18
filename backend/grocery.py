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
    Get autocomplete suggestions based on query

    Prioritizes:
    1. Items not currently in the list
    2. Items with higher usage count
    3. Better similarity matches

    Args:
        query: User's input query
        master_items: User's historical items (with usage_count)
        current_list_items: Items currently in the list
        max_suggestions: Maximum number of suggestions

    Returns:
        List of suggested items with metadata
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

    # Get similar items from master list
    similar = find_similar_items(query, master_items, threshold=60, limit=max_suggestions * 2)

    # Filter out items already in current list
    current_names = {normalize_hebrew_text(item.get('name', '')) for item in current_list_items}
    suggestions = [
        item for item in similar
        if item.get('normalized_name') not in current_names
    ]

    # Sort by similarity score and then usage count
    suggestions.sort(
        key=lambda x: (x.get('similarity_score', 0), x.get('usage_count', 0)),
        reverse=True
    )

    return suggestions[:max_suggestions]


def get_common_israeli_groceries() -> List[Dict]:
    """
    Get a starter database of common Israeli grocery items
    These will be pre-populated for new users
    """
    common_items = [
        # Dairy
        {"name": "חלב", "category": "dairy", "aliases": ["חלב טרי", "milk"]},
        {"name": "קוטג'", "category": "dairy", "aliases": ["קוטג", "קוטג׳", "cottage"]},
        {"name": "גבינה צהובה", "category": "dairy", "aliases": ["גבינה", "גבינה צהובה פרוסה"]},
        {"name": "גבינה לבנה", "category": "dairy", "aliases": ["גבינה רכה"]},
        {"name": "יוגורט", "category": "dairy", "aliases": ["יוגורט טבעי"]},
        {"name": "חמאה", "category": "dairy", "aliases": ["חמאה טרייה"]},
        {"name": "שמנת", "category": "dairy", "aliases": ["שמנת חמוצה", "שמנת מתוקה"]},
        {"name": "ביצים", "category": "dairy", "aliases": ["ביצים טריות"]},

        # Bakery
        {"name": "לחם", "category": "bakery", "aliases": ["לחם פרוס", "לחם שחור", "לחם מחמצת"]},
        {"name": "חלה", "category": "bakery", "aliases": ["חלת שבת"]},
        {"name": "פיתה", "category": "bakery", "aliases": ["פיתות"]},
        {"name": "לחמניות", "category": "bakery", "aliases": ["לחמניה"]},

        # Vegetables
        {"name": "עגבניות", "category": "vegetables", "aliases": ["עגבניה", "עגבניות שרי"]},
        {"name": "מלפפון", "category": "vegetables", "aliases": ["מלפפונים"]},
        {"name": "חסה", "category": "vegetables", "aliases": ["חסה לב"]},
        {"name": "בצל", "category": "vegetables", "aliases": ["בצל יבש"]},
        {"name": "שום", "category": "vegetables", "aliases": ["שום יבש"]},
        {"name": "פלפל", "category": "vegetables", "aliases": ["פלפל אדום", "פלפל ירוק"]},
        {"name": "גזר", "category": "vegetables", "aliases": ["גזר טרי"]},
        {"name": "תפוח אדמה", "category": "vegetables", "aliases": ["תפוחי אדמה"]},

        # Fruits
        {"name": "תפוח", "category": "fruits", "aliases": ["תפוחים"]},
        {"name": "בננה", "category": "fruits", "aliases": ["בננות"]},
        {"name": "תפוז", "category": "fruits", "aliases": ["תפוזים"]},
        {"name": "ענבים", "category": "fruits", "aliases": ["ענבים ירוקים", "ענבים שחורים"]},
        {"name": "אבטיח", "category": "fruits", "aliases": []},

        # Pantry
        {"name": "אורז", "category": "pantry", "aliases": ["אורז לבן", "אורז מלא"]},
        {"name": "פסטה", "category": "pantry", "aliases": ["פסטה ספגטי", "מקרוני"]},
        {"name": "שמן", "category": "pantry", "aliases": ["שמן זית", "שמן קנולה"]},
        {"name": "קמח", "category": "pantry", "aliases": ["קמח לבן", "קמח מלא"]},
        {"name": "סוכר", "category": "pantry", "aliases": ["סוכר לבן"]},
        {"name": "מלח", "category": "pantry", "aliases": []},
        {"name": "פלפל שחור", "category": "pantry", "aliases": ["פלפל"]},
        {"name": "רוטב עגבניות", "category": "pantry", "aliases": ["רסק עגבניות"]},

        # Meat & Protein
        {"name": "חזה עוף", "category": "meat", "aliases": ["חזה עוף טרי"]},
        {"name": "בשר טחון", "category": "meat", "aliases": ["בשר טחון עגל"]},
        {"name": "נקניקיות", "category": "meat", "aliases": ["נקניקיה"]},

        # Drinks
        {"name": "מים מינרלים", "category": "drinks", "aliases": ["מים", "בקבוק מים"]},
        {"name": "מיץ תפוזים", "category": "drinks", "aliases": ["מיץ", "מיץ טבעי"]},
        {"name": "קולה", "category": "drinks", "aliases": ["קוקה קולה"]},

        # Frozen
        {"name": "גלידה", "category": "frozen", "aliases": []},
        {"name": "ירקות קפואים", "category": "frozen", "aliases": ["ירקות מעורבים קפואים"]},
    ]

    # Normalize all items
    for item in common_items:
        item['normalized_name'] = normalize_hebrew_text(item['name'])

    return common_items
