import React, { useEffect } from 'react';
import useStore from './store/useStore';
import TitleBar from './components/TitleBar';
import Overlay from './components/Overlay';
import EditorPanel from './components/EditorPanel';
import GameDetectionBanner from './components/GameDetectionBanner';
import syncService from './services/syncService';
import api from './services/api';
import { getTheme } from './themes';

export default function App() {
  const { editorOpen, overlayOpacity, setInteractive, compact, applyRemoteChanges, themeId } = useStore();
  const theme = getTheme(themeId);

  useEffect(() => {
    if (window.electronAPI?.onInteractiveChanged) {
      window.electronAPI.onInteractiveChanged((interactive) => {
        setInteractive(interactive);
      });
    }
  }, [setInteractive]);

  // Initialize sync service
  useEffect(() => {
    window.__syncService = syncService;
    syncService.onRemoteChanges = (changes) => {
      applyRemoteChanges(changes);
    };

    if (api.isAuthenticated()) {
      syncService.start();
    }

    return () => {
      syncService.stop();
      window.__syncService = null;
    };
  }, [applyRemoteChanges]);

  return (
    <div
      className="h-screen w-screen flex flex-col"
      style={{
        backgroundColor: theme.bg.replace('1)', `${overlayOpacity})`),
        borderRadius: '12px',
        border: `1px solid ${theme.border}`,
        '--accent': theme.accent,
        '--accent-hover': theme.accentHover,
        '--progress-bar': theme.progressBar,
        '--progress-mid': theme.progressMid,
        '--progress-low': theme.progressLow,
        '--text': theme.text,
        '--text-muted': theme.textMuted,
        '--surface': theme.surface,
      }}
    >
      <TitleBar />
      {!compact && (
        <div className="px-2 pt-1">
          <GameDetectionBanner />
        </div>
      )}
      <div className="flex-1 overflow-hidden flex">
        <Overlay />
        {editorOpen && <EditorPanel />}
      </div>
    </div>
  );
}
