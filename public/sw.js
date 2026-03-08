const BUILD = '__SW_VERSION__';
const CACHE_NAME = `flint-scale-${BUILD}`;

const PRECACHE = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // Never cache version.json — always fetch fresh
  if (e.request.url.includes('version.json')) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// --- Notification scheduling ---

let dailyTimer = null;
let weeklyTimer = null;

function clearTimers() {
  if (dailyTimer) { clearTimeout(dailyTimer); dailyTimer = null; }
  if (weeklyTimer) { clearTimeout(weeklyTimer); weeklyTimer = null; }
}

function msUntilTime(hour, minute) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

function msUntilWeekday(dayOfWeek, hour, minute) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  const currentDay = now.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil < 0 || (daysUntil === 0 && target <= now)) daysUntil += 7;
  target.setDate(target.getDate() + daysUntil);
  return target.getTime() - now.getTime();
}

function scheduleDailyReminder(hour, minute) {
  if (dailyTimer) clearTimeout(dailyTimer);
  const ms = msUntilTime(hour, minute);
  dailyTimer = setTimeout(() => {
    self.registration.showNotification('FLINT. Scale', {
      body: "Time to log your weight! Consistency is key.",
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: 'daily-reminder',
      renotify: true,
      data: { action: 'open-log' },
    });
    // Reschedule for tomorrow
    scheduleDailyReminder(hour, minute);
  }, ms);
}

function scheduleWeeklyProgress(dayOfWeek, hour, minute) {
  if (weeklyTimer) clearTimeout(weeklyTimer);
  const ms = msUntilWeekday(dayOfWeek, hour, minute);
  weeklyTimer = setTimeout(() => {
    self.registration.showNotification('FLINT. Scale — Weekly Progress', {
      body: "Check your weekly progress and see how far you've come!",
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: 'weekly-progress',
      renotify: true,
      data: { action: 'open-dashboard' },
    });
    // Reschedule for next week
    scheduleWeeklyProgress(dayOfWeek, hour, minute);
  }, ms);
}

// Listen for messages from the app
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (e.data?.type === 'SCHEDULE_NOTIFICATIONS') {
    const prefs = e.data.prefs;
    clearTimers();

    if (!prefs.enabled) return;

    if (prefs.dailyReminder && prefs.dailyTime) {
      const [h, m] = prefs.dailyTime.split(':').map(Number);
      scheduleDailyReminder(h, m);
    }

    if (prefs.weeklyProgress) {
      // Weekly notification at 10:00 AM on the chosen day
      scheduleWeeklyProgress(prefs.weeklyDay, 10, 0);
    }
  }
});

// Handle notification clicks — open/focus the app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow('/');
    })
  );
});
