import React, { useState } from 'react';
import { useAppData, useAppActions } from '../App';
import { exportAllDB, importAllDB, clearAllDB } from '../db';

export default function Settings() {
  const { user, displayName, unit, syncing } = useAppData();
  const { signOut, sync, changeUnit, showToast, reload } = useAppActions();
  const [confirmClear, setConfirmClear] = useState(false);

  const handleExport = async () => {
    try {
      const data = await exportAllDB();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scale-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported');
    } catch {
      showToast('Export failed', 'error');
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const data = JSON.parse(text);
        await importAllDB(data);
        await reload();
        showToast('Data imported');
      } catch {
        showToast('Import failed', 'error');
      }
    };
    input.click();
  };

  const handleClear = async () => {
    await clearAllDB();
    await reload();
    showToast('All local data cleared');
    setConfirmClear(false);
  };

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <h1 className="font-heading text-2xl font-bold text-cream mb-6">Settings</h1>

      {/* Profile */}
      <div className="bg-surface-mid rounded-2xl p-4 border border-white/5 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent text-lg font-bold">
            {displayName[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-cream font-medium">{displayName}</p>
            <p className="text-cream/40 text-xs">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Unit Preference */}
      <div className="bg-surface-mid rounded-2xl p-4 border border-white/5 mb-4">
        <p className="text-cream/50 text-xs uppercase tracking-wider mb-3">Weight Unit</p>
        <div className="flex gap-2">
          {['lb', 'kg'].map(u => (
            <button
              key={u}
              onClick={() => changeUnit(u)}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                unit === u ? 'bg-accent text-white' : 'bg-surface-up text-cream/50 border border-white/10 hover:border-accent/30'
              }`}
            >
              {u === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}
            </button>
          ))}
        </div>
      </div>

      {/* Sync */}
      <div className="bg-surface-mid rounded-2xl p-4 border border-white/5 mb-4">
        <p className="text-cream/50 text-xs uppercase tracking-wider mb-3">Cloud Sync</p>
        <button
          onClick={sync}
          disabled={syncing}
          className="w-full bg-surface-up border border-white/10 hover:border-accent/30 text-cream py-2.5 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Data Management */}
      <div className="bg-surface-mid rounded-2xl p-4 border border-white/5 mb-4">
        <p className="text-cream/50 text-xs uppercase tracking-wider mb-3">Data</p>
        <div className="space-y-2">
          <button onClick={handleExport} className="w-full bg-surface-up border border-white/10 text-cream py-2.5 rounded-xl text-sm hover:border-accent/30 transition-colors">
            Export Data
          </button>
          <button onClick={handleImport} className="w-full bg-surface-up border border-white/10 text-cream py-2.5 rounded-xl text-sm hover:border-accent/30 transition-colors">
            Import Data
          </button>
          {!confirmClear ? (
            <button onClick={() => setConfirmClear(true)} className="w-full bg-surface-up border border-white/10 text-danger/60 py-2.5 rounded-xl text-sm hover:border-danger/30 transition-colors">
              Clear All Local Data
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleClear} className="flex-1 bg-danger text-white py-2.5 rounded-xl text-sm font-semibold">
                Confirm Clear
              </button>
              <button onClick={() => setConfirmClear(false)} className="px-4 text-cream/40 text-sm">Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* Sign Out */}
      <button
        onClick={signOut}
        className="w-full bg-surface-up border border-white/10 text-cream/60 py-3 rounded-xl font-medium text-sm hover:text-cream hover:border-white/20 transition-colors"
      >
        Sign Out
      </button>

      <p className="text-center text-cream/20 text-xs mt-6">SCALE. v1.0.0</p>
    </div>
  );
}
