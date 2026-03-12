import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import Applications from './pages/Applications';
import Discover from './pages/Discover';
import Tailor from './pages/Tailor';
import { useState, useCallback } from 'react';

function App() {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    return (
        <BrowserRouter>
            <div className="app-layout">
                <Sidebar />
                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<Dashboard addToast={addToast} />} />
                        <Route path="/jobs" element={<Jobs addToast={addToast} />} />
                        <Route path="/applications" element={<Applications addToast={addToast} />} />
                        <Route path="/discover" element={<Discover addToast={addToast} />} />
                        <Route path="/tailor" element={<Tailor addToast={addToast} />} />
                    </Routes>
                </main>

                {/* Toast notifications */}
                <div className="toast-container">
                    {toasts.map(t => (
                        <div key={t.id} className={`toast toast-${t.type}`}>
                            {t.message}
                        </div>
                    ))}
                </div>
            </div>
        </BrowserRouter>
    );
}

export default App;
