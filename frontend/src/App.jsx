import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import PricingModal from './components/PricingModal';

import Tailor from './pages/Tailor';
import Dashboard from './pages/Dashboard';
import Auth from './pages/Auth';
import Landing from './pages/Landing';
import Profile from './pages/Profile';
import { useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';
import api from './services/api';

function AppShell() {
    const [toast, setToast] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [isPricingOpen, setIsPricingOpen] = useState(false);
    const toastTimerRef = useRef(null);
    const location = useLocation();
    const navigate = useNavigate();

    const addToast = useCallback((message, type = 'info') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        const id = Date.now();
        setToast({ id, message, type });
        
        toastTimerRef.current = setTimeout(() => {
            setToast(null);
        }, 4000);
    }, []);

    useEffect(() => {
        let mounted = true;
        api.me()
            .then((me) => {
                if (mounted) setUser(me);
            })
            .catch((err) => {
                if (mounted && err.status !== 401) setToast({ id: Date.now(), message: err.message, type: 'error' });
            })
            .finally(() => {
                if (mounted) setAuthLoading(false);
            });
            
        const handleOpenPricing = () => setIsPricingOpen(true);
        document.addEventListener('open-pricing', handleOpenPricing);
            
        return () => { 
            mounted = false; 
            document.removeEventListener('open-pricing', handleOpenPricing);
        };
    }, []);

    const refreshUser = () => {
        api.me().then(me => setUser(me)).catch(console.error);
    };

    async function handleLogout() {
        try {
            await api.logout();
        } catch (_) {
            // keep client state consistent even if backend session already expired
        } finally {
            setUser(null);
            navigate('/login');
        }
    }

    const ToastIcon = {
        success: <CheckCircle size={16} strokeWidth={2.5} />,
        error: <AlertCircle size={16} strokeWidth={2.5} />,
        info: <Info size={16} strokeWidth={2.5} />
    };

    const isAuthRoute = location.pathname === '/login' || location.pathname === '/signup';
    const isLandingRoute = location.pathname === '/';

    if (authLoading) {
        return (
            <div className="app-layout">
                <main className="main-content narrow">
                    <div className="card" style={{ marginTop: 48 }}>
                        <div className="skeleton" style={{ width: 180, height: 24, marginBottom: 12 }} />
                        <div className="skeleton" style={{ width: '100%', height: 14, marginBottom: 8 }} />
                        <div className="skeleton" style={{ width: '78%', height: 14 }} />
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="app-layout">
            {(isLandingRoute || (!isAuthRoute && user)) && (
                <Header user={user} onLogout={handleLogout} publicMode={isLandingRoute} />
            )}
            <main className={`main-content ${isAuthRoute ? 'auth-stage' : 'wide'} app-stage`}>
                <Routes>
                    <Route
                        path="/login"
                        element={user ? <Navigate to="/tailor" replace /> : <Auth mode="login" addToast={addToast} onAuthenticated={setUser} />}
                    />
                    <Route
                        path="/signup"
                        element={user ? <Navigate to="/tailor" replace /> : <Auth mode="signup" addToast={addToast} onAuthenticated={setUser} />}
                    />
                    <Route path="/" element={<Landing user={user} />} />
                    <Route path="/tailor" element={user ? <Tailor addToast={addToast} /> : <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />} />
                    <Route path="/applications" element={user ? <Dashboard addToast={addToast} /> : <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />} />
                    <Route path="/profile" element={user ? <Profile addToast={addToast} /> : <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />} />
                    <Route path="*" element={<Navigate to={user ? '/tailor' : '/'} replace />} />
                </Routes>
            </main>
            
            <PricingModal 
                isOpen={isPricingOpen} 
                onClose={() => setIsPricingOpen(false)} 
                onPaymentSuccess={() => {
                    refreshUser();
                    addToast('Payment successful! Your credits have been added.', 'success');
                }} 
            />

            <div className="toast-container">
                {toast && (
                    <div key={toast.id} className={`toast toast-${toast.type}`}>
                        {ToastIcon[toast.type]}
                        {toast.message}
                    </div>
                )}
            </div>
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AppShell />
        </BrowserRouter>
    );
}

export default App;
