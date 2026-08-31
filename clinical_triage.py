import torch
import torch.nn.functional as F

class ClinicalTriageSystem:
    def __init__(self, confidence_threshold=0.80, high_risk_stage=2):
        self.confidence_threshold = confidence_threshold
        self.high_risk_stage = high_risk_stage

    def evaluate_prediction(self, probabilities_or_logits):
        """
        Evaluates predictions against safety and confidence boundaries 
        to trigger human specialist reviews.
        """
        if probabilities_or_logits.sum(dim=1).allclose(torch.tensor(1.0)):
            probs = probabilities_or_logits
        else:
            probs = F.softmax(probabilities_or_logits, dim=1)
            
        confidence, predicted_stage = torch.max(probs, dim=1)
        stage = predicted_stage.item()
        conf = confidence.item()
        
        review_required = False
        flags = []
        
        if conf < self.confidence_threshold:
            review_required = True
            flags.append(f"Low confidence score ({conf:.2%}) below safety threshold ({self.confidence_threshold:.0%})")
            
        if stage >= self.high_risk_stage:
            review_required = True
            flags.append(f"Detected potential referral-level diabetic retinopathy (Stage {stage})")
            
        if review_required:
            return {
                "triage_status": "ESCALATED_TO_SPECIALIST",
                "recommended_action": "Route image immediately to human ophthalmologist queue",
                "predicted_stage": stage,
                "confidence_score": round(conf, 4),
                "trigger_reasons": flags
            }
            
        return {
            "triage_status": "AUTOMATED_CLEARANCE",
            "recommended_action": "Proceed with standard automated patient report generation",
            "predicted_stage": stage,
            "confidence_score": round(conf, 4)
        }