import React, { useState, useMemo } from 'react';
import { useAppData, useAppActions } from '../App';
import { todayStr } from '../utils';

export default function LogWeight() {
  const { unit, weights } = useAppData();
  const { addWeight, navigate, showToast } = useAppActions();
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [isMorning, setIsMorning] = useState(false);
  const [saving, setSaving] = useState(false);

  const lastWeight = weights[0]?.weight;

  const hasMorningForDate = useMemo(() => {
    return weights.some(w => w.date === date && w.isMorning);
  }, [weights, date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!weight || isNaN(weight)) {
      showToast('Enter a valid weight', 'error');
      return;
    }
    if (isMorning && hasMorningForDate) {
      showToast('Morning weight already logged for this date', 'error');
      return;
    }
    setSaving(true);
    try {
      await addWeight(weight, unit, date, notes, isMorning);
      showToast('Weight logged!');
      navigate('dashboard');
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const diff = lastWeight && weight ? (Number(weight) - lastWeight) : null;

  return (
    <div className="max-w-xl">
      <h1 className="font-heading text-2xl font-bold text-cream mb-6">Log Weight</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Weight Input */}
        <div className="bg-surface-mid rounded-sm p-6 border border-white/5 text-center">
          <label className="block text-cream/50 text-xs uppercase tracking-wider mb-3">Weight ({unit})</label>
          <input
            type="number"
            step="0.1"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            placeholder={lastWeight ? lastWeight.toFixed(1) : '0.0'}
            className="bg-transparent border-none text-center font-display text-6xl text-cream w-full focus:ring-0 focus:outline-none"
            autoFocus
          />
          {diff !== null && (
            <p className={`text-sm mt-2 ${diff < 0 ? 'text-success' : diff > 0 ? 'text-danger' : 'text-cream/40'}`}>
              {diff > 0 ? '+' : ''}{diff.toFixed(1)} {unit} from last
            </p>
          )}
        </div>

        {/* Morning Weight Toggle */}
        <label className="flex items-center gap-3 bg-surface-mid rounded-sm px-4 py-3 border border-white/5 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={isMorning}
              onChange={e => setIsMorning(e.target.checked)}
              disabled={hasMorningForDate && !isMorning}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-surface-up rounded-full border border-white/10 peer-checked:bg-accent peer-checked:border-accent transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-cream rounded-full shadow peer-checked:translate-x-4 transition-transform" />
          </div>
          <div className="flex-1">
            <span className="text-cream text-sm font-medium">Morning Weight</span>
            <p className="text-cream/40 text-xs mt-0.5">Used for progress tracking &amp; charts</p>
          </div>
          {hasMorningForDate && !isMorning && (
            <span className="text-accent text-[10px] uppercase tracking-wider">Already logged</span>
          )}
        </label>

        {/* Date */}
        <div>
          <label className="block text-cream/60 text-xs font-medium mb-1 uppercase tracking-wider">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={todayStr()}
            className="w-full"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-cream/60 text-xs font-medium mb-1 uppercase tracking-wider">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How are you feeling? Any context?"
            rows={2}
            className="w-full resize-none"
          />
        </div>

        {/* Quick Buttons */}
        {lastWeight && (
          <div className="flex gap-2 flex-wrap">
            <span className="text-cream/40 text-xs self-center mr-1">Quick:</span>
            {[-1, -0.5, 0, 0.5, 1].map(offset => (
              <button
                key={offset}
                type="button"
                onClick={() => setWeight((lastWeight + offset).toFixed(1))}
                className="bg-surface-up border border-white/10 rounded-sm px-3 py-1.5 text-cream/70 text-xs hover:border-accent/30 transition-colors"
              >
                {offset > 0 ? '+' : ''}{offset === 0 ? lastWeight.toFixed(1) : offset}
              </button>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-accent hover:bg-accent-dark text-white font-semibold py-3.5 rounded-sm transition-colors disabled:opacity-50 text-lg"
        >
          {saving ? 'Saving...' : 'Save Entry'}
        </button>
      </form>
    </div>
  );
}
