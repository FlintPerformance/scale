import { useState, useEffect, useCallback } from 'react';

const CURRENT_BUILD = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  // Poll version.json for new builds
  useEffect(() => {
    if (CURRENT_BUILD === 'dev') return;

    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.build && data.build !== CURRENT_BUILD) {
          setUpdateAvailable(true);
        }
      } catch {}
    };

    // Check shortly after load, then on interval
    const initialTimeout = setTimeout(checkVersion, 10_000);
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  // Listen for service worker updates
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleControllerChange = () => {
      // New SW has taken over — reload
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    navigator.serviceWorker.ready.then(registration => {
      // Check if there's already a waiting worker
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setUpdateAvailable(true);
      }

      // Listen for new updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setUpdateAvailable(true);
          }
        });
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage('SKIP_WAITING');
    } else {
      // No waiting worker — just hard reload
      window.location.reload();
    }
  }, [waitingWorker]);

  return { updateAvailable, currentBuild: CURRENT_BUILD, applyUpdate };
}
