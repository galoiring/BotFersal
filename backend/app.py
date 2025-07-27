# backend/app.py - Enhanced FastAPI backend
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
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

# Catch-all for React routing


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
