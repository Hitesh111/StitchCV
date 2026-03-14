import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import Applications from './pages/Applications';
import Discover from './pages/Discover';
import Tailor from './pages/Tailor';
import { useState, useCallback, useRef } from 'react';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

function App() {
    const [toast, setToast] = useState(null);
    const toastTimerRef = useRef(null);

    const addToast = useCallback((message, type = 'info') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        const id = Date.now();
        setToast({ id, message, type });
        
        toastTimerRef.current = setTimeout(() => {
            setToast(null);
        }, 4000);
    }, []);

    const ToastIcon = {
        success: <CheckCircle size={16} strokeWidth={2.5} />,
        error: <AlertCircle size={16} strokeWidth={2.5} />,
        info: <Info size={16} strokeWidth={2.5} />
    };

    return (
        <BrowserRouter>
            <div className="app-layout">
                <Header />
                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<Dashboard addToast={addToast} />} />
                        <Route path="/jobs" element={<Jobs addToast={addToast} />} />
                        <Route path="/applications" element={<Applications addToast={addToast} />} />
                        <Route path="/discover" element={<Discover addToast={addToast} />} />
                        <Route path="/tailor" element={<Tailor addToast={addToast} />} />
                    </Routes>
                </main>

                {/* Toast notifications (Singular) */}
                <div className="toast-container">
                    {toast && (
                        <div key={toast.id} className={`toast toast-${toast.type}`}>
                            {ToastIcon[toast.type]}
                            {toast.message}
                        </div>
                    )}
                </div>
            </div>
        </BrowserRouter>
    );
}

export default App;
