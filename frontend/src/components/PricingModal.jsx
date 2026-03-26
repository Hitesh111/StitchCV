import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

export default function PricingModal({ isOpen, onClose, onPaymentSuccess }) {
    const [loading, setLoading] = useState(false);
    const [couponCode, setCouponCode] = useState('');
    const [error, setError] = useState(null);

    // Initialize razorpay script dynamically if missing
    useEffect(() => {
        if (isOpen && !window.Razorpay) {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            document.body.appendChild(script);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCheckout = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Create order
            const orderRes = await fetch('/api/billing/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ package_id: '20_credits', coupon_code: couponCode || null })
            });

            if (!orderRes.ok) {
                const errData = await orderRes.json();
                throw new Error(errData.detail || 'Failed to create order');
            }
            const order = await orderRes.json();

            // 2. Fetch config
            const configRes = await fetch('/api/billing/config');
            const config = await configRes.json();

            if (!window.Razorpay) {
                throw new Error("Razorpay SDK not loaded yet.");
            }

            // 3. Open Razorpay Checkouot
            const options = {
                key: config.razorpay_key_id,
                amount: order.amount,
                currency: order.currency,
                name: 'StichCV',
                description: '20 Tailored Resumes',
                order_id: order.order_id,
                handler: async function (response) {
                    try {
                        const verifyRes = await fetch('/api/billing/verify-payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature
                            })
                        });
                        
                        if (verifyRes.ok) {
                            onPaymentSuccess();
                            onClose();
                        } else {
                            setError('Payment verification failed. Contact support.');
                        }
                    } catch (e) {
                        setError('Verification encountered an error.');
                    }
                },
                theme: {
                    color: '#6366f1'
                }
            };
            
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response){
                setError(response.error.description);
            });
            rzp.open();

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay glass-overlay">
            <div className="modal-content pricing-modal premium-modal">
                <button className="pricing-close-btn" onClick={onClose} aria-label="Close modal">
                    <X size={20} />
                </button>
                
                <div className="pricing-header">
                    <div className="pricing-sparkle">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.5 21C11.5 21 11.5 13.5 4 12.5C11.5 11.5 11.5 4 11.5 4C11.5 4 11.5 11.5 19 12.5C11.5 13.5 11.5 21 11.5 21Z" fill="url(#paint0_linear)"/>
                            <defs>
                                <linearGradient id="paint0_linear" x1="11.5" y1="4" x2="11.5" y2="21" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#FDE047" />
                                    <stop offset="1" stopColor="#D97706" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <h2>Power Up Your Job Search</h2>
                    <p>Unlock the ability to magically tailor your resume for any role.</p>
                </div>
                
                <div className="pricing-tiers">
                    <div className="pricing-card premium-tier">
                        <div className="premium-glow"></div>
                        <div className="tier-badge">Most Popular</div>
                        
                        <div className="tier-header">
                            <h3>20 Credits</h3>
                            <div className="tier-price">
                                <span className="currency">₹</span>
                                <span className="amount">299</span>
                            </div>
                        </div>
                        
                        <ul className="tier-features">
                            <li><Check size={16} strokeWidth={3} className="feature-icon" /> <span><strong>20 Custom Tailors</strong> completely optimized for ATS</span></li>
                            <li><Check size={16} strokeWidth={3} className="feature-icon" /> <span><strong>Unlimited</strong> PDF resume downloads</span></li>
                            <li><Check size={16} strokeWidth={3} className="feature-icon" /> <span><strong>Deep Analysis</strong> using highest-tier AI models</span></li>
                        </ul>
                    </div>
                </div>

                {error && (
                    <div className="pricing-error-banner">
                        <X size={16} strokeWidth={2.5} />
                        <span>{error}</span>
                    </div>
                )}

                <div className="pricing-checkout-zone">
                    <div className="discount-input-wrapper">
                        <input 
                            type="text" 
                            placeholder="Discount Code (Optional)" 
                            value={couponCode} 
                            onChange={(e) => setCouponCode(e.target.value)}
                            className="discount-input"
                        />
                    </div>

                    <button 
                        className={`btn btn-checkout ${loading ? 'loading' : ''}`} 
                        onClick={handleCheckout} 
                        disabled={loading}
                    >
                        {loading ? 'Initiating Secure Checkout...' : 'Upgrade Now via Razorpay'}
                    </button>
                    
                    <div className="checkout-trust">
                        Secured by Razorpay. 100% Safe inside India.
                    </div>
                </div>
            </div>
        </div>
    );
}
