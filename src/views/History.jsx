import React, { useState, useMemo } from 'react';
import { useAppData, useAppActions } from '../App';
import { formatDate, formatWeight, getMovingAverage, formatDateShort, aggregateDaily, buildCandlestickData } from '../utils';
import { ResponsiveContainer, LineChart, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';

function CandlestickShape({ x, y, width, height, payload }) {
  if (!payload) return null;
  const { low, high, open, close, morning, count } = payload;
  const cx = x + width / 2;
  const absH = Math.abs(height);
  const top = height >= 0 ? y : y + height;

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
  const openY = top + (high - open) * pxPerUnit;
  const closeY = top + (high - close) * pxPerUnit;
  const bodyTop = Math.min(openY, closeY);
  const bodyH = Math.max(2, Math.abs(closeY - openY));
  const bullish = close <= open;

  return (
    <g>
      <rect x={cx - wickWidth / 2} y={top} width={wickWidth} height={absH} fill="#ede8df20" rx={1} />
      <rect x={cx - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyH} fill={bullish ? '#22c55e' : '#f04a0e'} rx={1.5} opacity={0.85} />
      {morning != null && (
        <circle cx={cx} cy={top + (high - morning) * pxPerUnit} r={Math.max(3, width * 0.22)} fill="#f04a0e" stroke="#ede8df" strokeWidth={1.5} />
      )}
    </g>
  );
}

export default function History() {
  const { weights, goals, unit } = useAppData();
  const { removeWeight, navigate } = useAppActions();
  const [range, setRange] = useState('30');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [chartMode, setChartMode] = useState('line');

  const activeGoal = goals.find(g => g.active);

  const filtered = useMemo(() => {
    if (range === 'all') return weights;
    const days = parseInt(range);
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    return weights.filter(w => w.date >= cutoff);
  }, [weights, range]);

  const chartData = useMemo(() => {
    const daily = aggregateDaily([...filtered], 'morning');
    return getMovingAverage(daily);
  }, [filtered]);

  const candlestickData = useMemo(() => {
    if (chartMode !== 'candle') return [];
    return buildCandlestickData([...filtered]);
  }, [filtered, chartMode]);

  const candleDomain = useMemo(() => {
    if (!candlestickData.length) return ['auto', 'auto'];
    const allLows = candlestickData.map(d => d.low);
    const allHighs = candlestickData.map(d => d.high);
    const min = Math.floor(Math.min(...allLows) - 1);
    const max = Math.ceil(Math.max(...allHighs) + 1);
    return [min, max];
  }, [candlestickData]);

  const handleDelete = async (id) => {
    await removeWeight(id);
    setConfirmDelete(null);
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-heading text-2xl font-bold text-cream">History</h1>
        <div className="flex gap-1 bg-surface-up rounded-sm p-0.5">
          {[['7', '7d'], ['30', '30d'], ['90', '90d'], ['all', 'All']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setRange(val)}
              className={`px-2.5 py-1 rounded-sm text-xs font-medium transition-colors ${
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
        <div className="bg-surface-mid rounded-sm p-4 border border-white/5 mb-4">
          <div className="flex items-center justify-end mb-2">
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
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fill: '#ede8df66', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#ede8df66', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: '#161616', border: '1px solid rgba(237,232,223,0.06)', borderRadius: 2, color: '#ede8df' }}
                  labelFormatter={formatDateShort}
                />
                {activeGoal && (
                  <ReferenceLine y={activeGoal.targetWeight} stroke="#fbbf24" strokeDasharray="6 3" label={{ value: 'Goal', fill: '#fbbf24', fontSize: 10 }} />
                )}
                <Line type="monotone" dataKey="weight" stroke="#f04a0e" strokeWidth={2} dot={{ r: 3, fill: '#f04a0e', stroke: '#ede8df44', strokeWidth: 1 }} activeDot={{ r: 5, fill: '#f04a0e', stroke: '#ede8df', strokeWidth: 2 }} />
                <Line type="monotone" dataKey="average" stroke="#b8ccda" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={candlestickData}>
                <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fill: '#ede8df66', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={candleDomain} tick={{ fill: '#ede8df66', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
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
                {activeGoal && (
                  <ReferenceLine y={activeGoal.targetWeight} stroke="#fbbf24" strokeDasharray="6 3" label={{ value: 'Goal', fill: '#fbbf24', fontSize: 10 }} />
                )}
                <Bar dataKey="range" fill="transparent" isAnimationActive={false} shape={<CandlestickShape />} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
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
          <div key={entry.id} className="bg-surface-mid rounded-sm p-3 border border-white/5 flex items-center justify-between group">
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-cream font-semibold">{formatWeight(entry.weight, unit)}</span>
                {entry.isMorning && (
                  <span className="text-accent text-[10px] uppercase tracking-wider font-medium">AM</span>
                )}
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
