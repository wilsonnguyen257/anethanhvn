/**
 * Session timeout utility for automatic logout after inactivity
 * Monitors user activity and enforces security policies
 * 
 * Default configuration:
 * - Timeout: 30 minutes of inactivity
 * - Warning: 5 minutes before timeout
 * - Tracked events: mouse, keyboard, touch, scroll
 */

import { logout } from './firebase';

/** Duration of inactivity before automatic logout (30 minutes) */
const TIMEOUT_DURATION = 30 * 60 * 1000;

/** Duration before timeout to show warning (5 minutes) */
const WARNING_DURATION = 5 * 60 * 1000;

let timeoutId: NodeJS.Timeout | null = null;
let warningId: NodeJS.Timeout | null = null;
let lastActivity = Date.now();
let onWarningCallback: (() => void) | null = null;
let onTimeoutCallback: (() => void) | null = null;

/**
 * Reset the inactivity timer
 * Called internally when user activity is detected
 */
function resetTimer(): void {
  lastActivity = Date.now();

  // Clear existing timers
  if (timeoutId) clearTimeout(timeoutId);
  if (warningId) clearTimeout(warningId);

  // Set warning timer (5 minutes before timeout)
  warningId = setTimeout(() => {
    if (onWarningCallback) {
      onWarningCallback();
    }
  }, TIMEOUT_DURATION - WARNING_DURATION);

  // Set logout timer
  timeoutId = setTimeout(() => {
    handleTimeout();
  }, TIMEOUT_DURATION);
}

/**
 * Handle session timeout - logout user and notify
 * Called automatically after inactivity period
 */
async function handleTimeout(): Promise<void> {
  if (onTimeoutCallback) {
    onTimeoutCallback();
  }
  stopSessionTimeout();

  try {
    await logout();
  } catch (error) {
    console.error('Error during auto-logout:', error);
  }
}

/**
 * Track user activity and reset timeout
 * Called on user interaction events
 */
function trackActivity(): void {
  // mousemove/scroll fire at event rate; resetting at most once a second is plenty
  if (Date.now() - lastActivity < 1000) return;
  resetTimer();
}

/**
 * Start monitoring user activity for session timeout
 * Should be called when user logs in or when admin panel loads
 * 
 * @param options - Optional callbacks for warning and timeout events
 * @param options.onWarning - Called 5 minutes before timeout
 * @param options.onTimeout - Called when session times out
 * 
 * @example
 * startSessionTimeout({
 *   onWarning: () => setShowWarning(true),
 *   onTimeout: () => navigate('/login')
 * });
 */
export function startSessionTimeout(options?: {
  onWarning?: () => void;
  onTimeout?: () => void;
}): void {
  // Make start idempotent so repeated calls don't stack timers or listeners
  stopSessionTimeout();

  if (options?.onWarning) {
    onWarningCallback = options.onWarning;
  }
  if (options?.onTimeout) {
    onTimeoutCallback = options.onTimeout;
  }

  // Track various user activities
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  
  events.forEach(event => {
    document.addEventListener(event, trackActivity, { passive: true });
  });

  // Start the initial timer
  resetTimer();
}

/**
 * Stop monitoring user activity and clear all timers
 * Should be called when user logs out or leaves admin panel
 */
export function stopSessionTimeout(): void {
  if (timeoutId) clearTimeout(timeoutId);
  if (warningId) clearTimeout(warningId);
  
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  events.forEach(event => {
    document.removeEventListener(event, trackActivity);
  });
  
  onWarningCallback = null;
  onTimeoutCallback = null;
}

/**
 * Get remaining time before session timeout
 * Useful for displaying countdown timers
 * 
 * @returns Milliseconds remaining until timeout (minimum 0)
 * 
 * @example
 * const remaining = getTimeRemaining();
 * const minutes = Math.floor(remaining / 60000);
 */
export function getTimeRemaining(): number {
  const elapsed = Date.now() - lastActivity;
  const remaining = TIMEOUT_DURATION - elapsed;
  return Math.max(0, remaining);
}

/**
 * Manually extend the user's session
 * Resets the inactivity timer as if user just performed an action
 * 
 * @example
 * // User clicks "Stay Logged In" button
 * extendSession();
 */
export function extendSession(): void {
  resetTimer();
}
