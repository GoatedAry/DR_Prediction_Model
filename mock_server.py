import asyncio
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/predict")
async def predict_dr(file: UploadFile = File(...)):
    await asyncio.sleep(3)
    return {
        "continuous_score": 2.842,
        "clamped_score": 2.842,
        "integer_stage": 3,
        "stage_label": "Severe DR",
        "val_mse_loss": 0.3871,
        "peak_qwk": 0.8992,
        "gradcam_base64": ""
    }
