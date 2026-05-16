# backend/app.py - Enhanced FastAPI backend
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
import os
import asyncio
import logging
from datetime import datetime, timedelta
import uvicorn
from pathlib import Path
from datetime import datetime, timedelta
import dateutil.parser

# Import your existing modules
import mongo
import tenbis_report
import generate_barcode
from email_processor import CibusEmailProcessor
import appSettings as appSet
import grocery

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="BotFersal API",
    description="Modern voucher management API with Apple-style design",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve React build files
if os.path.exists("build"):
    app.mount("/static", StaticFiles(directory="build/static"), name="static")

# Enhanced data models


class VoucherRequest(BaseModel):
    amount: str = Field(..., description="Voucher amount")
    user: str = Field(..., description="Username")


class ScanRequest(BaseModel):
    user: str = Field(..., description="Username")
    scan_type: str = Field(..., description="Type of scan: 10bis or cibus")


class GroceryItemRequest(BaseModel):
    user: str = Field(..., description="Username")
    name: str = Field(..., description="Item name")
    category: Optional[str] = Field(None, description="Item category")


class GroceryToggleRequest(BaseModel):
    user: str = Field(..., description="Username")
    item_id: str = Field(..., description="Item ID")


class GrocerySuggestRequest(BaseModel):
    user: str = Field(..., description="Username")
    query: str = Field(..., description="Search query for suggestions")


class ScanResponse(BaseModel):
    success: bool
    added_count: int = 0
    total_amount: float = 0.0
    message: str
    scan_duration: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class VoucherResponse(BaseModel):
    barcode: str
    amount: str
    expiry_date: str
    is_used: bool = False
    date_added: datetime
    source: Optional[str] = None


class VoucherCounts(BaseModel):
    vouchers: Dict[str, int]
    total_value: int
    total_count: int
    last_updated: datetime = Field(default_factory=datetime.now)


class ApiResponse(BaseModel):
    success: bool
    data: Optional[Dict] = None
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)

# Authentication and user management


def verify_user(username: str = "jewbaca1"):
    """Simple user verification"""
    if username not in appSet.user_name:
        raise HTTPException(
            status_code=401,
            detail={"error": "Unauthorized", "message": "User not found"}
        )
    return username


def create_api_response(success: bool, data: any = None, message: str = None) -> JSONResponse:
    """Create standardized API response"""
    return JSONResponse({
        "success": success,
        "data": data,
        "message": message,
        "timestamp": datetime.now().isoformat()
    })


def safe_format_date(date_obj):
    """Safely format date regardless of its type"""
    if date_obj is None:
        return None

    # If it's already a string, return as is
    if isinstance(date_obj, str):
        try:
            # Try to parse it as a date and reformat
            parsed_date = dateutil.parser.parse(date_obj)
            return parsed_date.strftime('%Y-%m-%d')
        except:
            # If parsing fails, return the string as is
            return date_obj

    # If it's a datetime object, format it
    if hasattr(date_obj, 'strftime'):
        return date_obj.strftime('%Y-%m-%d')

    # If it's some other type, convert to string
    return str(date_obj)


def safe_format_datetime(date_obj):
    """Safely format datetime regardless of its type"""
    if date_obj is None:
        return None

    # If it's already a string, return as is
    if isinstance(date_obj, str):
        try:
            # Try to parse it as a datetime and reformat
            parsed_date = dateutil.parser.parse(date_obj)
            return parsed_date.isoformat()
        except:
            # If parsing fails, return the string as is
            return date_obj

    # If it's a datetime object, format it
    if hasattr(date_obj, 'isoformat'):
        return date_obj.isoformat()

    # If it's some other type, convert to string
    return str(date_obj)

# Health and status endpoints


@app.get("/api/health")
async def health_check():
    """Comprehensive health check"""
    try:
        # Test MongoDB connection
        mongo_status = "connected"
        try:
            result = mongo.check_how_much_money()
            mongo_status = "connected"
        except Exception as e:
            mongo_status = f"error: {str(e)}"

        return create_api_response(True, {
            "status": "healthy",
            "version": "2.0.0",
            "services": {
                "mongodb": mongo_status,
                "api": "running"
            },
            "uptime": "running"
        })
    except Exception as e:
        return create_api_response(False, None, f"Health check failed: {str(e)}")


@app.get("/api/status")
async def get_system_status():
    """Get detailed system status"""
    try:
        voucher_counts = mongo.check_how_much_money()
        total_value = mongo.coupons_sum(voucher_counts)

        return create_api_response(True, {
            "vouchers": voucher_counts,
            "total_value": total_value,
            "system_time": datetime.now().isoformat(),
            "database_status": "connected"
        })
    except Exception as e:
        logger.error(f"Status check error: {e}")
        return create_api_response(False, None, f"Status check failed: {str(e)}")

# Voucher management endpoints


@app.get("/api/vouchers/count")
async def get_voucher_counts(user: str = "jewbaca1") -> JSONResponse:
    """Get count of vouchers by amount with enhanced data"""
    try:
        logger.info(f"Getting voucher counts for user: {user}")

        # Get real data from MongoDB
        result = mongo.check_how_much_money()
        total_value = mongo.coupons_sum(result)
        total_count = sum(result.values())

        logger.info(f"Raw MongoDB result: {result}")
        logger.info(f"Total value: {total_value}, Total count: {total_count}")

        return JSONResponse({
            "success": True,
            "data": {
                "vouchers": result,
                "total_value": total_value,
                "total_count": total_count,
                "amounts_available": [amount for amount, count in result.items() if count > 0],
                "last_updated": datetime.now().isoformat()
            },
            "message": "Vouchers loaded successfully",
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Get voucher counts error: {e}")
        return JSONResponse({
            "success": False,
            "data": None,
            "message": f"Error loading vouchers: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }, status_code=500)


@app.post("/api/vouchers/get")
async def get_voucher(request: VoucherRequest) -> JSONResponse:
    """Get a specific voucher with enhanced validation and fixed date handling"""
    try:
        logger.info(
            f"Getting voucher for amount: {request.amount}, user: {request.user}")

        barcode_data = mongo.find_barcode(request.amount)

        if not barcode_data:
            logger.warning(f"No voucher found for amount: {request.amount}")
            return JSONResponse({
                "success": False,
                "data": None,
                "message": f"לא נמצא שובר זמין על סך {request.amount}₪",
                "timestamp": datetime.now().isoformat()
            }, status_code=404)

        # Convert to Shovar object
        shovar = mongo.convert_mongo_to_shovar(barcode_data)

        logger.info(
            f"Found voucher: {shovar.code} for amount: {request.amount}")
        logger.info(
            f"Voucher expiry_date type: {type(shovar.expiry_date)}, value: {shovar.expiry_date}")
        logger.info(
            f"Voucher date_added type: {type(shovar.date_added)}, value: {shovar.date_added}")

        return JSONResponse({
            "success": True,
            "data": {
                "barcode": shovar.code,
                "amount": shovar.amount,
                "expiry_date": safe_format_date(shovar.expiry_date),
                "is_used": shovar.is_used,
                "date_added": safe_format_datetime(shovar.date_added),
                "source": barcode_data.get("source", "10bis")
            },
            "message": "Voucher retrieved successfully",
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Get voucher error: {e}")
        logger.error(f"Error details: {type(e).__name__}: {str(e)}")
        return JSONResponse({
            "success": False,
            "data": None,
            "message": f"שגיאה בקבלת השובר: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }, status_code=500)


@app.post("/api/vouchers/use")
async def use_voucher(request: VoucherRequest) -> JSONResponse:
    """Mark a voucher as used with audit trail"""
    try:
        barcode_data = mongo.find_barcode(request.amount)

        if not barcode_data:
            return create_api_response(False, None, "שובר לא נמצא או כבר בשימוש")

        shovar = mongo.convert_mongo_to_shovar(barcode_data)
        mongo.update_db(shovar)

        logger.info(
            f"Voucher used - Amount: {request.amount}, User: {request.user}, Barcode: {shovar.code}")

        return create_api_response(True, {
            "amount": request.amount,
            "barcode": shovar.code,
            "used_at": datetime.now().isoformat()
        }, "השובר סומן כמשומש בהצלחה")

    except Exception as e:
        logger.error(f"Use voucher error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Scanning endpoints


@app.post("/api/scan/10bis")
async def scan_10bis(background_tasks: BackgroundTasks, user: str = Depends(verify_user)) -> JSONResponse:
    """Enhanced 10bis scanning with background processing"""
    try:
        # For now, return info about manual process
        return create_api_response(False, {
            "scan_type": "10bis",
            "requires_manual": True,
            "instructions": "סריקת 10bis דורשת הזנת קוד אימות ידנית. השתמש בבוט הטלגרם לסריקה."
        }, "סריקת 10bis דורשת אימות ידני")

    except Exception as e:
        logger.error(f"10bis scan error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scan/cibus")
async def scan_cibus(background_tasks: BackgroundTasks, user: str = Depends(verify_user)) -> JSONResponse:
    """Enhanced Cibus email scanning"""
    start_time = datetime.now()
    try:
        logger.info(f"Starting Cibus scan for user: {user}")

        added_count, total_amount = mongo.scan_cibus_emails()
        scan_duration = (datetime.now() - start_time).total_seconds()

        logger.info(
            f"Cibus scan completed - Added: {added_count}, Amount: {total_amount}, Duration: {scan_duration}s")

        if added_count > 0:
            message = f"נמצאו {added_count} שוברי Cibus חדשים בשווי {total_amount:.0f}₪"
        else:
            message = "לא נמצאו שוברי Cibus חדשים"

        return create_api_response(True, {
            "scan_type": "cibus",
            "added_count": added_count,
            "total_amount": total_amount,
            "scan_duration": scan_duration,
            "scan_completed_at": datetime.now().isoformat()
        }, message)

    except Exception as e:
        scan_duration = (datetime.now() - start_time).total_seconds()
        logger.error(f"Cibus scan error after {scan_duration}s: {e}")
        raise HTTPException(
            status_code=500, detail=f"שגיאה בסריקת Cibus: {str(e)}")

# Barcode generation


@app.get("/api/barcode/{barcode_text}")
async def get_barcode_image(barcode_text: str):
    """Generate and return barcode image with caching"""
    try:
        # Check if barcode exists in database
        barcode_exists = mongo.check_if_exist(barcode_text)
        if not barcode_exists:
            raise HTTPException(
                status_code=404, detail="Barcode not found in database")

        image = generate_barcode.generate_barcode(barcode_text)

        # Save temporarily
        temp_path = f"temp_barcode_{barcode_text}.png"
        image.save(temp_path)

        return FileResponse(
            temp_path,
            media_type="image/png",
            filename=f"voucher_{barcode_text}.png",
            # Cache for 1 hour
            headers={"Cache-Control": "public, max-age=3600"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Barcode generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Analytics and reporting


@app.get("/api/analytics/summary")
async def get_analytics_summary(user: str = Depends(verify_user)) -> JSONResponse:
    """Get voucher analytics summary"""
    try:
        voucher_counts = mongo.check_how_much_money()
        total_value = mongo.coupons_sum(voucher_counts)

        # Calculate additional metrics
        amounts = [int(k) for k in voucher_counts.keys()]
        avg_voucher_value = sum(int(
            k) * v for k, v in voucher_counts.items()) / max(sum(voucher_counts.values()), 1)

        return create_api_response(True, {
            "total_vouchers": sum(voucher_counts.values()),
            "total_value": total_value,
            "average_voucher_value": round(avg_voucher_value, 2),
            "min_amount": min(amounts) if amounts else 0,
            "max_amount": max(amounts) if amounts else 0,
            "distribution": voucher_counts,
            "last_calculated": datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# PWA endpoints


@app.get("/manifest.json")
async def get_manifest():
    """PWA manifest with RTL support"""
    return {
        "name": "BotFersal - ניהול שוברים",
        "short_name": "BotFersal",
        "description": "אפליקציה מתקדמת לניהול שוברי 10bis ו-Cibus",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#f5f7fa",
        "theme_color": "#667eea",
        "orientation": "portrait-primary",
        "scope": "/",
        "lang": "he",
        "dir": "rtl",
        "categories": ["finance", "utilities", "productivity"],
        "icons": [
            {
                "src": "/icon-192x192.png",
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "maskable any"
            },
            {
                "src": "/icon-512x512.png",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "maskable any"
            }
        ],
        "shortcuts": [
            {
                "name": "סריקת שוברים",
                "url": "/?action=scan",
                "icons": [{"src": "/icon-192x192.png", "sizes": "192x192"}]
            }
        ]
    }

# Serve React app


@app.get("/")
async def serve_app():
    """Serve the React PWA"""
    if os.path.exists("build/index.html"):
        return FileResponse("build/index.html")
    else:
        return HTMLResponse("""
        <html>
            <head><title>BotFersal</title></head>
            <body>
                <h1>BotFersal API</h1>
                <p>React app not built yet. Please run: npm run build</p>
                <p><a href="/api/docs">API Documentation</a></p>
            </body>
        </html>
        """)

# PWA and static file routes (must be before catch-all)
@app.get("/favicon.ico")
async def favicon():
    """Serve favicon"""
    if os.path.exists("build/favicon.ico"):
        return FileResponse("build/favicon.ico", media_type="image/x-icon")
    raise HTTPException(status_code=404, detail="Favicon not found")

@app.get("/icon-192.png")
async def icon_192():
    """Serve 192x192 PWA icon"""
    if os.path.exists("build/icon-192.png"):
        return FileResponse("build/icon-192.png", media_type="image/png")
    raise HTTPException(status_code=404, detail="Icon not found")

@app.get("/icon-512.png")
async def icon_512():
    """Serve 512x512 PWA icon"""
    if os.path.exists("build/icon-512.png"):
        return FileResponse("build/icon-512.png", media_type="image/png")
    raise HTTPException(status_code=404, detail="Icon not found")

@app.get("/apple-touch-icon.png")
async def apple_touch_icon():
    """Serve Apple touch icon"""
    if os.path.exists("build/apple-touch-icon.png"):
        return FileResponse("build/apple-touch-icon.png", media_type="image/png")
    raise HTTPException(status_code=404, detail="Apple touch icon not found")

@app.get("/manifest.json")
async def manifest():
    """Serve PWA manifest"""
    if os.path.exists("build/manifest.json"):
        return FileResponse("build/manifest.json", media_type="application/json")
    raise HTTPException(status_code=404, detail="Manifest not found")

@app.get("/robots.txt")
async def robots():
    """Serve robots.txt"""
    if os.path.exists("build/robots.txt"):
        return FileResponse("build/robots.txt", media_type="text/plain")
    raise HTTPException(status_code=404, detail="Robots.txt not found")

# ============================================================================
# GROCERY LIST ENDPOINTS
# ============================================================================

@app.get("/api/grocery/list")
async def get_grocery_list_endpoint(user: str = "jewbaca1") -> JSONResponse:
    """Get user's grocery list"""
    try:
        logger.info(f"Getting grocery list for user: {user}")
        user_list = mongo.get_grocery_list(user)

        # Convert datetime objects to ISO strings for JSON serialization
        items = user_list.get("items", [])
        for item in items:
            if "added_at" in item and hasattr(item["added_at"], "isoformat"):
                item["added_at"] = item["added_at"].isoformat()

        return create_api_response(True, {
            "items": items,
            "total_count": len(items),
            "checked_count": sum(1 for item in items if item.get("is_checked", False))
        }, "Grocery list loaded successfully")
    except Exception as e:
        logger.error(f"Get grocery list error: {e}")
        return create_api_response(False, None, f"Error loading grocery list: {str(e)}")


@app.post("/api/grocery/add")
async def add_grocery_item_endpoint(request: GroceryItemRequest) -> JSONResponse:
    """Add item to grocery list with duplicate detection"""
    try:
        logger.info(f"Adding grocery item: {request.name} for user: {request.user}")

        result = mongo.add_grocery_item(request.user, request.name, request.category)

        if result:
            # Check if it's a duplicate
            if isinstance(result, dict) and result.get("duplicate"):
                existing_item = result["item"]
                # Convert datetime to ISO string
                if "added_at" in existing_item and hasattr(existing_item["added_at"], "isoformat"):
                    existing_item["added_at"] = existing_item["added_at"].isoformat()

                if result.get("unchecked"):
                    return create_api_response(True, {
                        "item": existing_item,
                        "duplicate": True,
                        "unchecked": True
                    }, f"'{existing_item['name']}' was already in your list (checked off). We unchecked it for you!")
                else:
                    return create_api_response(False, {
                        "item": existing_item,
                        "duplicate": True,
                        "unchecked": False
                    }, f"'{existing_item['name']}' is already in your list!")
            else:
                # New item added successfully
                # Convert datetime to ISO string
                if "added_at" in result and hasattr(result["added_at"], "isoformat"):
                    result["added_at"] = result["added_at"].isoformat()

                return create_api_response(True, {"item": result}, "Item added successfully")
        else:
            return create_api_response(False, None, "Failed to add item")
    except Exception as e:
        logger.error(f"Add grocery item error: {e}")
        return create_api_response(False, None, f"Error adding item: {str(e)}")


@app.post("/api/grocery/toggle")
async def toggle_grocery_item_endpoint(request: GroceryToggleRequest) -> JSONResponse:
    """Toggle item checked status"""
    try:
        logger.info(f"Toggling grocery item: {request.item_id} for user: {request.user}")

        success = mongo.toggle_grocery_item(request.user, request.item_id)

        if success:
            return create_api_response(True, {"item_id": request.item_id}, "Item toggled successfully")
        else:
            return create_api_response(False, None, "Item not found")
    except Exception as e:
        logger.error(f"Toggle grocery item error: {e}")
        return create_api_response(False, None, f"Error toggling item: {str(e)}")


@app.delete("/api/grocery/item/{item_id}")
async def delete_grocery_item_endpoint(item_id: str, user: str = "jewbaca1") -> JSONResponse:
    """Delete item from grocery list"""
    try:
        logger.info(f"Deleting grocery item: {item_id} for user: {user}")

        success = mongo.delete_grocery_item(user, item_id)

        if success:
            return create_api_response(True, {"item_id": item_id}, "Item deleted successfully")
        else:
            return create_api_response(False, None, "Item not found")
    except Exception as e:
        logger.error(f"Delete grocery item error: {e}")
        return create_api_response(False, None, f"Error deleting item: {str(e)}")


@app.post("/api/grocery/clear-checked")
async def clear_checked_items_endpoint(user: str = "jewbaca1") -> JSONResponse:
    """Clear all checked items"""
    try:
        logger.info(f"Clearing checked items for user: {user}")

        success = mongo.clear_checked_items(user)

        if success:
            return create_api_response(True, None, "Checked items cleared successfully")
        else:
            return create_api_response(False, None, "Failed to clear items")
    except Exception as e:
        logger.error(f"Clear checked items error: {e}")
        return create_api_response(False, None, f"Error clearing items: {str(e)}")


@app.get("/api/grocery/history")
async def get_grocery_history_endpoint(user: str = "jewbaca1") -> JSONResponse:
    """Get user's grocery shopping history"""
    try:
        logger.info(f"Getting grocery history for user: {user}")

        history = mongo.get_user_grocery_history(user)

        return create_api_response(True, {
            "history": history,
            "total_unique_items": len(history)
        }, "Grocery history loaded successfully")
    except Exception as e:
        logger.error(f"Get grocery history error: {e}")
        return create_api_response(False, None, f"Error loading history: {str(e)}")


@app.post("/api/grocery/suggest")
async def get_grocery_suggestions_endpoint(request: GrocerySuggestRequest) -> JSONResponse:
    """Get autocomplete suggestions for grocery items"""
    try:
        import time
        start_time = time.time()

        logger.info(f"Getting suggestions for query: '{request.query}' for user: {request.user}")

        # Get user's master items (history)
        user_list = mongo.get_grocery_list(request.user)
        master_items = user_list.get("master_items", [])
        current_items = user_list.get("items", [])

        # Get common Israeli groceries
        common_items = grocery.get_common_israeli_groceries()

        # Combine master_items with common items for better suggestions
        all_items = master_items + common_items

        # Remove duplicates by normalized name
        seen_normalized = set()
        unique_items = []
        for item in all_items:
            normalized = item.get("normalized_name", mongo.normalize_hebrew_text(item.get("name", "")))
            if normalized not in seen_normalized:
                seen_normalized.add(normalized)
                unique_items.append(item)

        # Get suggestions using combined dataset
        if len(request.query) >= 2:
            suggestions = grocery.get_autocomplete_suggestions(
                request.query,
                unique_items,
                current_items,
                max_suggestions=8
            )
        else:
            # For very short queries, show recent history + common items
            suggestions = unique_items[:8]

        elapsed_time = (time.time() - start_time) * 1000  # Convert to ms

        logger.info(f"Found {len(suggestions)} suggestions in {elapsed_time:.2f}ms")

        return create_api_response(True, {
            "suggestions": [item.get("name") for item in suggestions],
            "suggestions_detailed": suggestions[:8],  # Include metadata for debugging
            "response_time_ms": round(elapsed_time, 2)
        }, f"Found {len(suggestions)} suggestions")

    except Exception as e:
        logger.error(f"Get suggestions error: {e}")
        return create_api_response(False, None, f"Error getting suggestions: {str(e)}")


@app.post("/api/grocery/clean-history")
async def clean_grocery_history_endpoint(user: str = "jewbaca1") -> JSONResponse:
    """Clean up purchase history by removing typos and rarely used items"""
    try:
        logger.info(f"Cleaning grocery history for user: {user}")

        removed_count = mongo.clean_master_items(user)

        if removed_count > 0:
            return create_api_response(True, {
                "removed_count": removed_count
            }, f"Cleaned {removed_count} items from purchase history")
        else:
            return create_api_response(True, {
                "removed_count": 0
            }, "No items to clean - your history looks good!")

    except Exception as e:
        logger.error(f"Clean history error: {e}")
        return create_api_response(False, None, f"Error cleaning history: {str(e)}")


@app.patch("/api/grocery/item/{item_id}/category")
async def update_item_category_endpoint(
    item_id: str,
    request: Request,
    user: str = "jewbaca1"
) -> JSONResponse:
    """Update the category of a grocery item"""
    try:
        body = await request.json()
        new_category = body.get("category")

        if not new_category:
            return create_api_response(False, None, "Category is required")

        logger.info(f"Updating item {item_id} to category '{new_category}' for user: {user}")

        updated_item = mongo.update_grocery_item_category(user, item_id, new_category)

        if updated_item:
            return create_api_response(True, {
                "item": updated_item
            }, f"Category updated to '{new_category}'")
        else:
            return create_api_response(False, None, "Item not found")

    except Exception as e:
        logger.error(f"Update category error: {e}")
        return create_api_response(False, None, f"Error updating category: {str(e)}")


# Catch-all for React routing (must be last)
@app.get("/{path:path}")
async def serve_spa(path: str):
    """Serve React app for all routes"""
    if os.path.exists("build/index.html") and not path.startswith("api/"):
        return FileResponse("build/index.html")
    else:
        raise HTTPException(status_code=404, detail="Not found")

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
