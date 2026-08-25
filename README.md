# SIH MedTech ML Inference Layer

Standalone ML inference layer for the SIH MedTech backend.

This directory contains the machine-learning code for:

- Diabetic retinopathy (DR) image inference
- Diabetes prediction interface

The ML layer is intentionally separated from FastAPI, database,
authentication, Supabase, and API routing.

---

## Architecture

```text
Frontend
   |
   v
FastAPI Backend
(Member A)
   |
   +----------------------+
   |                      |
   v                      v
DiabetesPredictor   RetinopathyPredictor
   |                      |
   v                      v
Diabetes Model       DR Model