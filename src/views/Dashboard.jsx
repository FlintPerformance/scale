import React, { useMemo, useState } from 'react';
import { useAppData, useAppActions } from '../App';
import { formatWeight, getWeightChange, getMovingAverage, getStreak, formatDateShort, aggregateDaily, buildCandlestickData } from '../utils';
import { ResponsiveContainer, AreaChart, Area, ComposedChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

function CandlestickShape({ x, y, width, height, payload }) {
  if (!payload) return null;
  const { low, high, open, close, morning, count } = payload;
  const cx = x + width / 2;
  const absH = Math.abs(height);
  const top = height >= 0 ? y : y + height; // top pixel = high value

  // Single entry day — just show a dot
  if (count === 1 || low === high) {
    return (
      <g>
        <line x1={cx - width * 0.3} y1={top} x2={cx + width * 0.3} y2={top} stroke="#f04a0e" strokeWidth={2} strokeLinecap="round" />
        <circle cx={cx} cy={top} r={Math.max(3, width * 0.25)} fill="#f04a0e" stroke="#ede8df" strokeWidth={1.5} />
      </g>
    );
  }

  const pxPerUnit = absH / (high - low);
  const wickWidth = Math.max(1, width * 0.12);
  const bodyWidth = Math.max(4, width * 0.55);

  // Body from open to close
  const openY = top + (high - open) * pxPerUnit;
  const closeY = top + (high - close) * pxPerUnit;
  const bodyTop = Math.min(openY, closeY);
  const bodyH = Math.max(2, Math.abs(closeY - openY));
  const bullish = close <= open; // weight went down = good

  return (
    <g>
      {/* Wick — full day range */}
      <rect x={cx - wickWidth / 2} y={top} width={wickWidth} height={absH} fill="#ede8df20" rx={1} />
      {/* Body — open to close */}
      <rect x={cx - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyH} fill={bullish ? '#22c55e' : '#f04a0e'} rx={1.5} opacity={0.85} />
      {/* Morning weight marker */}
      {morning != null && (
        <circle cx={cx} cy={top + (high - morning) * pxPerUnit} r={Math.max(3, width * 0.22)} fill="#f04a0e" stroke="#ede8df" strokeWidth={1.5} />
      )}
    </g>
  );
}

export default function Dashboard() {
  const { weights, goals, unit, displayName } = useAppData();
  const { navigate } = useAppActions();
  const [chartMode, setChartMode] = useState('line');

  const latest = weights[0];
  const activeGoal = goals.find(g => g.active);
  const streak = getStreak(weights);
  const last30 = weights.filter(w => w.date >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const change = getWeightChange(last30);

  const chartData = useMemo(() => {
    const recent = weights.slice(0, 60);
    const daily = aggregateDaily(recent, 'morning');
    return getMovingAverage(daily);
  }, [weights]);

  const candlestickData = useMemo(() => {
    if (chartMode !== 'candle') return [];
    const recent = weights.slice(0, 60);
    return buildCandlestickData(recent);
  }, [weights, chartMode]);

  const candleDomain = useMemo(() => {
    if (!candlestickData.length) return ['auto', 'auto'];
    const allLows = candlestickData.map(d => d.low);
    const allHighs = candlestickData.map(d => d.high);
    const min = Math.floor(Math.min(...allLows) - 1);
    const max = Math.ceil(Math.max(...allHighs) + 1);
    return [min, max];
  }, [candlestickData]);

  const goalProgress = useMemo(() => {
    if (!activeGoal || !latest) return null;
    const total = Math.abs(activeGoal.startWeight - activeGoal.targetWeight);
    const current = Math.abs(activeGoal.startWeight - latest.weight);
    const pct = total === 0 ? 100 : Math.min(100, Math.round((current / total) * 100));
    return { pct, remaining: activeGoal.targetWeight - latest.weight };
  }, [activeGoal, latest]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-cream/50 text-sm">Welcome back,</p>
          <h1 className="font-heading text-2xl font-bold text-cream">{displayName}</h1>
        </div>
        <button
          onClick={() => navigate('log')}
          className="bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-sm font-semibold text-sm transition-colors"
        >
          + Log Weight
        </button>
      </div>

      {/* Desktop two-column layout */}
      <div className="desktop:grid desktop:grid-cols-2 desktop:gap-4">
        {/* Left column */}
        <div>
          {/* Current Weight Card */}
          <div className="bg-surface-mid rounded-sm p-5 mb-4 border border-white/5">
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
            <div className="bg-surface-mid rounded-sm p-3 border border-white/5 text-center">
              <p className="text-cream/50 text-[10px] uppercase tracking-wider">Streak</p>
              <p className="font-display text-2xl text-accent">{streak}</p>
              <p className="text-cream/40 text-[10px]">days</p>
            </div>
            <div className="bg-surface-mid rounded-sm p-3 border border-white/5 text-center">
              <p className="text-cream/50 text-[10px] uppercase tracking-wider">Entries</p>
              <p className="font-display text-2xl text-cream">{weights.length}</p>
              <p className="text-cream/40 text-[10px]">total</p>
            </div>
            <div
              className="bg-surface-mid rounded-sm p-3 border border-white/5 text-center cursor-pointer hover:border-accent/30"
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

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('history')}
              className="bg-surface-up hover:bg-surface-mid border border-white/5 rounded-sm p-4 text-left transition-colors"
            >
              <p className="text-cream font-medium text-sm">View History</p>
              <p className="text-cream/40 text-xs mt-1">All your entries</p>
            </button>
            <button
              onClick={() => navigate('circle')}
              className="bg-surface-up hover:bg-surface-mid border border-white/5 rounded-sm p-4 text-left transition-colors"
            >
              <p className="text-cream font-medium text-sm">My Circle</p>
              <p className="text-cream/40 text-xs mt-1">Accountability partners</p>
            </button>
          </div>
        </div>

        {/* Right column - Chart */}
        <div>
          {chartData.length > 1 && (
            <div className="bg-surface-mid rounded-sm p-4 border border-white/5 mb-4 mt-4 desktop:mt-0">
              <div className="flex items-center justify-between mb-3">
                <p className="text-cream/50 text-xs uppercase tracking-wider">Weight Trend</p>
                <div className="flex gap-1 bg-surface-up rounded-sm p-0.5">
                  <button
                    onClick={() => setChartMode('line')}
                    className={`px-2 py-0.5 rounded-sm text-[10px] font-medium transition-colors ${chartMode === 'line' ? 'bg-accent text-white' : 'text-cream/50 hover:text-cream'}`}
                  >
                    Line
                  </button>
                  <button
                    onClick={() => setChartMode('candle')}
                    className={`px-2 py-0.5 rounded-sm text-[10px] font-medium transition-colors ${chartMode === 'candle' ? 'bg-accent text-white' : 'text-cream/50 hover:text-cream'}`}
                  >
                    Candle
                  </button>
                </div>
              </div>

              {chartMode === 'line' ? (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f04a0e" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#f04a0e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDateShort}
                        tick={{ fill: '#ede8df66', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fill: '#ede8df66', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{ background: '#161616', border: '1px solid rgba(237,232,223,0.06)', borderRadius: 2, color: '#ede8df' }}
                        labelFormatter={formatDateShort}
                        formatter={(v) => [formatWeight(v, unit)]}
                      />
                      <Area
                        type="monotone"
                        dataKey="weight"
                        stroke="#f04a0e"
                        strokeWidth={2}
                        fill="url(#weightGrad)"
                        dot={(props) => {
                          const { cx, cy, index } = props;
                          const isLast = index === chartData.length - 1;
                          return (
                            <circle
                              key={index}
                              cx={cx}
                              cy={cy}
                              r={isLast ? 5 : 2.5}
                              fill="#f04a0e"
                              stroke={isLast ? '#ede8df' : 'none'}
                              strokeWidth={isLast ? 2 : 0}
                            />
                          );
                        }}
                        activeDot={{ r: 5, fill: '#f04a0e', stroke: '#ede8df', strokeWidth: 2 }}
                      />
                      <Area type="monotone" dataKey="average" stroke="#b8ccda" strokeWidth={1.5} strokeDasharray="4 4" fill="none" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-2 justify-center">
                    <span className="flex items-center gap-1 text-[10px] text-cream/40">
                      <span className="w-3 h-0.5 bg-accent rounded"></span> Morning / Avg
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-cream/40">
                      <span className="w-3 h-0.5 bg-cold rounded border-dashed"></span> 7d Avg
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={candlestickData}>
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDateShort}
                        tick={{ fill: '#ede8df66', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={candleDomain}
                        tick={{ fill: '#ede8df66', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{ background: '#161616', border: '1px solid rgba(237,232,223,0.06)', borderRadius: 2, color: '#ede8df' }}
                        labelFormatter={formatDateShort}
                        formatter={(value, name, { payload }) => {
                          if (name === 'range') {
                            const items = [`Low: ${formatWeight(payload.low, unit)}`, `High: ${formatWeight(payload.high, unit)}`];
                            if (payload.morning != null) items.push(`AM: ${formatWeight(payload.morning, unit)}`);
                            return [items.join('  ·  '), null];
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="range" fill="transparent" isAnimationActive={false} shape={<CandlestickShape />} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-2 justify-center">
                    <span className="flex items-center gap-1 text-[10px] text-cream/40">
                      <span className="w-2 h-3 bg-success rounded-sm opacity-85"></span> Down
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-cream/40">
                      <span className="w-2 h-3 bg-accent rounded-sm opacity-85"></span> Up
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-cream/40">
                      <span className="w-2 h-2 bg-accent rounded-full border border-cream"></span> Morning
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
