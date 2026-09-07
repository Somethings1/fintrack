import { message,Spin } from 'antd';
import { Fragment,lazy,Suspense,useEffect,useRef,useState,type ReactNode } from 'react';
import { Navigate,Route,BrowserRouter as Router,Routes } from 'react-router-dom';
import './App.css';
import { PollingProvider } from './context/PollingProvider';
import { RefreshProvider } from './context/RefreshProvider';
import { SettingsProvider } from './context/SettingsContext';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import UpdatePasswordPage from './pages/UpdatePasswordPage';
import WelcomePage from './pages/WelcomePage';
import { getCurrentUser,supabase } from './services/authService';
import { clearUserCache } from "./utils/db";
import { setMessageApi } from './utils/messageProvider';
const HomePage = lazy(() => import('./pages/HomePage'));
const ProfilePage = lazy(() => import('./pages/Profile').then(module => ({ default: module.ProfilePage })));

function PrivateRoute({ children }: { children: ReactNode }) {
    const [authenticated, setAuthenticated] = useState<string | false | null>(null);
    const verifiedUser = useRef('');
    useEffect(() => {
        let active = true;
        let version = 0;
        const check = async () => {
            const current = ++version;
            try {
                const user = await getCurrentUser();
                if (!active || current !== version) return;
                if (user) localStorage.setItem('username', user.id);
                verifiedUser.current = user?.id ?? '';
                setAuthenticated(user?.id ?? false);
            } catch { if (active) setAuthenticated(false); }
        };
        void check();
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                const previous = verifiedUser.current; verifiedUser.current = ''; ++version;
                localStorage.removeItem('username'); setAuthenticated(false);
                if (previous) void clearUserCache(previous).catch(() => undefined);
            } else if (event === 'SIGNED_IN' && session.user.id !== verifiedUser.current) {
                setAuthenticated(null); queueMicrotask(() => { if (active) void check(); });
            }
        });
        return () => { active = false; data.subscription.unsubscribe(); };
    }, []);
    if (authenticated === null) return <Spin aria-label="Checking session" />;
    return authenticated ? <Fragment key={authenticated}>{children}</Fragment> : <Navigate to="/login" replace />;
}
export default function App() {
    const [messageApi, contextHolder] = message.useMessage();
    useEffect(() => { setMessageApi(messageApi); }, [messageApi]);
    useEffect(() => {
        // Remove legacy JS-readable cookies. WebSocket sessions now use /api-scoped HttpOnly cookies.
        document.cookie = 'access_token=; path=/; Max-Age=0; SameSite=Strict';
    }, []);
    return <>{contextHolder}<SettingsProvider><RefreshProvider><Router>
        <Suspense fallback={<Spin aria-label="Loading page" />}><Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/update-password" element={<UpdatePasswordPage />} />
            <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
            <Route path="/home" element={<PrivateRoute><PollingProvider><HomePage /></PollingProvider></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes></Suspense>
    </Router></RefreshProvider></SettingsProvider></>;
}
