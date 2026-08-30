"""
Minimal FastAPI wrapper around api/inference.py.

NOTE: this sandbox has no internet access, so `fastapi`/`uvicorn` could not
be installed here and this file has not been exercised by a live request in
this environment. It follows standard FastAPI patterns and reuses the
already-tested `run_inference()` function directly (see
tests/test_inference.py for the underlying logic that HAS been verified
against real data) -- but please smoke-test `uvicorn api.server:app --reload`
yourself before treating this endpoint as validated.

Run:
    pip install fastapi uvicorn python-multipart
    uvicorn api.server:app --reload
"""
import json
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

from api.inference import run_inference

app = FastAPI(
    title="CGMacros Metabolic Risk Screening API",
    description=("AI-assisted metabolic risk screening — NOT a diagnostic tool. "
                 "See PRD safety_message conventions."),
    version="1.0.0",
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/assess")
async def assess(
    cgm_file: UploadFile = File(..., description="CGMacros-format CSV: Timestamp, Libre GL, "
                                                   "Dexcom GL, HR, METs, Calories (Activity), "
                                                   "Meal Type, Carbs, Protein, Fat, Fiber, ..."),
    clinical_json: str = Form(..., description=(
        "JSON object with clinical fields: age, gender, bmi, fasting_glucose, "
        "fasting_insulin, triglycerides, total_cholesterol, hdl, ldl, vldl, "
        "chol_hdl_ratio. Do NOT include hba1c/label -- this is a screening "
        "input, not a labeling input.")),
):
    try:
        clinical_row = json.loads(clinical_json)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"clinical_json is not valid JSON: {e}")

    if "hba1c" in clinical_row:
        # This endpoint screens for risk; it must not be handed the value
        # used to define ground-truth labels during training.
        raise HTTPException(status_code=400, detail=(
            "clinical_json must not include hba1c for a risk-screening request "
            "(hba1c defines the training labels; passing it here would make the "
            "assessment circular, not a genuine screen)."))

    with tempfile.TemporaryDirectory() as tmp:
        cgm_path = Path(tmp) / "cgm.csv"
        with open(cgm_path, "wb") as f:
            shutil.copyfileobj(cgm_file.file, f)

        try:
            result = run_inference(str(cgm_path), clinical_row)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Inference failed: {e}")

    return JSONResponse(content=result)
