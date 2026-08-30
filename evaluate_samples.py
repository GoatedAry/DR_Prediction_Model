"""
Evaluate the model against ground truth labels and measure Quadratic Weighted Kappa.
"""

import argparse
import os
import numpy as np
from sklearn.metrics import cohen_kappa_score
from predict import predict

TRUE_LABELS = {
    "ef5155990874": 0, "0a85a1e8f9e9": 0, "6a2642131e4a": 0,
    "d801c0a66738": 1, "172df1330a60": 1, "0a3202889f4d": 1,
    "6f0463c1ff18": 2, "c6e1e9fbf39b": 2, "310c27067ac0": 2,
    "3e3a3955b9c5": 3, "b191ba0a2b12": 3, "697538183db5": 3,
    "ed3a0fc5b546": 4, "838c87c63422": 4, "4a7dc013e802": 4,
}

def main(folder: str, checkpoint: str, use_tta: bool):
    results = []

    for id_code, true_class in TRUE_LABELS.items():
        img_path = os.path.join(folder, f"{id_code}.png")
        if not os.path.exists(img_path):
            print(f"SKIP (not found): {img_path}")
            continue

        raw_score, pred_class, pred_name, uncertainty = predict(
            img_path, checkpoint, use_tta=use_tta, mc_samples=5
        )
        correct = "Yes" if pred_class == true_class else "No"
        off_by = abs(pred_class - true_class)

        results.append({
            "id_code": id_code,
            "true_class": true_class,
            "pred_class": pred_class,
            "raw_score": raw_score,
            "correct": correct,
            "off_by": off_by,
            "uncertainty": uncertainty,
        })

    if not results:
        print("No images found. Check folder path.")
        return

    print(f"\n{'id_code':<16}{'true':<6}{'pred':<6}{'raw_score':<12}{'match':<7}{'off_by':<8}{'uncertainty'}")
    for r in results:
        print(f"{r['id_code']:<16}{r['true_class']:<6}{r['pred_class']:<6}"
              f"{r['raw_score']:<12.3f}{r['correct']:<7}{r['off_by']:<8}+/- {r['uncertainty']:.3f}")

    y_true = [r["true_class"] for r in results]
    y_pred = [r["pred_class"] for r in results]

    accuracy = sum(1 for r in results if r["correct"] == "Yes") / len(results)
    qwk = cohen_kappa_score(y_true, y_pred, weights="quadratic")

    print(f"\nExact match accuracy: {accuracy:.2%}")
    print(f"QWK on this sample  : {qwk:.4f}")
    print(f"Mean off by value   : {np.mean([r['off_by'] for r in results]):.2f} stages")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--folder", default="test_images")
    parser.add_argument("--checkpoint", default="best_model.pt")
    parser.add_argument("--tta", action="store_true")
    args = parser.parse_args()
    main(args.folder, args.checkpoint, args.tta)