from __future__ import annotations
"""Service handling Razorpay integration and signature verification."""

import hmac
import hashlib
import razorpay
from typing import Optional

from stichcv.config import settings


def get_razorpay_client() -> Optional[razorpay.Client]:
    """Initialize and return the Razorpay client if keys are configured."""
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        return None
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


def verify_razorpay_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Securely verify the webhook/callback signature from Razorpay."""
    if not settings.razorpay_key_secret:
        return False
        
    msg = f"{order_id}|{payment_id}"
    generated_signature = hmac.new(
        settings.razorpay_key_secret.encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(generated_signature, signature)
