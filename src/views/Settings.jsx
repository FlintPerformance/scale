import React, { useState, useEffect } from 'react';
import { useAppData, useAppActions } from '../App';
import { supabase } from '../supabase';
import { exportAllDB, importAllDB, clearAllDB } from '../db';
import Avatar from '../components/Avatar';
import { getNotifPrefs, saveNotifPrefs, requestPermission, getPermissionStatus, isNotificationSupported } from '../notifications';

export default function Settings() {
  const { user, displayName, unit, syncing } = useAppData();
  const { signOut, sync, changeUnit, showToast, reload } = useAppActions();
  const [confirmClear, setConfirmClear] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [notifPrefs, setNotifPrefs] = useState(getNotifPrefs);
  const [permissionStatus, setPermissionStatus] = useState(getPermissionStatus);

  useEffect(() => {
    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    };
    loadProfile();
  }, [user.id]);

  const handleAvatarUpload = async (file) => {
    try {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Image must be under 2MB', 'error');
        return;
      }

      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const url = `${publicUrl}?t=${Date.now()}`;

      await supabase
        .from('profiles')
        .upsert({ id: user.id, avatar_url: url, display_name: displayName });

      setAvatarUrl(url);
      showToast('Profile picture updated!');
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error');
    }
  };

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

  const handleToggleNotifications = async () => {
    if (!notifPrefs.enabled) {
      const result = await requestPermission();
      setPermissionStatus(result);
      if (result !== 'granted') {
        showToast('Notification permission denied', 'error');
        return;
      }
      const updated = { ...notifPrefs, enabled: true };
      setNotifPrefs(updated);
      saveNotifPrefs(updated);
      showToast('Notifications enabled');
    } else {
      const updated = { ...notifPrefs, enabled: false };
      setNotifPrefs(updated);
      saveNotifPrefs(updated);
      showToast('Notifications disabled');
    }
  };

  const updateNotifPref = (key, value) => {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    saveNotifPrefs(updated);
  };

  const handleClear = async () => {
    await clearAllDB();
    await reload();
    showToast('All local data cleared');
    setConfirmClear(false);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-heading text-2xl font-bold text-cream mb-6">Settings</h1>

      {/* Profile */}
      <div className="bg-surface-mid rounded-sm p-5 border border-white/5 mb-4">
        <div className="flex items-center gap-4">
          <Avatar
            url={avatarUrl}
            name={displayName}
            size="xl"
            editable
            onUpload={handleAvatarUpload}
          />
          <div className="flex-1">
            <p className="text-cream font-medium text-lg">{displayName}</p>
            <p className="text-cream/40 text-xs">{user.email}</p>
            <p className="text-cream/30 text-[10px] mt-1">Tap photo to change</p>
          </div>
        </div>
      </div>

      {/* Desktop two-column layout for settings cards */}
      <div className="desktop:grid desktop:grid-cols-2 desktop:gap-4">
        {/* Unit Preference */}
        <div className="bg-surface-mid rounded-sm p-4 border border-white/5 mb-4 desktop:mb-0">
          <p className="text-cream/50 text-xs uppercase tracking-wider mb-3">Weight Unit</p>
          <div className="flex gap-2">
            {['lb', 'kg'].map(u => (
              <button
                key={u}
                onClick={() => changeUnit(u)}
                className={`flex-1 py-2.5 rounded-sm font-semibold text-sm transition-colors ${
                  unit === u ? 'bg-accent text-white' : 'bg-surface-up text-cream/50 border border-white/10 hover:border-accent/30'
                }`}
              >
                {u === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}
              </button>
            ))}
          </div>
        </div>

        {/* Sync */}
        <div className="bg-surface-mid rounded-sm p-4 border border-white/5 mb-4 desktop:mb-0">
          <p className="text-cream/50 text-xs uppercase tracking-wider mb-3">Cloud Sync</p>
          <button
            onClick={sync}
            disabled={syncing}
            className="w-full bg-surface-up border border-white/10 hover:border-accent/30 text-cream py-2.5 rounded-sm font-medium text-sm transition-colors disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {isNotificationSupported() && (
        <div className="bg-surface-mid rounded-sm p-4 border border-white/5 mb-4 mt-0 desktop:mt-4">
          <p className="text-cream/50 text-xs uppercase tracking-wider mb-3">Notifications</p>

          {permissionStatus === 'denied' && (
            <p className="text-cream/40 text-xs mb-3">Notifications are blocked. Enable them in your browser settings.</p>
          )}

          {/* Master toggle */}
          <label className="flex items-center justify-between cursor-pointer select-none mb-3">
            <span className="text-cream text-sm">Enable notifications</span>
            <div className="relative" onClick={handleToggleNotifications}>
              <div className={`w-9 h-5 rounded-full border transition-colors ${notifPrefs.enabled ? 'bg-accent border-accent' : 'bg-surface-up border-white/10'}`} />
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-cream rounded-full shadow transition-transform ${notifPrefs.enabled ? 'translate-x-4' : ''}`} />
            </div>
          </label>

          {notifPrefs.enabled && (
            <div className="space-y-3 border-t border-white/5 pt-3">
              {/* Daily reminder */}
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="text-cream/70 text-sm">Daily weigh-in reminder</span>
                <div className="relative" onClick={() => updateNotifPref('dailyReminder', !notifPrefs.dailyReminder)}>
                  <div className={`w-9 h-5 rounded-full border transition-colors ${notifPrefs.dailyReminder ? 'bg-accent border-accent' : 'bg-surface-up border-white/10'}`} />
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-cream rounded-full shadow transition-transform ${notifPrefs.dailyReminder ? 'translate-x-4' : ''}`} />
                </div>
              </label>

              {notifPrefs.dailyReminder && (
                <div className="flex items-center justify-between">
                  <span className="text-cream/40 text-xs">Reminder time</span>
                  <input
                    type="time"
                    value={notifPrefs.dailyTime}
                    onChange={e => updateNotifPref('dailyTime', e.target.value)}
                    className="bg-surface-up border border-white/10 rounded-sm px-2 py-1 text-cream text-xs"
                  />
                </div>
              )}

              {/* Weekly progress */}
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="text-cream/70 text-sm">Weekly progress summary</span>
                <div className="relative" onClick={() => updateNotifPref('weeklyProgress', !notifPrefs.weeklyProgress)}>
                  <div className={`w-9 h-5 rounded-full border transition-colors ${notifPrefs.weeklyProgress ? 'bg-accent border-accent' : 'bg-surface-up border-white/10'}`} />
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-cream rounded-full shadow transition-transform ${notifPrefs.weeklyProgress ? 'translate-x-4' : ''}`} />
                </div>
              </label>

              {notifPrefs.weeklyProgress && (
                <div className="flex items-center justify-between">
                  <span className="text-cream/40 text-xs">Summary day</span>
                  <select
                    value={notifPrefs.weeklyDay}
                    onChange={e => updateNotifPref('weeklyDay', Number(e.target.value))}
                    className="bg-surface-up border border-white/10 rounded-sm px-2 py-1 text-cream text-xs"
                  >
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Data Management */}
      <div className="bg-surface-mid rounded-sm p-4 border border-white/5 mb-4 mt-0 desktop:mt-4">
        <p className="text-cream/50 text-xs uppercase tracking-wider mb-3">Data</p>
        <div className="space-y-2">
          <button onClick={handleExport} className="w-full bg-surface-up border border-white/10 text-cream py-2.5 rounded-sm text-sm hover:border-accent/30 transition-colors">
            Export Data
          </button>
          <button onClick={handleImport} className="w-full bg-surface-up border border-white/10 text-cream py-2.5 rounded-sm text-sm hover:border-accent/30 transition-colors">
            Import Data
          </button>
          {!confirmClear ? (
            <button onClick={() => setConfirmClear(true)} className="w-full bg-surface-up border border-white/10 text-danger/60 py-2.5 rounded-sm text-sm hover:border-danger/30 transition-colors">
              Clear All Local Data
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleClear} className="flex-1 bg-danger text-white py-2.5 rounded-sm text-sm font-semibold">
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
        className="w-full bg-surface-up border border-white/10 text-cream/60 py-3 rounded-sm font-medium text-sm hover:text-cream hover:border-white/20 transition-colors"
      >
        Sign Out
      </button>

      <p className="text-center text-cream/20 text-xs mt-6 mb-4">
        FLINT. Scale v1.0.0 · Build {typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev'}
      </p>
    </div>
  );
}
