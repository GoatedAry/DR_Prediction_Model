"""
Pick 2-3 sample id_codes per DR class from train.csv, and print the exact
Kaggle download commands to fetch just those images (no full dataset needed).

Usage:
    python sample_test_images.py --csv train.csv --per_class 3
"""

import argparse
import pandas as pd

STAGE_NAMES = {
    0: "No DR",
    1: "Mild NPDR",
    2: "Moderate NPDR",
    3: "Severe NPDR",
    4: "Proliferative DR",
}


def main(csv_path: str, per_class: int, seed: int):
    df = pd.read_csv(csv_path)

    print(f"Sampling {per_class} images per class (seed={seed})\n")
    all_ids = []

    for cls in range(5):
        subset = df[df["diagnosis"] == cls]
        sample = subset.sample(n=min(per_class, len(subset)), random_state=seed)
        ids = sample["id_code"].tolist()
        all_ids.extend([(cid, cls) for cid in ids])
        print(f"Class {cls} ({STAGE_NAMES[cls]}): {ids}")

    print("\n--- Kaggle download commands (copy-paste into terminal) ---\n")
    for id_code, cls in all_ids:
        print(f'kaggle competitions download -c aptos2019-blindness-detection '
              f'-f train_images/{id_code}.png -p test_images')

    print("\n--- Reference sheet (id_code -> true label) ---\n")
    for id_code, cls in all_ids:
        print(f"{id_code}.png -> Class {cls} ({STAGE_NAMES[cls]})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default="train.csv")
    parser.add_argument("--per_class", type=int, default=3)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    main(args.csv, args.per_class, args.seed)