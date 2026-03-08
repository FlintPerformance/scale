import React, { createContext, useContext, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { useAuth } from './hooks/useAuth';
import { useLocalData } from './hooks/useLocalData';
import { useNavigation } from './hooks/useNavigation';
import { useUpdateCheck } from './hooks/useUpdateCheck';
import { syncData, pullFromCloud } from './sync';
import AuthView from './views/AuthView';
import Onboarding from './views/Onboarding';
import Dashboard from './views/Dashboard';
import LogWeight from './views/LogWeight';
import History from './views/History';
import Goals from './views/Goals';
import Circle from './views/Circle';
import Settings from './views/Settings';
import Layout from './components/Layout';
import Toast from './components/Toast';

const AppDataContext = createContext(null);
const AppActionsContext = createContext(null);

export function useAppData() { return useContext(AppDataContext); }
export function useAppActions() { return useContext(AppActionsContext); }
export function useApp() {
  return { ...useAppData(), ...useAppActions() };
}

export default function App() {
  const { user, loading: authLoading, signUp, signIn, signOut } = useAuth();
  const { view, navigate, goBack } = useNavigation('dashboard');
  useUpdateCheck();
  const data = useLocalData(user?.id);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  const [unit, setUnit] = useState(() => localStorage.getItem('scale-unit') || 'lb');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingInvite, setPendingInvite] = useState(() => {
    const code = new URLSearchParams(window.location.search).get('join');
    if (code) window.history.replaceState({}, '', window.location.pathname);
    return code || null;
  });

  // Show onboarding for new users who haven't completed it and have no weight data
  const checkOnboarding = useCallback(() => {
    if (user && data.loaded && data.weights.length === 0 && !localStorage.getItem('scale-onboarding-done')) {
      setShowOnboarding(true);
    }
  }, [user, data.loaded, data.weights.length]);

  // Run check when data loads
  React.useEffect(() => { checkOnboarding(); }, [checkOnboarding]);

  // Auto-navigate to circle if invite code in URL
  React.useEffect(() => {
    if (pendingInvite && user) navigate('circle');
  }, [pendingInvite, user, navigate]);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem('scale-onboarding-done', '1');
    setShowOnboarding(false);
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSync = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    try {
      await syncData(user.id);
      await data.reload();
      showToast('Synced successfully');
    } catch (err) {
      showToast('Sync failed: ' + err.message, 'error');
    } finally {
      setSyncing(false);
    }
  }, [user, data, showToast]);

  const changeUnit = useCallback((u) => {
    setUnit(u);
    localStorage.setItem('scale-unit', u);
  }, []);

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';

  const dataValue = useMemo(() => ({
    user,
    displayName,
    weights: data.weights,
    goals: data.goals,
    loaded: data.loaded,
    syncing,
    unit,
    view,
    pendingInvite
  }), [user, displayName, data.weights, data.goals, data.loaded, syncing, unit, view, pendingInvite]);

  const actionsValue = useMemo(() => ({
    navigate,
    goBack,
    signUp,
    signIn,
    signOut,
    addWeight: data.addWeight,
    updateWeight: data.updateWeight,
    removeWeight: data.removeWeight,
    addGoal: data.addGoal,
    removeGoal: data.removeGoal,
    reload: data.reload,
    sync: handleSync,
    showToast,
    changeUnit,
    clearPendingInvite: () => setPendingInvite(null)
  }), [navigate, goBack, signUp, signIn, signOut, data, handleSync, showToast, changeUnit]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-logo text-5xl font-black tracking-[0.06em] text-cream">FLINT<span className="text-accent">.</span></h1>
          <p className="text-cream/40 mt-2 font-body text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AppActionsContext.Provider value={actionsValue}>
        <AuthView />
        {toast && <Toast message={toast.message} type={toast.type} />}
      </AppActionsContext.Provider>
    );
  }

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <Dashboard />;
      case 'log': return <LogWeight />;
      case 'history': return <History />;
      case 'goals': return <Goals />;
      case 'circle': return <Circle />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  if (showOnboarding) {
    return (
      <AppDataContext.Provider value={dataValue}>
        <AppActionsContext.Provider value={actionsValue}>
          <Onboarding onComplete={completeOnboarding} />
          {toast && <Toast message={toast.message} type={toast.type} />}
        </AppActionsContext.Provider>
      </AppDataContext.Provider>
    );
  }

  return (
    <AppDataContext.Provider value={dataValue}>
      <AppActionsContext.Provider value={actionsValue}>
        <Layout>
          {!data.loaded ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="animate-pulse-accent text-accent font-display text-3xl">Loading data...</div>
            </div>
          ) : (
            <div className="animate-fade-in">
              {renderView()}
            </div>
          )}
        </Layout>
        {toast && <Toast message={toast.message} type={toast.type} />}
      </AppActionsContext.Provider>
    </AppDataContext.Provider>
  );
}
