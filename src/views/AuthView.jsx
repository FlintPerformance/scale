import React, { useState } from 'react';
import { useAppActions } from '../App';

const FEATURES = [
  { icon: ScaleIcon, text: 'Log daily weigh-ins in seconds' },
  { icon: ChartIcon, text: 'Visualize trends & moving averages' },
  { icon: TargetIcon, text: 'Set goals & track progress' },
  { icon: UsersIcon, text: 'Share progress with your circle' },
  { icon: SyncIcon, text: 'Sync data across all your devices' }
];

export default function AuthView() {
  const { signIn, signUp, showToast } = useAppActions();
  const [mode, setMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName || email.split('@')[0]);
        showToast('Check your email to confirm your account', 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] bg-surface flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-4">
          <h1 className="font-logo text-5xl font-black tracking-[0.06em] text-cream">FLINT<span className="text-accent">.</span></h1>
          <p className="text-[10px] uppercase tracking-[0.32em] text-muted mt-1">Bodyweight Tracker</p>
        </div>

        {/* Feature list - compact */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mb-5">
          {FEATURES.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <f.icon />
              <span className="text-cream/40 text-xs font-body">{f.text}</span>
            </div>
          ))}
        </div>

        {/* Form heading */}
        <h2 className="font-heading font-bold text-sm text-cream text-center uppercase tracking-wider mb-3">
          {mode === 'signup' ? 'Create Your Account' : 'Welcome Back'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          {mode === 'signup' && (
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="w-full"
            />
          )}

          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full"
          />

          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password (min. 6 characters)"
            required
            minLength={6}
            className="w-full"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-dark text-white font-heading font-bold uppercase tracking-wider py-3 rounded-sm transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center mt-4 text-cream/40 text-sm">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-accent hover:underline"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}

function ScaleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent flex-shrink-0">
      <path d="M12 3v17M5 8l7-5 7 5" />
      <rect x="4" y="14" width="16" height="6" rx="1" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent flex-shrink-0">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent flex-shrink-0">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent flex-shrink-0">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent flex-shrink-0">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}
