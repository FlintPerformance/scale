import React, { useMemo } from 'react';
import { useAppData, useAppActions } from '../App';
import { formatWeight, getWeightChange, getMovingAverage, getStreak, formatDateShort } from '../utils';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export default function Dashboard() {
  const { weights, goals, unit, displayName } = useAppData();
  const { navigate } = useAppActions();

  const latest = weights[0];
  const activeGoal = goals.find(g => g.active);
  const streak = getStreak(weights);
  const last30 = weights.filter(w => w.date >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const change = getWeightChange(last30);
  const chartData = useMemo(() => {
    const recent = weights.slice(0, 60).reverse();
    return getMovingAverage(recent);
  }, [weights]);

  const goalProgress = useMemo(() => {
    if (!activeGoal || !latest) return null;
    const total = Math.abs(activeGoal.startWeight - activeGoal.targetWeight);
    const current = Math.abs(activeGoal.startWeight - latest.weight);
    const pct = total === 0 ? 100 : Math.min(100, Math.round((current / total) * 100));
    return { pct, remaining: activeGoal.targetWeight - latest.weight };
  }, [activeGoal, latest]);

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-cream/50 text-sm">Welcome back,</p>
          <h1 className="font-heading text-2xl font-bold text-cream">{displayName}</h1>
        </div>
        <button
          onClick={() => navigate('log')}
          className="bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors"
        >
          + Log Weight
        </button>
      </div>

      {/* Current Weight Card */}
      <div className="bg-surface-mid rounded-2xl p-5 mb-4 border border-white/5">
        <p className="text-cream/50 text-xs uppercase tracking-wider mb-1">Current Weight</p>
        {latest ? (
          <div className="flex items-end gap-3">
            <span className="font-display text-5xl text-cream">{formatWeight(latest.weight, unit)}</span>
            {change && (
              <span className={`text-sm font-medium mb-2 ${change.change < 0 ? 'text-success' : change.change > 0 ? 'text-danger' : 'text-cream/50'}`}>
                {change.change > 0 ? '+' : ''}{change.change.toFixed(1)} {unit} (30d)
              </span>
            )}
          </div>
        ) : (
          <p className="text-cream/40 text-lg">No entries yet</p>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-surface-mid rounded-xl p-3 border border-white/5 text-center">
          <p className="text-cream/50 text-[10px] uppercase tracking-wider">Streak</p>
          <p className="font-display text-2xl text-accent">{streak}</p>
          <p className="text-cream/40 text-[10px]">days</p>
        </div>
        <div className="bg-surface-mid rounded-xl p-3 border border-white/5 text-center">
          <p className="text-cream/50 text-[10px] uppercase tracking-wider">Entries</p>
          <p className="font-display text-2xl text-cream">{weights.length}</p>
          <p className="text-cream/40 text-[10px]">total</p>
        </div>
        <div
          className="bg-surface-mid rounded-xl p-3 border border-white/5 text-center cursor-pointer hover:border-accent/30"
          onClick={() => navigate('goals')}
        >
          <p className="text-cream/50 text-[10px] uppercase tracking-wider">Goal</p>
          {goalProgress ? (
            <>
              <p className="font-display text-2xl text-accent">{goalProgress.pct}%</p>
              <p className="text-cream/40 text-[10px]">{goalProgress.remaining > 0 ? '+' : ''}{goalProgress.remaining.toFixed(1)} to go</p>
            </>
          ) : (
            <p className="text-cream/40 text-xs mt-1">Set goal</p>
          )}
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="bg-surface-mid rounded-2xl p-4 border border-white/5 mb-4">
          <p className="text-cream/50 text-xs uppercase tracking-wider mb-3">Weight Trend</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f8cff" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#4f8cff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShort}
                tick={{ fill: '#f0ece466', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#f0ece466', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{ background: '#22252f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#f0ece4' }}
                labelFormatter={formatDateShort}
                formatter={(v) => [formatWeight(v, unit)]}
              />
              <Area type="monotone" dataKey="weight" stroke="#4f8cff" strokeWidth={2} fill="url(#weightGrad)" dot={false} />
              <Area type="monotone" dataKey="average" stroke="#34d399" strokeWidth={1.5} strokeDasharray="4 4" fill="none" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center">
            <span className="flex items-center gap-1 text-[10px] text-cream/40">
              <span className="w-3 h-0.5 bg-accent rounded"></span> Weight
            </span>
            <span className="flex items-center gap-1 text-[10px] text-cream/40">
              <span className="w-3 h-0.5 bg-success rounded border-dashed"></span> 7d Avg
            </span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('history')}
          className="bg-surface-up hover:bg-surface-mid border border-white/5 rounded-xl p-4 text-left transition-colors"
        >
          <p className="text-cream font-medium text-sm">View History</p>
          <p className="text-cream/40 text-xs mt-1">All your entries</p>
        </button>
        <button
          onClick={() => navigate('circle')}
          className="bg-surface-up hover:bg-surface-mid border border-white/5 rounded-xl p-4 text-left transition-colors"
        >
          <p className="text-cream font-medium text-sm">My Circle</p>
          <p className="text-cream/40 text-xs mt-1">Accountability partners</p>
        </button>
      </div>
    </div>
  );
}
