import torch
import matplotlib.pyplot as plt
from clinical_triage import ClinicalTriageSystem

def run_visual_triage_tests():
    triage = ClinicalTriageSystem(confidence_threshold=0.80)
    
    test_cases = [
        {"name": "Test 1: Normal Scan", "logits": torch.tensor([[8.5, 1.2, 0.1, 0.0, 0.0]])},
        {"name": "Test 2: Ambiguous Scan", "logits": torch.tensor([[1.2, 1.1, 0.9, 0.4, 0.2]])},
        {"name": "Test 3: High-Risk Scan", "logits": torch.tensor([[0.1, 0.2, 4.5, 0.3, 0.1]])}
    ]
    
    results = []
    for test in test_cases:
        res = triage.evaluate_prediction(test["logits"])
        results.append({
            "name": test["name"],
            "stage": res["predicted_stage"],
            "confidence": res["confidence_score"] * 100,
            "status": res["triage_status"]
        })

    names = [r["name"] for r in results]
    confidences = [r["confidence"] for r in results]
    colors = ['forestgreen' if s == 'AUTOMATED_CLEARANCE' else 'crimson' for s in [r["status"] for r in results]]

    fig, ax = plt.subplots(figsize=(9, 5))
    bars = ax.bar(names, confidences, color=colors, width=0.5)
    
    ax.axhline(y=80, color='orange', linestyle='--', linewidth=2, label='Safety Threshold (80%)')
    ax.set_ylabel('Confidence Score (%)', fontsize=12, fontweight='bold')
    ax.set_title('Clinical Triage Validation Dashboard', fontsize=14, fontweight='bold')
    ax.set_ylim(0, 105)
    ax.legend(loc='lower right')

    for bar in bars:
        height = bar.get_height()
        ax.annotate(f'{height:.1f}%',
                    xy=(bar.get_x() + bar.get_width() / 2, height),
                    xytext=(0, 3),
                    textcoords="offset points",
                    ha='center', va='bottom', fontweight='bold')

    plt.tight_layout()
    plt.savefig('triage_performance_dashboard.png', dpi=300)
    print("Visual performance dashboard saved as 'triage_performance_dashboard.png'")
    plt.show()

if __name__ == "__main__":
    run_visual_triage_tests()