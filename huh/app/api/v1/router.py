from fastapi import APIRouter

from app.api.v1.endpoints import health, retinopathy


router = APIRouter()

router.include_router(
    health.router,
    tags=["Health"],
)

router.include_router(
    retinopathy.router,
    prefix="/retinopathy",
    tags=["Retinopathy"],
)