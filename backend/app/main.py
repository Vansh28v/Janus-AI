from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.forecasts import router as forecasts_router
from app.api.routes.inventory import router as inventory_router
from app.api.routes.suppliers import router as suppliers_router
from app.api.routes.optimization import router as optimization_router
from app.api.routes.scenarios import router as scenarios_router
from app.api.routes.data_intelligence import router as data_intelligence_router
from app.api.routes.dataset_lifecycle import router as dataset_lifecycle_router
from app.api.routes.workspace_status import router as workspace_status_router
from app.core.workspace_access import workspace_access_middleware


app = FastAPI(
    title="GridStock AI API",
    description=(
        "AI-powered material demand forecasting "
        "and inventory optimization for power utilities."
    ),
    version="1.0.0",
)

# API routers
app.include_router(forecasts_router)
app.include_router(inventory_router)
app.include_router(optimization_router)
app.include_router(suppliers_router)
app.include_router(scenarios_router)
app.include_router(data_intelligence_router)
app.include_router(dataset_lifecycle_router)
app.include_router(workspace_status_router)

# Enforce active-dataset workspace access permissions
app.middleware("http")(workspace_access_middleware)

# Allow the Next.js frontend to communicate with this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:3000",
    "https://janus-ai-lyart.vercel.app",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "project": "GridStock AI",
        "message": "Powering smarter utility inventory decisions.",
        "status": "operational",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "GridStock AI Backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
