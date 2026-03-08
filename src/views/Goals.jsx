import React, { useState, useMemo } from 'react';
import { useAppData, useAppActions } from '../App';
import { formatWeight } from '../utils';

export default function Goals() {
  const { goals, weights, unit } = useAppData();
  const { addGoal, removeGoal, showToast } = useAppActions();
  const [targetWeight, setTargetWeight] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [showForm, setShowForm] = useState(false);

  const activeGoal = goals.find(g => g.active);
  const latest = weights[0];

  const progress = useMemo(() => {
    if (!activeGoal || !latest) return null;
    const total = Math.abs(activeGoal.startWeight - activeGoal.targetWeight);
    const current = Math.abs(activeGoal.startWeight - latest.weight);
    const pct = total === 0 ? 100 : Math.min(100, Math.round((current / total) * 100));
    const remaining = activeGoal.targetWeight - latest.weight;
    const direction = activeGoal.targetWeight < activeGoal.startWeight ? 'lose' : 'gain';

    let daysLeft = null;
    if (activeGoal.targetDate) {
      daysLeft = Math.max(0, Math.ceil((new Date(activeGoal.targetDate) - Date.now()) / 86400000));
    }

    const daysPassed = Math.ceil((Date.now() - new Date(activeGoal.startDate).getTime()) / 86400000);
    const ratePerDay = daysPassed > 0 ? current / daysPassed : 0;
    const estDaysRemaining = ratePerDay > 0 ? Math.ceil(Math.abs(remaining) / ratePerDay) : null;

    return { pct, remaining, direction, daysLeft, estDaysRemaining, total, current };
  }, [activeGoal, latest]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!targetWeight) { showToast('Enter a target weight', 'error'); return; }
    await addGoal(targetWeight, unit, targetDate || null);
    showToast('Goal set!');
    setShowForm(false);
    setTargetWeight('');
    setTargetDate('');
  };

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <h1 className="font-heading text-2xl font-bold text-cream mb-6">Goals</h1>

      {activeGoal && progress ? (
        <div className="bg-surface-mid rounded-2xl p-5 border border-white/5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-cream/50 text-xs uppercase tracking-wider">Active Goal</p>
            <button onClick={() => removeGoal(activeGoal.id)} className="text-cream/30 hover:text-danger text-xs">Remove</button>
          </div>

          {/* Progress Ring */}
          <div className="flex items-center gap-6 mb-4">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none" stroke="#4f8cff" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${progress.pct * 2.64} ${264 - progress.pct * 2.64}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-2xl text-accent">{progress.pct}%</span>
              </div>
            </div>
            <div>
              <p className="text-cream text-lg font-semibold">
                {progress.direction === 'lose' ? 'Lose' : 'Gain'} {formatWeight(progress.total, unit)}
              </p>
              <p className="text-cream/50 text-sm">
                Target: {formatWeight(activeGoal.targetWeight, unit)}
              </p>
              <p className="text-cream/40 text-xs mt-1">
                {Math.abs(progress.remaining).toFixed(1)} {unit} remaining
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-up rounded-lg p-3">
              <p className="text-cream/40 text-[10px] uppercase">Started at</p>
              <p className="text-cream font-medium">{formatWeight(activeGoal.startWeight, unit)}</p>
            </div>
            <div className="bg-surface-up rounded-lg p-3">
              <p className="text-cream/40 text-[10px] uppercase">Current</p>
              <p className="text-cream font-medium">{latest ? formatWeight(latest.weight, unit) : '—'}</p>
            </div>
            {progress.daysLeft !== null && (
              <div className="bg-surface-up rounded-lg p-3">
                <p className="text-cream/40 text-[10px] uppercase">Days Left</p>
                <p className="text-cream font-medium">{progress.daysLeft}</p>
              </div>
            )}
            {progress.estDaysRemaining && (
              <div className="bg-surface-up rounded-lg p-3">
                <p className="text-cream/40 text-[10px] uppercase">Est. Days to Goal</p>
                <p className="text-cream font-medium">{progress.estDaysRemaining}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-surface-mid rounded-2xl p-6 border border-white/5 text-center mb-4">
          <p className="text-cream/50 mb-3">No active goal</p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-accent hover:bg-accent-dark text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
            >
              Set a Goal
            </button>
          )}
        </div>
      )}

      {/* Create Goal Form */}
      {(showForm || (!activeGoal)) && showForm && (
        <form onSubmit={handleCreate} className="bg-surface-mid rounded-2xl p-5 border border-white/5 space-y-4">
          <h2 className="font-heading text-lg font-semibold text-cream">New Goal</h2>
          <div>
            <label className="block text-cream/60 text-xs font-medium mb-1 uppercase tracking-wider">Target Weight ({unit})</label>
            <input
              type="number"
              step="0.1"
              value={targetWeight}
              onChange={e => setTargetWeight(e.target.value)}
              placeholder="e.g. 175.0"
              className="w-full"
              required
            />
          </div>
          <div>
            <label className="block text-cream/60 text-xs font-medium mb-1 uppercase tracking-wider">Target Date (optional)</label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="flex-1 bg-accent hover:bg-accent-dark text-white font-semibold py-2.5 rounded-xl transition-colors">
              Set Goal
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 text-cream/40 hover:text-cream text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Past Goals */}
      {goals.filter(g => !g.active).length > 0 && (
        <div className="mt-6">
          <p className="text-cream/40 text-xs uppercase tracking-wider mb-3">Past Goals</p>
          <div className="space-y-2">
            {goals.filter(g => !g.active).map(g => (
              <div key={g.id} className="bg-surface-up rounded-xl p-3 border border-white/5 flex justify-between items-center">
                <div>
                  <p className="text-cream/60 text-sm">Target: {formatWeight(g.targetWeight, unit)}</p>
                  <p className="text-cream/30 text-xs">From {formatWeight(g.startWeight, unit)}</p>
                </div>
                <button onClick={() => removeGoal(g.id)} className="text-cream/20 hover:text-danger text-xs">Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
