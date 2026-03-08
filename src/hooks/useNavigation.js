import { useState, useCallback } from 'react';

export function useNavigation(initialView = 'dashboard') {
  const [view, setView] = useState(initialView);
  const [viewStack, setViewStack] = useState([initialView]);

  const navigate = useCallback((newView) => {
    setView(newView);
    setViewStack(prev => [...prev, newView]);
  }, []);

  const goBack = useCallback(() => {
    setViewStack(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.slice(0, -1);
      setView(next[next.length - 1]);
      return next;
    });
  }, []);

  return { view, navigate, goBack };
}
