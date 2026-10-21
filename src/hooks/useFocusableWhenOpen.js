import { useEffect } from 'react';

// When a dialog with text inputs opens, the overlay needs focusable=true so
// the user can actually type. Restore non-focusable on close so the window
// doesn't steal focus from the game during normal clicks.
export default function useFocusableWhenOpen(open) {
  useEffect(() => {
    if (!window.electronAPI?.setFocusable) return;
    if (open) {
      window.electronAPI.setFocusable(true);
      return () => window.electronAPI.setFocusable(false);
    }
  }, [open]);
}
