# DR Stage-Aware Diagnosis — Local Files (matches Kaggle-trained checkpoint)

These files match the exact architecture and config used to train
`best_model.pt` on Kaggle. **Best validation QWK achieved: 0.8613 (86.13%)**
— close to the source paper's reported 0.8992, and well past their stated
clinical threshold of 0.8. Use these files for **local inference** without
needing the dataset or a GPU.

## Setup (Windows / PowerShell)

```powershell
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

CPU-only torch is fine here — inference on a single image is fast
regardless of hardware. Only training needs a GPU.

## Run inference on a single image

Place `best_model.pt` (downloaded from Kaggle's Output tab, extracted from
the training run's `results.zip`) in this folder, then:

```powershell
python predict.py --image path\to\some_fundus_image.png --checkpoint best_model.pt
```

Output looks like:
```
Raw severity score: 2.734
Predicted stage: 3 (Severe NPDR)
```

## Getting sample fundus images to test with

You don't need to download the full 9GB APTOS dataset to get test images —
pull individual files via the Kaggle API.

**1. Authenticate the Kaggle CLI** (newer CLI versions use a token file,
not the old `kaggle.json`):
```powershell
kaggle auth login
```
or manually:
```powershell
mkdir $env:USERPROFILE\.kaggle -Force
"<your-token>" | Out-File -FilePath $env:USERPROFILE\.kaggle\access_token -NoNewline -Encoding ascii
```

**2. Download just `train.csv`** (a few hundred KB, tells you which
`id_code` belongs to which class):
```powershell
kaggle competitions download -c aptos2019-blindness-detection -f train.csv
```

**3. Sample a balanced set of test images** — `sample_test_images.py`
picks 2-3 `id_code`s per class (0-4) and prints ready-to-run download
commands plus a true-label reference sheet:
```powershell
python sample_test_images.py --csv train.csv --per_class 3
```
Copy-paste the printed `kaggle competitions download -f train_images/...`
commands to pull each image into a `test_images\` folder.

**4. Extract, if Kaggle wraps some files as zip** (this happens
inconsistently depending on file size — some come through as plain `.png`,
others as zip-wrapped):
```powershell
cd test_images
Get-ChildItem -Filter *.png | ForEach-Object {
    Rename-Item $_.FullName ($_.FullName + ".zip")
}
Get-ChildItem -Filter *.png.zip | ForEach-Object {
    Expand-Archive -Path $_.FullName -DestinationPath . -Force
    Remove-Item $_.FullName
}
cd ..
```

## Batch-testing against known labels

`evaluate_samples.py` runs the model on every image in `test_images\`,
compares against the true labels from the balanced sample, and prints a
results table plus overall accuracy/QWK for that sample:

```powershell
python evaluate_samples.py --folder test_images --checkpoint best_model.pt
```

Note: 15 images is a small, informal sanity check, not a rigorous
accuracy measurement — the real validation QWK (86.13%) came from ~550
held-out images during training. Use this batch test to spot obvious
failure patterns (e.g. consistent confusion between adjacent stages),
not as a substitute for the training-time metric.

## Files

- `preprocessing.py` — background mask, green channel, median filter, CLAHE, resize (identical to the training notebook)
- `model.py` — ResNet50 + Dropout + Dense(1) head, `layer3`+`layer4` unfrozen (must match training config for the checkpoint's weights to load correctly)
- `dataset.py` — only needed if you retrain locally, not for inference
- `train.py` — full training script if you ever want to retrain/fine-tune locally on a GPU machine, mirrors the Kaggle max-accuracy config (weighted sampling, ReduceLROnPlateau, mixed precision, patience=10)
- `predict.py` — single-image inference, the one you'll run day-to-day
- `sample_test_images.py` — picks a balanced sample of test image IDs from `train.csv` and prints Kaggle download commands
- `evaluate_samples.py` — batch-tests the model against `test_images\` and reports accuracy/QWK on that sample
- `best_model.pt` — trained weights (place here manually, not included in the code files)
- `__results___18_0.png` — training/validation loss and QWK curves from the Kaggle run (reference only, not used by any script)

## Important: don't change `model.py`'s `freeze_until_layer`

`best_model.pt` stores *weight values*, not the frozen/trainable
distinction — so inference works regardless of that setting. But if you
plan to resume training or fine-tune further from this checkpoint, keep
`freeze_until_layer="layer3"` so the optimizer setup matches what
produced these weights.

## Training history

- Trained on Kaggle Notebooks (free GPU, T4/P100) — local training was
  ruled out due to the 9GB dataset size and no paid cloud access.
- First attempt accidentally ran on CPU (Accelerator setting reset to
  "None" on a committed run) — always verify `torch.cuda.is_available()`
  prints `True` in a cell before committing a long run.
- Final run used: `WeightedRandomSampler` for class imbalance,
  `layer3`+`layer4` fine-tuning (deeper than the paper's "final layers
  only"), `ReduceLROnPlateau`, mixed precision (`torch.cuda.amp`),
  `EPOCHS=60`, `PATIENCE=10`. Converged and early-stopped with best
  QWK 0.8613, plateauing roughly epoch 20 onward.
