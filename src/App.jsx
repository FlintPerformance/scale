import React, { createContext, useContext, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { useAuth } from './hooks/useAuth';
import { useLocalData } from './hooks/useLocalData';
import { useNavigation } from './hooks/useNavigation';
import { syncData, pullFromCloud } from './sync';
import AuthView from './views/AuthView';
import Dashboard from './views/Dashboard';
import LogWeight from './views/LogWeight';
import History from './views/History';
import Goals from './views/Goals';
import Circle from './views/Circle';
import Settings from './views/Settings';
import BottomNav from './components/BottomNav';
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
  const data = useLocalData(user?.id);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  const [unit, setUnit] = useState(() => localStorage.getItem('scale-unit') || 'lb');

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
    view
  }), [user, displayName, data.weights, data.goals, data.loaded, syncing, unit, view]);

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
    changeUnit
  }), [navigate, goBack, signUp, signIn, signOut, data, handleSync, showToast, changeUnit]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-heading font-black text-5xl text-cream tracking-wider">FLINT<span className="text-accent">.</span></h1>
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

  return (
    <AppDataContext.Provider value={dataValue}>
      <AppActionsContext.Provider value={actionsValue}>
        <div className="min-h-screen bg-surface pb-20 desktop:pb-0 desktop:pl-56">
          {!data.loaded ? (
            <div className="flex items-center justify-center h-screen">
              <div className="animate-pulse-accent text-accent font-display text-3xl">Loading data...</div>
            </div>
          ) : (
            <div className="animate-fade-in">
              {renderView()}
            </div>
          )}
          <BottomNav />
          {toast && <Toast message={toast.message} type={toast.type} />}
        </div>
      </AppActionsContext.Provider>
    </AppDataContext.Provider>
  );
}
