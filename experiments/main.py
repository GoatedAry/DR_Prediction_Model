"""
Runs everything PRD §47-49 asks for and writes a results table.

    python -m experiments.main
"""
import sys
import warnings
import json
import time
import pandas as pd

sys.path.insert(0, ".")
warnings.filterwarnings("ignore")

from config.config import RESULTS_DIR, ARTIFACT_DIR
from preprocessing.build_dataset import build_full_dataset, get_modality_columns
from experiments.run_ablation import run_cv_experiment, run_leave_one_participant_out
from modeling.evaluation import format_report
from modeling.models import model_backend_report


def summarize(res: dict) -> dict:
    return {
        "macro_auroc": round(res["macro_auroc"], 3),
        "macro_f1": round(res["macro_f1"], 3),
        "balanced_accuracy": round(res["balanced_accuracy"], 3),
        "brier_score": round(res["brier_score"], 3),
        "ece": round(res["expected_calibration_error"], 3),
        "auroc_fold_std": round(res["fold_std"].get("macro_auroc", float("nan")), 3),
    }


def main():
    print(">> Backends:", model_backend_report())
    print(">> Building participant-level multimodal dataset from raw CGMacros...")
    t0 = time.time()
    df = build_full_dataset(save_path=str(ARTIFACT_DIR / "participant_features.csv"))
    print(f"   done in {time.time()-t0:.1f}s -- {df.shape[0]} participants, {df.shape[1]} columns")
    mods = get_modality_columns(df)

    experiments = {
        "Exp0_majority_baseline": mods["clinical_no_a1c"],  # feature set unused by DummyClassifier
        "Exp1_clinical_no_a1c": mods["clinical_no_a1c"],
        "Exp1b_clinical_with_a1c_SANITY": mods["clinical"],
        "Exp2_cgm_only": mods["cgm"],
        "Exp3_clinical_no_a1c_plus_cgm": mods["clinical_no_a1c"] + mods["cgm"],
        "Exp4_plus_activity": mods["clinical_no_a1c"] + mods["cgm"] + mods["activity"],
        "Exp5_full_multimodal": (mods["clinical_no_a1c"] + mods["cgm"]
                                  + mods["activity"] + mods["meal"]),
        "Exp5b_full_multimodal_with_a1c_SANITY": (mods["clinical"] + mods["cgm"]
                                                    + mods["activity"] + mods["meal"]),
    }

    rows = []
    reports = []
    for name, cols in experiments.items():
        model_type = "majority" if name.startswith("Exp0") else "ensemble"
        n_feat = 0 if model_type == "majority" else len(cols)
        res = run_cv_experiment(df, cols, model_type=model_type, n_splits=5, k_features=15)
        s = summarize(res)
        s["experiment"] = name
        s["n_features"] = n_feat
        rows.append(s)
        reports.append(format_report(res, name))
        print(f"   {name:45s} AUROC={s['macro_auroc']:.3f}  F1={s['macro_f1']:.3f}  "
              f"BalAcc={s['balanced_accuracy']:.3f}")

    results_table = pd.DataFrame(rows)[
        ["experiment", "n_features", "macro_auroc", "macro_f1",
         "balanced_accuracy", "brier_score", "ece", "auroc_fold_std"]
    ]
    results_table.to_csv(RESULTS_DIR / "ablation_results.csv", index=False)

    # Baseline model comparison on the full (leak-free) multimodal feature set
    full_cols = experiments["Exp5_full_multimodal"]
    baseline_rows = []
    for model_type in ["majority", "logistic", "random_forest", "boosted_b", "boosted_c", "ensemble"]:
        res = run_cv_experiment(df, full_cols, model_type=model_type, n_splits=5, k_features=15)
        s = summarize(res)
        s["model"] = model_type
        baseline_rows.append(s)
        print(f"   [baseline] {model_type:15s} AUROC={s['macro_auroc']:.3f}  F1={s['macro_f1']:.3f}")
    baseline_table = pd.DataFrame(baseline_rows)[
        ["model", "macro_auroc", "macro_f1", "balanced_accuracy", "brier_score", "ece"]
    ]
    baseline_table.to_csv(RESULTS_DIR / "baseline_comparison.csv", index=False)

    # Leave-one-participant-out final robustness check on the primary (no-leak) config
    print(">> Running Leave-One-Participant-Out (final robustness check)...")
    lopo_res = run_leave_one_participant_out(df, experiments["Exp5_full_multimodal"], model_type="ensemble")
    with open(RESULTS_DIR / "lopo_report.txt", "w") as f:
        f.write(format_report(lopo_res, "Leave-One-Participant-Out: Exp5 full multimodal"))
    print(f"   LOPO macro AUROC={lopo_res['macro_auroc']:.3f}  F1={lopo_res['macro_f1']:.3f}  "
          f"BalAcc={lopo_res['balanced_accuracy']:.3f}")

    with open(RESULTS_DIR / "full_reports.txt", "w") as f:
        f.write("\n\n".join(reports))

    print("\n>> Results written to", RESULTS_DIR)
    return results_table, baseline_table, lopo_res


if __name__ == "__main__":
    main()
