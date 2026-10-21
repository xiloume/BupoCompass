import { useEffect, useState, useCallback } from 'react';

export function useGameDetection() {
  const [detectedGame, setDetectedGame] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);

  // Subscribe to push events from main process
  useEffect(() => {
    if (!window.electronAPI?.onGameDetected) return;
    const unsub = window.electronAPI.onGameDetected((game) => {
      setDetectedGame(game);
    });

    // Initial detection
    window.electronAPI.detectGameNow?.().then(setDetectedGame).catch(() => {});

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const game = await window.electronAPI?.detectGameNow?.();
      setDetectedGame(game || null);
      return game;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, []);

  const scan = useCallback(async (gameId) => {
    if (!window.electronAPI?.scanGame) return null;
    setScanning(true);
    setError(null);
    try {
      const result = await window.electronAPI.scanGame(gameId);
      setScanResult(result);
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setScanning(false);
    }
  }, []);

  return {
    detectedGame,
    scanning,
    scanResult,
    error,
    refresh,
    scan,
    isElectron: !!window.electronAPI,
  };
}
