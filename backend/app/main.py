from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from .config import settings
from .routes_auth import router as auth_router
# 架構瘦身：移除 Order/WorkOrder 相關 routes
# from .routes_orders import router as orders_router
# from .routes_work_orders import router as wo_router
from .routes_products import router as products_router
from .routes_inventory import router as inventory_router
from .routes_purchase_orders import router as po_router
from .routes_sales_orders import router as so_router
from .routes_return_orders import router as return_orders_router
from .routes_customers import router as customers_router
from .routes_production_reports import router as pr_router
from .routes_production_reports_reports import router as pr_reports_router
from .routes_production_reports_export import router as pr_export_router
from .routes_production_kpi import router as production_kpi_router
from .routes_users import router as users_router
from .routes_bom import router as bom_router
from .routes_fg_kit import router as fg_kit_router
from .routes_sales_reports import router as sales_reports_router
from .routes_print_jobs import router as print_jobs_router
import traceback

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers - order matters: more specific handlers first
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions and ensure CORS headers are included"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors and ensure CORS headers are included"""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

# Global exception handler for unhandled exceptions - ensure CORS headers are always set
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions and ensure CORS headers are included"""
    traceback.print_exc()
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

app.include_router(auth_router)
# 架構瘦身：移除 Order/WorkOrder 相關 routes
# app.include_router(orders_router)
# app.include_router(wo_router)
app.include_router(products_router)
app.include_router(inventory_router)
app.include_router(po_router)
app.include_router(so_router)
app.include_router(return_orders_router)
app.include_router(customers_router)
app.include_router(pr_router)
app.include_router(pr_reports_router)
app.include_router(pr_export_router)
app.include_router(production_kpi_router)
app.include_router(users_router)
app.include_router(bom_router)
app.include_router(fg_kit_router)
app.include_router(sales_reports_router)
app.include_router(print_jobs_router)

@app.get("/health")
def health():
    return {"ok": True}

