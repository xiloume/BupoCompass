import React, { useEffect, useState } from 'react';

export default function Toast({ message, onDismiss, duration = 3000 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg
        bg-emerald-500/20 border border-emerald-400/30 backdrop-blur-sm
        text-emerald-300 text-xs font-medium shadow-lg
        transition-all duration-300 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}
    >
      {message}
    </div>
  );
}
