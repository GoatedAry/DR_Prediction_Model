import numpy as np
from sklearn.metrics import cohen_kappa_score, roc_auc_score, classification_report

def generate_clinical_report(true_labels, prediction_probabilities):
    predicted_classes = np.argmax(prediction_probabilities, axis=1)
    
    kappa = cohen_kappa_score(true_labels, predicted_classes, weights="quadratic")
    auc = roc_auc_score(true_labels, prediction_probabilities, multi_class="ovr")
    detailed_stats = classification_report(true_labels, predicted_classes)
    
    print(f"Quadratic Weighted Kappa: {kappa:.4f}")
    print(f"Area Under Curve: {auc:.4f}")
    print("Detailed Clinical Report:\n", detailed_stats)
    
    return kappa, auc