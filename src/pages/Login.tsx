import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, signInWithEmailAndPassword, onAuthStateChanged, logout, IS_FIREBASE_CONFIGURED, type User } from '../lib/firebase';
import { logAuditAction } from '../lib/audit';
import { useLanguage } from '../contexts/LanguageContext';
import logo from '../assets/logo.png';
import SEO from '../components/SEO';

export default function Login() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Get the page user was trying to access, default to /admin
  const from = (location.state as { from?: string })?.from || '/admin';

  // Check if user is already logged in
  useEffect(() => {
    if (!IS_FIREBASE_CONFIGURED) {
      setCheckingAuth(false);
      return;
    }

    const unsubscribe = onAuthStateChanged((user) => {
      setCurrentUser(user);
      setCheckingAuth(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setCurrentUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!IS_FIREBASE_CONFIGURED) {
      setError('Firebase is not configured. Please check your environment variables.');
      setLoading(false);
      return;
    }

    try {
      if (!auth) {
        throw new Error('Firebase auth not initialized');
      }
      
      await signInWithEmailAndPassword(auth, email, password);
      
      // Log successful login
      await logAuditAction('auth.login', {
        email,
        timestamp: new Date().toISOString()
      });

      // Redirect to the page user was trying to access
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      
      let errorMessage = 'Failed to sign in. Please check your credentials.';
      
      if (err && typeof err === 'object' && 'code' in err) {
        const firebaseError = err as { code: string };
        switch (firebaseError.code) {
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address format.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This account has been disabled.';
            break;
          case 'auth/user-not-found':
            errorMessage = 'No account found with this email.';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Incorrect password.';
            break;
          case 'auth/invalid-credential':
            errorMessage = 'Invalid email or password.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many failed attempts. Please try again later.';
            break;
          default:
            errorMessage = `Login failed: ${firebaseError.code}`;
        }
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  if (!IS_FIREBASE_CONFIGURED) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="mx-auto max-w-md rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <h1 className="mb-2 text-xl font-semibold text-red-800">Firebase Not Configured</h1>
          <p className="text-red-700 text-sm">
            Firebase authentication is not configured. Please set up your environment variables.
          </p>
        </div>
      </div>
    );
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center text-slate-600 text-sm">
        Checking authentication...
      </div>
    );
  }

  // If already logged in, show logged in state
  if (currentUser) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="mx-auto max-w-md w-full">
          <div className="card text-center">
            <div className="mb-6">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-slate-900 mb-2">Already Logged In</h1>
              <p className="text-slate-600 text-sm">
                You're signed in as <strong className="text-slate-900">{currentUser.email}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <button onClick={() => navigate('/admin')} className="btn btn-primary w-full">
                Go to Admin Dashboard
              </button>
              <button onClick={handleLogout} className="btn btn-outline w-full">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <SEO title={t('admin.login')} noindex />
      <div className="mx-auto max-w-md w-full">
        <div className="flex flex-col items-center gap-2 mb-8 text-center">
          <img src={logo} alt="Logo" className="h-12 w-12 rounded-full object-cover" />
          <h1 className="font-serif font-bold text-lg text-slate-900">Anê Thành</h1>
          <p className="eyebrow">{t('admin.login')}</p>
        </div>
        <div className="rule-signature mb-8" />

        <div className="card">
          {error && (
            <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                {t('admin.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600"
                placeholder="admin@example.com"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                {t('admin.password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? t('admin.signing_in') : t('admin.sign_in')}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600">
            <p>{t('admin.authorized_only')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
