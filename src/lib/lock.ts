/**
 * The local screen lock's stored state.
 *
 * Not a security boundary — see the comment on PasscodeLock. This only records
 * that the code has been entered once on this browser.
 */

export const PASSCODE = '0626';

const UNLOCK_KEY = 'jobtracker.unlocked.v1';

export function isUnlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCK_KEY) === 'yes';
  } catch {
    // Private browsing with storage blocked: ask every time rather than fail open.
    return false;
  }
}

export function rememberUnlocked(): void {
  try {
    localStorage.setItem(UNLOCK_KEY, 'yes');
  } catch {
    // Non-fatal — this session is unlocked in memory either way.
  }
}
