import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

const TIERS = [
    {
        id: 'starter',
        name: 'Starter Tier',
        credits: 5,
        price: 49,
        features: [
            '5 Custom Tailors mapped to ATS', 
            'Direct PDF resume downloads', 
            'Standard AI logic'
        ]
    },
    {
        id: 'pro',
        name: 'Professional',
        credits: 12,
        price: 99,
        badge: 'Most Popular',
        features: [
            '12 Premium Tailored Resumes', 
            'Unlimited PDF exports', 
            'Advanced AI structural matching'
        ]
    },
    {
        id: 'elite',
        name: 'Elite Queue',
        credits: 30,
        price: 199,
        features: [
            '30 Custom Tailored Resumes', 
            'Highest-tier predictive models', 
            'Priority generation speed'
        ]
    }
];

export default function PricingModal({ isOpen, onClose, onPaymentSuccess }) {
    const [loading, setLoading] = useState(false);
    const [couponCode, setCouponCode] = useState('');
    const [error, setError] = useState(null);
    const [selectedPackage, setSelectedPackage] = useState('pro');

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
                body: JSON.stringify({ package_id: selectedPackage, coupon_code: couponCode || null })
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
                name: 'StitchCV',
                description: 'Upgrade Credits',
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
            <div className="modal-content pricing-modal premium-modal" style={{ maxWidth: 900 }}>
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
                
                <div className="pricing-tiers" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {TIERS.map((tier) => (
                        <div 
                            key={tier.id}
                            className={`pricing-card ${tier.id === 'pro' ? 'premium-tier' : ''}`}
                            onClick={() => setSelectedPackage(tier.id)}
                            style={{
                                cursor: 'pointer',
                                position: 'relative',
                                padding: 24,
                                borderRadius: 18,
                                border: `2px solid ${selectedPackage === tier.id ? 'var(--yellow)' : 'var(--border)'}`,
                                background: selectedPackage === tier.id ? 'var(--bg-surface)' : 'transparent',
                                transition: 'all 200ms ease',
                                textAlign: 'left',
                                overflow: 'hidden'
                            }}
                        >
                            {tier.id === 'pro' && <div className="premium-glow"></div>}
                            {tier.badge && <div className="tier-badge">{tier.badge}</div>}
                            
                            <div className="tier-header" style={{ marginBottom: 20 }}>
                                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: 12 }}>{tier.name}</h3>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
                                    {tier.credits} Credits
                                </div>
                                <div className="tier-price" style={{ display: 'flex', alignItems: 'flex-start', color: 'var(--text-primary)' }}>
                                    <span style={{ fontSize: '1rem', fontWeight: 600, marginTop: 4 }}>₹</span>
                                    <span style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em' }}>{tier.price}</span>
                                </div>
                            </div>
                            
                            <ul className="tier-features" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {tier.features.map((feature, idx) => (
                                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                        <Check size={16} strokeWidth={3} className="feature-icon" style={{ color: 'var(--yellow)', flexShrink: 0, marginTop: 2 }} /> 
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="pricing-error-banner" style={{ marginTop: 20 }}>
                        <X size={16} strokeWidth={2.5} />
                        <span>{error}</span>
                    </div>
                )}

                <div className="pricing-checkout-zone" style={{ marginTop: 24, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
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
                        {loading ? 'Initiating Secure Checkout...' : `Upgrade to ${TIERS.find(t => t.id === selectedPackage)?.name} via Razorpay`}
                    </button>
                    
                    <div className="checkout-trust">
                        Secured by Razorpay. 100% Safe inside India.
                    </div>
                </div>
            </div>
        </div>
    );
}
