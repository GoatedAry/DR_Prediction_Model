import os
import pandas as pd
from PIL import Image
from torch.utils.data import Dataset

class RetinalDataset(Dataset):
    def __init__(self, csv_file, img_dir, transform=None):
        self.df = pd.read_csv(csv_file)
        self.img_dir = img_dir
        self.transform = transform

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        img_name = row['id_code'] if 'id_code' in row else row.iloc[0]
        label = int(row['diagnosis']) if 'diagnosis' in row else int(row.iloc[1])
        
        # Handle filename extension if not in csv
        if not img_name.endswith(('.png', '.jpg', '.jpeg')):
            img_path = os.path.join(self.img_dir, f"{img_name}.png")
            if not os.path.exists(img_path):
                img_path = os.path.join(self.img_dir, f"{img_name}.jpg")
        else:
            img_path = os.path.join(self.img_dir, img_name)

        image = Image.open(img_path).convert("RGB")
        if self.transform:
            image = self.transform(image)

        return image, label