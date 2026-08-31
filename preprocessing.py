import torchvision.transforms as T

def get_training_transforms(image_size=224):
    """
    Returns training transforms incorporating morphological rotations, 
    flips, color jitter, and random occlusion.
    """
    return T.Compose([
        T.Resize((image_size, image_size)),
        T.RandomHorizontalFlip(p=0.5),
        T.RandomVerticalFlip(p=0.5),
        T.RandomRotation(degrees=15),
        T.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        T.RandomErasing(p=0.2, scale=(0.02, 0.15), value='random')
    ])

def get_stress_test_transforms(image_size=224):
    """
    Simulates degraded clinical environments to test model robustness.
    """
    return T.Compose([
        T.Resize((image_size, image_size)),
        T.GaussianBlur(kernel_size=5, sigma=(0.5, 2.0)),
        T.ColorJitter(brightness=0.5, contrast=0.5),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

def get_validation_transforms(image_size=224):
    """
    Returns clean validation and test inference transforms.
    """
    return T.Compose([
        T.Resize((image_size, image_size)),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])