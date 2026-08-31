"""
Central configuration for the CGMacros diabetes/glycemic-risk pipeline.

Nothing clinical is hard-coded elsewhere in the codebase (PRD §15) — every
module imports thresholds from here.
"""
import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent  # .../project/

ARTIFACT_DIR = PROJECT_ROOT / "artifacts"
RESULTS_DIR = PROJECT_ROOT / "results"
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def _find_data_root() -> Path:
    """Locates the CGMacros dataset root (the folder that directly contains
    bio.csv and the CGMacros-XXX/ subfolders).

    Resolution order:
      1. CGMACROS_DATA_ROOT environment variable, if set (most reliable —
         set this if auto-detection below doesn't find your layout).
      2. Auto-search under the project root for a folder containing bio.csv,
         at any depth up to 4 levels -- this covers both "dataset folder
         placed directly in the project root" (e.g. <project>/CGMacros/bio.csv)
         and "dataset folder placed under a data/ subfolder" (e.g.
         <project>/data/.../CGMacros/bio.csv), regardless of what the
         dataset zip's top-level folder happens to be named. Common
         non-dataset directories (venv, .git, __pycache__, node_modules,
         the code package dirs themselves) are skipped for speed and to
         avoid false matches.
      3. Raises a clear, actionable error if nothing is found -- rather than
         letting pandas fail later with a confusing FileNotFoundError.
    """
    env_override = os.environ.get("CGMACROS_DATA_ROOT")
    if env_override:
        p = Path(env_override)
        if (p / "bio.csv").exists():
            return p
        raise FileNotFoundError(
            f"CGMACROS_DATA_ROOT={env_override} does not contain bio.csv. "
            "Point it at the folder that directly holds bio.csv and the "
            "CGMacros-XXX/ subfolders."
        )

    SKIP_DIRS = {
        "venv", ".venv", "env", ".git", "__pycache__", "node_modules",
        "config", "preprocessing", "features", "modeling", "experiments",
        "llm", "api", "tests", "artifacts", "results", ".idea", ".vscode",
    }
    max_depth = 4
    root_depth = len(PROJECT_ROOT.parts)
    for dirpath, dirnames, filenames in os.walk(PROJECT_ROOT):
        depth = len(Path(dirpath).parts) - root_depth
        if depth >= max_depth:
            dirnames[:] = []  # don't descend further
            continue
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        if "bio.csv" in filenames:
            return Path(dirpath)

    raise FileNotFoundError(
        "Could not find bio.csv anywhere under "
        f"{PROJECT_ROOT}\n\n"
        "Fix this by either:\n"
        f"  1. Unzipping the CGMacros dataset so bio.csv ends up somewhere under "
        f"{PROJECT_ROOT}\\ (any nesting depth up to 4 levels is auto-detected -- "
        "e.g. <project>/CGMacros/bio.csv or <project>/data/.../CGMacros/bio.csv "
        "both work), or\n"
        "  2. Setting the CGMACROS_DATA_ROOT environment variable to the exact "
        "folder that contains bio.csv, e.g.:\n"
        "     Windows (PowerShell):  $env:CGMACROS_DATA_ROOT = 'D:\\path\\to\\CGMacros'\n"
        "     Windows (cmd):         set CGMACROS_DATA_ROOT=D:\\path\\to\\CGMacros\n"
        "     macOS/Linux:           export CGMACROS_DATA_ROOT=/path/to/CGMacros"
    )


DATA_ROOT = _find_data_root()
BIO_CSV = DATA_ROOT / "bio.csv"

# ---------------------------------------------------------------------------
# Glucose thresholds (mg/dL) — clinically standard, all configurable here
# ---------------------------------------------------------------------------
GLUCOSE_THRESHOLDS = {
    "low": 54,          # level-2 hypoglycemia
    "target_low": 70,   # bottom of time-in-range band
    "target_high": 180, # top of time-in-range band
    "high": 250,        # level-2 hyperglycemia
}

# Excursion detection
EXCURSION_MIN_RISE_MGDL = 30       # minimum rise to count as a genuine spike
EXCURSION_MIN_DURATION_MIN = 15    # minimum duration above baseline+rise
EXCURSION_SMOOTHING_WINDOW_MIN = 15  # rolling median window for noise handling

# CGM sampling
EXPECTED_SAMPLE_INTERVAL_MIN = 1   # CGMacros is exported at 1-minute resolution
MAX_INTERP_GAP_MIN = 15            # only interpolate gaps <= this; longer = missing

# Data-quality gating (PRD §33, §45)
MIN_VALID_HOURS_FOR_TEMPORAL_ASSESSMENT = 24
MIN_DAYS_FOR_CIRCADIAN_FEATURES = 2
QUALITY_SCORE_FLAG_THRESHOLD = 0.6  # below this, flag low-confidence in output

# Postprandial window (PRD §19)
POSTPRANDIAL_WINDOW_MIN = 120
POSTPRANDIAL_CHECKPOINTS_MIN = [0, 30, 60, 90, 120]
POSTPRANDIAL_MEAL_SEPARATION_MIN = 90  # meals closer together than this are excluded
                                        # from clean single-meal response analysis

# Circadian time-of-day bins (24h clock)
CIRCADIAN_BINS = {
    "overnight": (0, 6),
    "morning": (6, 12),
    "afternoon": (12, 18),
    "evening": (18, 24),
}

# ADA A1c labeling criteria (%) — standard clinical thresholds, not invented
# for this project (PRD §12: "Do not create artificial labels")
A1C_HEALTHY_MAX = 5.7   # < 5.7  -> Healthy
A1C_PREDIABETES_MAX = 6.5  # 5.7-6.4 -> Pre-T2D ; >= 6.5 -> T2D

CLASS_NAMES = ["Healthy", "Pre-T2D", "T2D"]

# ---------------------------------------------------------------------------
# Reproducibility
# ---------------------------------------------------------------------------
RANDOM_SEED = 42
N_CV_FOLDS = 5
