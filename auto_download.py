"""
Downloads exactly 15 test images using the Kaggle CLI and extracts them.
"""

import os
import subprocess
import zipfile

image_ids = [
    "ef5155990874", "0a85a1e8f9e9", "6a2642131e4a",
    "d801c0a66738", "172df1330a60", "0a3202889f4d",
    "6f0463c1ff18", "c6e1e9fbf39b", "310c27067ac0",
    "3e3a3955b9c5", "b191ba0a2b12", "697538183db5",
    "ed3a0fc5b546", "838c87c63422", "4a7dc013e802"
]

folder_name = "test_images"
os.makedirs(folder_name, exist_ok=True)

for img_id in image_ids:
    cmd = f"kaggle competitions download -c aptos2019-blindness-detection -f train_images/{img_id}.png -p {folder_name}"
    subprocess.run(cmd, shell=True)

    zip_path = os.path.join(folder_name, f"{img_id}.png.zip")
    
    if os.path.exists(zip_path):
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(folder_name)
        os.remove(zip_path)