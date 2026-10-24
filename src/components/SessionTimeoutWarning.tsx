import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDialog } from '../hooks/useDialog';
import { extendSession, getTimeRemaining } from '../lib/sessionTimeout';

interface SessionTimeoutWarningProps {
  onDismiss: () => void;
}

export default function SessionTimeoutWarning({ onDismiss }: SessionTimeoutWarningProps) {
  const { language } = useLanguage();
  const [timeLeft, setTimeLeft] = useState(getTimeRemaining);
  // Parents pass an inline arrow; a ref keeps the 1s interval from restarting every render
  const dialogRef = useRef<HTMLDivElement>(null);
  // Escape must do what "Stay logged in" does, or a keyboard user would lose
  // the dialog but not the countdown and be logged out without further warning.
  useDialog(dialogRef, true, () => {
    extendSession();
    onDismiss();
  });
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getTimeRemaining();
      setTimeLeft(remaining);

      // Auto-dismiss if time runs out
      if (remaining <= 0) {
        onDismissRef.current();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleStayLoggedIn = () => {
    extendSession();
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-warning-title"
        tabIndex={-1}
        className="bg-surface rounded-2xl shadow-[0_2px_6px_rgba(2,2,2,0.14),0_12px_32px_rgba(2,2,2,0.10)] p-6 max-w-md w-full mx-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-surface border border-slate-200 flex items-center justify-center text-brand-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 id="session-warning-title" className="text-lg font-semibold text-slate-900 mb-2">
              {language === 'vi' ? 'Phiên làm việc sắp hết hạn' : 'Session Expiring Soon'}
            </h3>
            <p className="text-slate-600 mb-4">
              {language === 'vi'
                ? `Bạn sẽ tự động đăng xuất sau ${formatTime(timeLeft)} do không hoạt động.`
                : `You will be automatically logged out in ${formatTime(timeLeft)} due to inactivity.`
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleStayLoggedIn}
                className="btn btn-primary flex-1"
              >
                {language === 'vi' ? 'Tiếp tục đăng nhập' : 'Stay Logged In'}
              </button>
              <button
                onClick={onDismiss}
                className="btn btn-outline"
              >
                {language === 'vi' ? 'Đóng' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
