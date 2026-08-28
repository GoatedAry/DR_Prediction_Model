# Multimodal AI Diabetes / Glycemic Risk Assessment — CGMacros

Research-grade participant-level classifier (Healthy / Pre-T2D / T2D) built
on the CGMacros dataset, following the PRD's core principle: **small,
regularized, interpretable models + rigorous participant-level validation**,
not a large end-to-end deep net trained on ~45 people.

## Getting started

```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Dataset**: put the unzipped CGMacros dataset (the folder containing
`bio.csv` and the `CGMacros-XXX/` subfolders) anywhere under `./data/` —
any nesting depth is auto-detected. If auto-detection doesn't find it,
set it explicitly:

```bash
export CGMACROS_DATA_ROOT=/path/to/CGMacros          # macOS/Linux
$env:CGMACROS_DATA_ROOT = "D:\path\to\CGMacros"       # Windows PowerShell
```

**LLM layer**: `USE_LIVE_LLM = True` in `llm/reasoning.py` by default. Set
`GROQ_API_KEY` to enable live Groq calls:

```bash
export GROQ_API_KEY="gsk_..."             # macOS/Linux
$env:GROQ_API_KEY = "gsk_..."             # Windows PowerShell (note: NOT `set`,
                                           # which sets a PowerShell variable,
                                           # not an env var Python can see)
```

If the key is missing, invalid, or Groq returns malformed JSON, `explain()`
in `llm/reasoning.py` catches the failure, retries once, then falls back to
the grounded, deterministic `template_fallback()` — the pipeline never
crashes or shows unvalidated LLM output. Set `USE_LIVE_LLM = False` to skip
the API entirely and always use the template.

**Run, in order:**

```bash
python -m preprocessing.build_dataset   # builds artifacts/participant_features.csv
python -m experiments.main              # ablations + baselines + LOPO -> results/
python -m modeling.train_final          # trains + saves artifacts/final_ensemble.joblib
pytest tests/test_pipeline.py -v        # 7 correctness/leakage tests
python -m tests.test_inference          # end-to-end inference on one real participant
```

`artifacts/` and `results/` are created automatically — no manual setup needed.

## Running the API

```bash
pip install fastapi uvicorn python-multipart
uvicorn api.server:app --reload
```

This needs its own terminal window (it blocks while serving) — leave it
running and test against it from a second terminal:

```bash
curl -X POST http://localhost:8000/assess \
  -F "cgm_file=@CGMacros/CGMacros-005/CGMacros-005.csv" \
  -F 'clinical_json={"age":45,"bmi":28.1,"fasting_glucose":98,"gender":"M"}'
```

**Windows PowerShell users**: `curl` is aliased to `Invoke-WebRequest`,
which doesn't support `-F`/multipart the same way, and PowerShell's quoting
rules for embedded double quotes differ from bash's. Either call `curl.exe`
explicitly with escaped quotes, or — much less fiddly — use the small
`requests`-based `test_api.py` script instead:

```python
import json, requests

with open("CGMacros/CGMacros-005/CGMacros-005.csv", "rb") as f:
    resp = requests.post(
        "http://localhost:8000/assess",
        files={"cgm_file": f},
        data={"clinical_json": json.dumps(
            {"age": 45, "bmi": 28.1, "fasting_glucose": 98, "gender": "M"}
        )},
    )
print(resp.status_code, resp.json())
```

`GET http://localhost:8000/docs` also gives an interactive Swagger UI where
you can upload the CGM file and paste `clinical_json` through a web form —
often the fastest way to sanity-check a request by hand.

## What's actually implemented and verified against real data

Every module below has been run against the real, unzipped CGMacros dataset
(45 participants) in this environment — this is not scaffolding.

```
config/config.py            All clinical thresholds, paths, seeds (nothing hardcoded elsewhere)
preprocessing/
  labeling.py                Healthy/Pre-T2D/T2D via ADA HbA1c thresholds (not invented)
  cgm_cleaning.py             Dedup, sort, physiological plausibility, gap-limited
                               interpolation, per-participant data_quality_score
  build_dataset.py            Assembles the full multimodal participant table
features/
  cgm_features.py             Basic stats, CV/MAGE/CONGA/MODD, TIR/TAR/TBR,
                               noise-robust excursion detection, circadian features
  postprandial.py             Per-meal AUC/iAUC/peak/recovery, "observed glycemic
                               response per carb" (explicitly not framed as insulin sensitivity)
  activity.py                 HR/MET features (note: CGMacros METs column is x10 the
                               true value per their data dictionary — corrected here)
modeling/
  splits.py                   StratifiedGroupKFold + Leave-One-Participant-Out,
                               with an explicit assertion against participant leakage
  models.py                   Elastic-Net LR + 2 regularized tree models (soft-voting).
                               Uses XGBoost/LightGBM automatically if installed;
                               falls back to sklearn HistGradientBoosting/ExtraTrees
                               in this offline sandbox (see Environment note below)
  pipeline.py                 Impute -> scale -> SelectKBest(mutual_info) -> classifier,
                               fit ONLY inside each training fold (no leakage)
  evaluation.py                Macro AUROC/F1/balanced accuracy, per-class sens/spec,
                               confusion matrix, Brier score, expected calibration error
  calibration.py              Platt-scaling wrapper (nested CV) — see limitations below
  explainability.py           Permutation importance (auto-upgrades to SHAP if installed)
  train_final.py              Trains + saves the deployed model with a full reproducibility manifest
experiments/
  run_ablation.py             Grouped-CV runner used by every experiment
  main.py                     Runs all PRD-required ablations + baselines + LOPO
llm/
  schemas.py                   Pydantic input/output schemas (PRD §39, §43)
  recommendations.py          Rule engine — LLM may only rephrase these, never invent advice
  prompts.py                  System/user prompt templates, forced-JSON output contract
  reasoning.py                Orchestration via Groq (llama-3.3-70b-versatile, JSON mode);
                               falls back to a grounded template when no live call is available
                               (see Environment note)
api/
  inference.py                Single entry point: raw CGM CSV + clinical row -> full
                               assessment. Reuses the exact training feature-extraction
                               code, so production can't drift from training.
  server.py                   FastAPI wrapper exposing inference.py as POST /assess
                               (multipart: cgm_file + clinical_json) and GET /health.
                               Rejects hba1c in clinical_json to keep screening non-circular.
tests/test_inference.py       End-to-end smoke test on a real participant
```

## Results (participant-level grouped CV, 5-fold, N=45)

| Experiment | Features | Macro AUROC | Macro F1 | Bal. Acc. | Brier | ECE |
|---|---|---|---|---|---|---|
| Majority-class baseline | – | 0.47 | 0.24 | 0.32 | 0.22 | 0.00 |
| Clinical only (excl. HbA1c) | 11 | 0.85 | 0.69 | 0.69 | 0.15 | 0.08 |
| CGM-derived only | 39 | 0.79 | 0.69 | 0.69 | 0.16 | 0.05 |
| Clinical + CGM | 50 | 0.83 | 0.68 | 0.67 | 0.15 | 0.07 |
| + Activity/HR | 60 | 0.83 | 0.68 | 0.67 | 0.15 | 0.07 |
| **Full multimodal** (+meals) | 68 | **0.82** | **0.72** | **0.72** | 0.15 | 0.07 |
| **Leave-One-Participant-Out** | 68 | **0.80** | **0.63** | **0.62** | – | – |

Full per-model comparison (logistic / random forest / boosted trees /
ensemble) is in `results/baseline_comparison.csv`; per-class sensitivity,
specificity, and confusion matrices are in `results/full_reports.txt`.

### What this does and doesn't show

- All variants beat the majority-class baseline by a wide margin — there is
  real, non-trivial signal in both clinical and CGM-derived features.
- **CGM-only slightly underperforms clinical-only on AUROC (0.79 vs 0.85)
  but has the best-calibrated probabilities (lowest ECE, 0.05) and matches
  clinical on F1/balanced accuracy.** Adding CGM/activity/meal features to
  clinical does **not** clearly outperform clinical alone on AUROC (0.82-0.83
  vs 0.85) at this sample size, though it does give the best F1/balanced
  accuracy of any configuration. With N=45, these differences are within
  noise of each other (fold-to-fold AUROC std is 0.07-0.15) — **this dataset
  cannot yet answer the PRD's central scientific question (§48) with
  statistical confidence.** More participants or an external validation
  cohort are needed before claiming CGM adds information beyond static labs.
- A "sanity check" experiment that (deliberately, and clearly labeled)
  includes HbA1c in the clinical set scores ~100% — this is expected and
  uninteresting, since the label is a deterministic function of HbA1c by
  construction (ADA thresholds). It confirms the pipeline has no leakage
  bugs; it is not a real result and is excluded from the table above.

## Environment limitations in *this* sandbox (not the codebase)

1. **No internet access** — `xgboost`, `lightgbm`, and `shap` could not be
   installed. The code prefers them automatically wherever they exist
   (`modeling/models.py`, `modeling/explainability.py`); here it transparently
   fell back to `HistGradientBoostingClassifier`, `ExtraTreesClassifier`, and
   permutation importance. Re-run `pip install xgboost lightgbm shap` in your
   own environment and the same code will use the real libraries with no
   changes.
2. **Live LLM calls require `GROQ_API_KEY`** — `llm/reasoning.py` has
   `USE_LIVE_LLM = True` by default and will call Groq's OpenAI-compatible
   chat completions endpoint (JSON object mode, default model
   `openai/gpt-oss-120b`) whenever the key is set. Without a key, or on
   any API/parse/validation failure, it retries once, then falls back to
   the grounded, deterministic template — the pipeline never shows the
   user unvalidated output, and never crashes for lack of a key.

## A genuine finding worth knowing about

Nested-CV Platt-scaling calibration (`modeling/calibration.py`) was tested
and, at this sample size (~28-32 training participants per inner fold),
**made calibration slightly worse, not better** (ECE 0.073 → 0.108) — the
calibrator itself doesn't have enough data to fit reliably. The raw
ensemble's out-of-fold probabilities are already reasonably calibrated
(PRD §36 asks this be evaluated, not assumed) and are recommended for now;
revisit calibration once a larger or external validation set is available.

## Reproducing everything

```bash
python -m preprocessing.build_dataset      # builds artifacts/participant_features.csv
python -m experiments.main                 # runs all ablations + baselines + LOPO
python -m modeling.train_final             # trains + saves the deployed model
python -m tests.test_inference             # end-to-end smoke test
```

`artifacts/model_manifest.json` records dataset hash, feature list, train
participant IDs, hyperparameters, and random seed for every saved model
(PRD §55).

## Repo hygiene

`.gitignore` excludes the ~45MB `CGMacros/` dataset (not ours to
redistribute, and auto-detected locally regardless of where it's placed —
see `CGMACROS_DATA_ROOT` above), Python/venv/IDE cruft, and `.env` files.
`artifacts/*.joblib` and `results/` are tracked by default since the
trained model is small (~600KB); uncomment the relevant lines in
`.gitignore` if you'd rather have collaborators retrain locally instead of
pulling a committed model file.

## Explicitly out of scope here (per PRD §9, §11)

Food-image nutrition estimation and microbiome features are not part of
the core model, per the PRD's own instructions — the dataset includes both,
and they were deliberately excluded.

## Honest next steps

1. ✅ Confirmed working with real XGBoost/LightGBM (a user hit and we fixed
   an XGBoost >=2.0 issue: it now requires integer-encoded class labels
   instead of auto-encoding strings, which `modeling/models.py::SafeLabelClassifier`
   now handles transparently). Still worth comparing sklearn-fallback vs.
   real-backend result magnitudes if you have both available, and installing
   `shap` for real SHAP explanations instead of the permutation-importance
   fallback used here.
2. ✅ Live Groq calls are wired up (`USE_LIVE_LLM = True`, `openai/gpt-oss-120b`,
   JSON object mode) and validated against `llm/schemas.py::ReasoningOutput`
   on every call, with retry + template fallback on any failure.
3. External validation on a second CGM+labels dataset before trusting the
   clinical-vs-multimodal comparison (§48's actual scientific question needs
   more than N=45 to answer with confidence).
4. ✅ A minimal FastAPI wrapper (`api/server.py`) around `api/inference.py`
   is built and smoke-tested (`POST /assess`, `GET /health`) — see
   "Running the API" above.
