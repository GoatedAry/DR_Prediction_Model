from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.retinopathy_scan import RetinopathyScan
from app.services.ml_service import predict_retinopathy
from app.services.storage import (
    create_signed_image_url,
    download_retinal_image,
    upload_retinal_image,
)


router = APIRouter()


@router.post("/upload")
async def upload_retinal_image_endpoint(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        storage_path = await upload_retinal_image(file)

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    scan = RetinopathyScan(
        image_path=storage_path,
        status="uploaded",
    )

    db.add(scan)
    db.commit()
    db.refresh(scan)

    return {
        "status": "uploaded",
        "scan_id": str(scan.id),
        "storage_path": scan.image_path,
    }


@router.get("")
def get_retinopathy_history(
    db: Session = Depends(get_db),
):
    scans = (
        db.query(RetinopathyScan)
        .order_by(RetinopathyScan.created_at.desc())
        .all()
    )

    return [
        {
            "scan_id": str(scan.id),
            "status": scan.status,
            "image_path": scan.image_path,
            "prediction": scan.prediction,
            "confidence": scan.confidence,
            "created_at": scan.created_at,
        }
        for scan in scans
    ]




@router.post("/predict/{scan_id}")
def predict_scan(
    scan_id: UUID,
    db: Session = Depends(get_db),
):
    scan = (
        db.query(RetinopathyScan)
        .filter(RetinopathyScan.id == scan_id)
        .first()
    )

    if scan is None:
        raise HTTPException(
            status_code=404,
            detail="Scan not found",
        )

    try:
        image_bytes = download_retinal_image(scan.image_path)

        suffix = Path(scan.image_path).suffix or ".png"

        result = predict_retinopathy(
            image_bytes,
            suffix=suffix,
        )

    except Exception as exc:
        scan.status = "failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(exc)}",
        )

    scan.status = "completed"
    scan.prediction = str(result["prediction"])
    scan.confidence = result["raw_score"]

    db.commit()
    db.refresh(scan)

    return {
        "scan_id": str(scan.id),
        "status": scan.status,
        "prediction": scan.prediction,
        "confidence": scan.confidence,
        "stage": result["stage"],
    }



@router.get("/{scan_id}")
def get_retinopathy_scan(
    scan_id: UUID,
    db: Session = Depends(get_db),
):
    scan = (
        db.query(RetinopathyScan)
        .filter(RetinopathyScan.id == scan_id)
        .first()
    )

    if scan is None:
        raise HTTPException(
            status_code=404,
            detail="Scan not found",
        )

    image_url = create_signed_image_url(scan.image_path)

    return {
        "scan_id": str(scan.id),
        "status": scan.status,
        "image_path": scan.image_path,
        "image_url": image_url,
        "prediction": scan.prediction,
        "confidence": scan.confidence,
        "created_at": scan.created_at,
    }


