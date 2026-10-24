import { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { onAuthStateChanged, logout, type User } from "../lib/firebase";
import { startSessionTimeout, stopSessionTimeout } from "../lib/sessionTimeout";
import { logAuditAction } from "../lib/audit";
import SessionTimeoutWarning from "../components/SessionTimeoutWarning";
import { Outlet, NavLink } from "react-router-dom";
import logo from "../assets/logo.png";
import SEO from "../components/SEO";

// Per the wireframe (2j / 3b): a left sidebar on desktop, a bottom tab bar
// on a phone — a volunteer posting an event from a phone needs the tabs
// reachable with a thumb, not hidden behind a hamburger.
const tabs = [
  { to: "/admin", end: true, key: "admin.overview" },
  { to: "/admin/events", key: "admin.manage_events" },
  { to: "/admin/reflections", key: "admin.manage_reflections" },
  { to: "/admin/ministries", key: "admin.manage_ministries" },
  { to: "/admin/messages", key: "admin.manage_messages" },
  { to: "/admin/gallery", key: "admin.manage_gallery" },
];

export default function AdminDashboard() {
  const { t, language } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  // Track auth state and session timeout
  useEffect(() => {
    const unsub = onAuthStateChanged((u) => {
      setUser(u);
      if (u) {
        // User logged in - start session timeout tracking
        startSessionTimeout({
          onWarning: () => setShowTimeoutWarning(true),
          onTimeout: () => {
            void logAuditAction('auth.logout', { reason: 'session_timeout' });
          }
        });
      } else {
        // User logged out - stop tracking
        stopSessionTimeout();
      }
    });

    return () => {
      unsub();
      stopSessionTimeout();
    };
  }, []);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 ${
      isActive ? "text-brand-600 bg-slate-100" : "text-slate-600 hover:bg-slate-100"
    }`;

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `flex-none w-1/4 min-w-[80px] py-2.5 text-center ${isActive ? "text-brand-600" : "text-slate-600"}`;

  return (
    <div className="min-h-screen bg-surface">
      <SEO title="Admin" noindex />
      {showTimeoutWarning && (
        <SessionTimeoutWarning onDismiss={() => setShowTimeoutWarning(false)} />
      )}

      <div className="md:flex">
        {/* Sidebar — desktop only */}
        <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 md:min-h-screen bg-slate-100 border-r border-slate-200 p-4 gap-1">
          <div className="flex items-center gap-2.5 px-2 py-3 mb-2">
            <img src={logo} alt="Logo" className="h-8 w-8 rounded-full object-cover" />
            <span className="font-serif font-bold text-sm text-slate-900">Anê Thành</span>
          </div>
          {tabs.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={tab.end} className={navClass}>
              {t(tab.key)}
            </NavLink>
          ))}
          <div className="flex-1" />
          {user && (
            <div className="px-2 py-3 border-t border-slate-200">
              <p className="text-xs text-slate-600">{language === 'vi' ? 'Đăng nhập với' : 'Signed in as'}</p>
              <p className="text-sm font-semibold text-slate-900 truncate">{user.email}</p>
              <button
                onClick={() => void logout()}
                className="text-xs font-semibold text-slate-600 hover:text-red-600 mt-1"
              >
                {t('admin.logout')}
              </button>
            </div>
          )}
        </aside>

        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between bg-slate-100 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="h-7 w-7 rounded-full object-cover" />
            <span className="font-serif font-bold text-sm text-slate-900">Anê Thành</span>
          </div>
          {user && (
            <span className="text-xs font-semibold text-slate-600">{user.email?.split('@')[0]}</span>
          )}
        </header>

        <main className="flex-1 pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Bottom tab bar — mobile only. All tabs are reachable: 4 fit the
          screen at once and the rest scroll into view, instead of the first
          4 permanently hiding Messages and Gallery. */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex overflow-x-auto bg-slate-100 border-t border-slate-200">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={tabClass}>
            <span className="text-xs font-semibold whitespace-nowrap">{t(tab.key)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
