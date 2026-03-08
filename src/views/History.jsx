import React, { useState, useMemo } from 'react';
import { useAppData, useAppActions } from '../App';
import { formatDate, formatWeight, getMovingAverage, formatDateShort } from '../utils';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';

export default function History() {
  const { weights, goals, unit } = useAppData();
  const { removeWeight, navigate } = useAppActions();
  const [range, setRange] = useState('30');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const activeGoal = goals.find(g => g.active);

  const filtered = useMemo(() => {
    if (range === 'all') return weights;
    const days = parseInt(range);
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    return weights.filter(w => w.date >= cutoff);
  }, [weights, range]);

  const chartData = useMemo(() => {
    return getMovingAverage([...filtered].reverse());
  }, [filtered]);

  const handleDelete = async (id) => {
    await removeWeight(id);
    setConfirmDelete(null);
  };

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-heading text-2xl font-bold text-cream">History</h1>
        <div className="flex gap-1 bg-surface-up rounded-lg p-0.5">
          {[['7', '7d'], ['30', '30d'], ['90', '90d'], ['all', 'All']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setRange(val)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                range === val ? 'bg-accent text-white' : 'text-cream/50 hover:text-cream'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="bg-surface-mid rounded-2xl p-4 border border-white/5 mb-4">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fill: '#f0ece466', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#f0ece466', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{ background: '#22252f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#f0ece4' }}
                labelFormatter={formatDateShort}
              />
              {activeGoal && (
                <ReferenceLine y={activeGoal.targetWeight} stroke="#fbbf24" strokeDasharray="6 3" label={{ value: 'Goal', fill: '#fbbf24', fontSize: 10 }} />
              )}
              <Line type="monotone" dataKey="weight" stroke="#4f8cff" strokeWidth={2} dot={{ r: 2, fill: '#4f8cff' }} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="average" stroke="#34d399" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Entry List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-cream/40">No entries in this range</p>
            <button onClick={() => navigate('log')} className="text-accent text-sm mt-2 hover:underline">Log your first weight</button>
          </div>
        )}
        {filtered.map(entry => (
          <div key={entry.id} className="bg-surface-mid rounded-xl p-3 border border-white/5 flex items-center justify-between group">
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-cream font-semibold">{formatWeight(entry.weight, unit)}</span>
                <span className="text-cream/40 text-xs">{formatDate(entry.date)}</span>
              </div>
              {entry.notes && <p className="text-cream/40 text-xs mt-0.5">{entry.notes}</p>}
            </div>
            {confirmDelete === entry.id ? (
              <div className="flex gap-2">
                <button onClick={() => handleDelete(entry.id)} className="text-danger text-xs font-medium">Delete</button>
                <button onClick={() => setConfirmDelete(null)} className="text-cream/40 text-xs">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(entry.id)}
                className="text-cream/20 hover:text-danger text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
