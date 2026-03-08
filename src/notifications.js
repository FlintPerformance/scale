const PREFS_KEY = 'scale-notif-prefs';

const DEFAULTS = {
  enabled: false,
  dailyReminder: true,
  dailyTime: '08:00',
  weeklyProgress: true,
  weeklyDay: 0, // Sunday
};

export function getNotifPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveNotifPrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  scheduleNotifications(prefs);
}

export function isNotificationSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export async function requestPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  const result = await Notification.requestPermission();
  return result;
}

export function getPermissionStatus() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/** Send a message to the service worker to schedule notifications */
export async function scheduleNotifications(prefs) {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  const reg = await navigator.serviceWorker.ready;
  reg.active?.postMessage({
    type: 'SCHEDULE_NOTIFICATIONS',
    prefs,
  });
}

/** Initialize notifications on app load — reschedule if enabled */
export async function initNotifications() {
  const prefs = getNotifPrefs();
  if (!prefs.enabled) return;
  if (Notification.permission !== 'granted') return;
  await scheduleNotifications(prefs);
}

/** Build a weekly progress summary string from weight entries */
export function buildWeeklySummary(weights, unit) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const weekStr = weekAgo.toISOString().slice(0, 10);

  const thisWeek = weights.filter(w => w.date >= weekStr);
  if (thisWeek.length === 0) return 'No entries this week. Get back on track!';

  const sorted = [...thisWeek].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0].weight;
  const last = sorted[sorted.length - 1].weight;
  const diff = last - first;
  const sign = diff > 0 ? '+' : '';

  return `${thisWeek.length} entries this week · ${sign}${diff.toFixed(1)} ${unit} change`;
}
