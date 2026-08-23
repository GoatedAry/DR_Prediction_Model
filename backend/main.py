from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(title="DR Diagnosis API", version="1.0")

# allow cors so the react app can fetch data without errors
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#do notchange variable names below frontend kinda needs these exact keys
class DiagnosisResponse(BaseModel):
    continuous_score: float      # raw decimal from dense layer
    clamped_score: float         # bounded between 0.0 and 4.0
    integer_stage: int           # final rounded severity stage 0 to 4
    stage_label: str             # no dr, mild, moderate, severe dr, proliferative
    val_mse_loss: float          # model loss metric
    peak_qwk: float              # qwk score
    gradcam_base64: str          # heatmap converted to base64 string for 3d mesh

@app.get("/")
def health_check():
    return {"status": "Backend is up"}

@app.post("/api/diagnose", response_model=DiagnosisResponse)
async def diagnose(file: UploadFile = File(...)):
    # read the raw image file sent from frontend formdata
    image_bytes = await file.read()
    
    # pytorch logic will go here but check once
    # 1. run the image through preprocessing pipeline(check on the order ekbar)
    # 2. feed it into resnet model
    # 3. get gradients for gradcam heatmap
    # 4. return the exact format below
    
    # mock data for testing
    # delete this return once the real model is connected
    return DiagnosisResponse(
        continuous_score=2.842,
        clamped_score=2.842,
        integer_stage=3,
        stage_label="Severe DR",
        val_mse_loss=0.3871,
        peak_qwk=0.8992,
        gradcam_base64="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )

if __name__ == "__main__":
    import uvicorn
    # run server on localhost port 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
