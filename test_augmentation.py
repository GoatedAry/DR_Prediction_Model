import torch
import torchvision.transforms as T
from torchvision.transforms.functional import to_pil_image
from PIL import Image
from preprocessing import get_training_transforms
import os

# Grab the first available test image
image_path = "test_images/ef5155990874.png"
if not os.path.exists(image_path):
    print("Test image not found. Please ensure the test_images folder is populated.")
    exit()

# Load the image using PIL 
original_img = Image.open(image_path).convert("RGB")

# Load your new augmentation pipeline
full_pipeline = get_training_transforms()

# Extract all transformations except the final Normalize step for human viewing
visual_transforms = T.Compose(full_pipeline.transforms[:-1])

print("Generating augmented samples...")

# Generate 5 unique variations of the same image
for i in range(1, 6):
    # Apply the random transformations
    augmented_tensor = visual_transforms(original_img)
    
    # Convert the tensor back to a viewable image
    viewable_img = to_pil_image(augmented_tensor)
    
    output_name = f"aug_test_variation_{i}.png"
    viewable_img.save(output_name)
    print(f"Saved: {output_name}")

print("Check your project folder to view the morphological and lighting variations!")