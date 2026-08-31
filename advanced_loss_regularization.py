import torch
import torch.nn as nn
import torch.nn.functional as F

class FocalCosineLoss(nn.Module):
    """
    Focal Loss with Label Smoothing to handle class imbalance, 
    rare pathologies, and subjective annotation uncertainty.
    """
    def __init__(self, gamma=2.0, label_smoothing=0.1, num_classes=5):
        super(FocalCosineLoss, self).__init__()
        self.gamma = gamma
        self.smoothing = label_smoothing
        self.num_classes = num_classes

    def forward(self, logits, targets):
        confidence = 1.0 - self.smoothing
        smooth_label = self.smoothing / (self.num_classes - 1)
        
        true_dist = torch.full_like(logits, smooth_label)
        true_dist.scatter_(1, targets.unsqueeze(1), confidence)
        
        log_probs = F.log_softmax(logits, dim=1)
        probs = torch.exp(log_probs)
        focal_weight = (1.0 - probs) ** self.gamma
        
        loss = -torch.sum(focal_weight * true_dist * log_probs, dim=1)
        return loss.mean()

def get_regularized_optimizer(model, learning_rate=1e-4, weight_decay=1e-2):
    """
    AdamW optimizer splitting parameters to apply Weight Decay only to weights.
    """
    decay_params = []
    no_decay_params = []
    
    for name, param in model.named_parameters():
        if not param.requires_grad:
            continue
        if "bias" in name or "bn" in name:
            no_decay_params.append(param)
        else:
            decay_params.append(param)
            
    optimizer_grouped_parameters = [
        {"params": decay_params, "weight_decay": weight_decay},
        {"params": no_decay_params, "weight_decay": 0.0}
    ]
    
    return torch.optim.AdamW(optimizer_grouped_parameters, lr=learning_rate)