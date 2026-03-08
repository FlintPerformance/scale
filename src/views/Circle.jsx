import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppData, useAppActions } from '../App';
import { supabase } from '../supabase';
import { formatWeight, formatDateShort, getWeightChange, getStreak, getTimeAgo, generateId } from '../utils';

export default function Circle() {
  const { user, unit, weights, displayName } = useAppData();
  const { showToast } = useAppActions();
  const [tab, setTab] = useState('feed');
  const [circles, setCircles] = useState([]);
  const [members, setMembers] = useState([]);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [circleName, setCircleName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [cheers, setCheers] = useState({});

  const loadCircleData = useCallback(async () => {
    try {
      // Get user's circles
      const { data: memberRows } = await supabase
        .from('circle_members')
        .select('circle_id, role, circles(id, name, invite_code, created_by)')
        .eq('user_id', user.id);

      const userCircles = (memberRows || []).map(m => ({ ...m.circles, role: m.role }));
      setCircles(userCircles);

      if (userCircles.length === 0) { setLoading(false); return; }

      const circleIds = userCircles.map(c => c.id);

      // Get all members of user's circles
      const { data: allMembers } = await supabase
        .from('circle_members')
        .select('user_id, circle_id, role, profiles(display_name, avatar_url)')
        .in('circle_id', circleIds);

      setMembers(allMembers || []);

      // Get shared weight entries from circle members
      const memberIds = [...new Set((allMembers || []).map(m => m.user_id))];
      const { data: sharedWeights } = await supabase
        .from('weight_entries')
        .select('*')
        .in('user_id', memberIds)
        .order('date', { ascending: false })
        .limit(50);

      // Get cheers
      const entryIds = (sharedWeights || []).map(w => w.id);
      if (entryIds.length) {
        const { data: cheerData } = await supabase
          .from('cheers')
          .select('entry_id, user_id')
          .in('entry_id', entryIds);
        const cheerMap = {};
        (cheerData || []).forEach(c => {
          cheerMap[c.entry_id] = cheerMap[c.entry_id] || [];
          cheerMap[c.entry_id].push(c.user_id);
        });
        setCheers(cheerMap);
      }

      // Build feed with profile info
      const profileMap = {};
      (allMembers || []).forEach(m => {
        profileMap[m.user_id] = m.profiles?.display_name || 'Unknown';
      });

      const feedItems = (sharedWeights || []).map(w => ({
        ...w,
        displayName: profileMap[w.user_id] || 'Unknown',
        isOwn: w.user_id === user.id
      }));

      setFeed(feedItems);
    } catch (err) {
      console.error('Circle load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { loadCircleData(); }, [loadCircleData]);

  const createCircle = async (e) => {
    e.preventDefault();
    if (!circleName.trim()) return;
    try {
      const inviteCode = generateId().toUpperCase().slice(0, 6);
      const { data: circle, error } = await supabase
        .from('circles')
        .insert({ name: circleName.trim(), created_by: user.id, invite_code: inviteCode })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('circle_members').insert({
        circle_id: circle.id,
        user_id: user.id,
        role: 'owner'
      });

      showToast('Circle created!');
      setCircleName('');
      setShowCreate(false);
      loadCircleData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const joinCircle = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      const { data: circle, error } = await supabase
        .from('circles')
        .select('id')
        .eq('invite_code', joinCode.trim().toUpperCase())
        .single();
      if (error || !circle) { showToast('Invalid invite code', 'error'); return; }

      const { error: joinErr } = await supabase.from('circle_members').insert({
        circle_id: circle.id,
        user_id: user.id,
        role: 'member'
      });
      if (joinErr) {
        if (joinErr.code === '23505') showToast('Already in this circle', 'warning');
        else throw joinErr;
        return;
      }

      showToast('Joined circle!');
      setJoinCode('');
      setShowJoin(false);
      loadCircleData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCheer = async (entryId) => {
    try {
      const existing = (cheers[entryId] || []).includes(user.id);
      if (existing) {
        await supabase.from('cheers').delete().eq('entry_id', entryId).eq('user_id', user.id);
      } else {
        await supabase.from('cheers').insert({ entry_id: entryId, user_id: user.id });
      }
      setCheers(prev => {
        const list = [...(prev[entryId] || [])];
        if (existing) return { ...prev, [entryId]: list.filter(id => id !== user.id) };
        return { ...prev, [entryId]: [...list, user.id] };
      });
    } catch (err) {
      showToast('Failed to cheer', 'error');
    }
  };

  const leaveCircle = async (circleId) => {
    try {
      await supabase.from('circle_members').delete().eq('circle_id', circleId).eq('user_id', user.id);
      showToast('Left circle');
      loadCircleData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <h1 className="font-heading text-2xl font-bold text-cream mb-6">My Circle</h1>
        <div className="text-cream/40 text-center py-12 animate-pulse-accent">Loading circles...</div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-heading text-2xl font-bold text-cream">My Circle</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowJoin(true); setShowCreate(false); }} className="text-accent text-xs font-medium hover:underline">Join</button>
          <button onClick={() => { setShowCreate(true); setShowJoin(false); }} className="bg-accent hover:bg-accent-dark text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
            + Create
          </button>
        </div>
      </div>

      {/* Create Circle Form */}
      {showCreate && (
        <form onSubmit={createCircle} className="bg-surface-mid rounded-xl p-4 border border-white/5 mb-4 animate-slide-up">
          <p className="text-cream text-sm font-medium mb-3">Create a Circle</p>
          <input
            type="text"
            value={circleName}
            onChange={e => setCircleName(e.target.value)}
            placeholder="Circle name (e.g. Gym Buddies)"
            className="w-full mb-3"
            autoFocus
          />
          <div className="flex gap-2">
            <button type="submit" className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold">Create</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-cream/40 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Join Circle Form */}
      {showJoin && (
        <form onSubmit={joinCircle} className="bg-surface-mid rounded-xl p-4 border border-white/5 mb-4 animate-slide-up">
          <p className="text-cream text-sm font-medium mb-3">Join a Circle</p>
          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            placeholder="Enter 6-character invite code"
            maxLength={6}
            className="w-full mb-3 uppercase tracking-widest text-center font-mono"
            autoFocus
          />
          <div className="flex gap-2">
            <button type="submit" className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold">Join</button>
            <button type="button" onClick={() => setShowJoin(false)} className="text-cream/40 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {circles.length === 0 && !showCreate && !showJoin ? (
        <div className="bg-surface-mid rounded-2xl p-8 border border-white/5 text-center">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-cream font-medium mb-1">No circles yet</p>
          <p className="text-cream/40 text-sm mb-4">Create a circle and invite friends to share progress and stay accountable together.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowCreate(true)} className="bg-accent hover:bg-accent-dark text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
              Create Circle
            </button>
            <button onClick={() => setShowJoin(true)} className="bg-surface-up border border-white/10 text-cream px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors hover:border-accent/30">
              Join Circle
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Tab Bar */}
          <div className="flex gap-1 bg-surface-up rounded-lg p-0.5 mb-4">
            {[['feed', 'Feed'], ['members', 'Members'], ['circles', 'Circles']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
                  tab === id ? 'bg-accent text-white' : 'text-cream/50 hover:text-cream'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Feed Tab */}
          {tab === 'feed' && (
            <div className="space-y-3">
              {feed.length === 0 ? (
                <p className="text-cream/40 text-center py-8 text-sm">No entries shared yet. Log your weight and it will appear here!</p>
              ) : (
                feed.map(entry => {
                  const cheerCount = (cheers[entry.id] || []).length;
                  const hasCheered = (cheers[entry.id] || []).includes(user.id);
                  return (
                    <div key={entry.id} className={`bg-surface-mid rounded-xl p-4 border ${entry.isOwn ? 'border-accent/20' : 'border-white/5'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
                            {entry.displayName[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-cream text-sm font-medium">
                              {entry.isOwn ? 'You' : entry.displayName}
                            </p>
                            <p className="text-cream/30 text-[10px]">{formatDateShort(entry.date)}</p>
                          </div>
                        </div>
                        <span className="font-display text-2xl text-cream">
                          {formatWeight(entry.weight, entry.unit || unit)}
                        </span>
                      </div>
                      {entry.notes && <p className="text-cream/50 text-xs mb-2">{entry.notes}</p>}
                      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                        <button
                          onClick={() => handleCheer(entry.id)}
                          className={`flex items-center gap-1 text-xs transition-colors ${
                            hasCheered ? 'text-accent' : 'text-cream/30 hover:text-accent'
                          }`}
                        >
                          <span>{hasCheered ? '🔥' : '👏'}</span>
                          <span>{cheerCount > 0 ? cheerCount : 'Cheer'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Members Tab */}
          {tab === 'members' && (
            <div className="space-y-2">
              {members.filter((m, i, arr) => arr.findIndex(x => x.user_id === m.user_id) === i).map(member => {
                const memberWeights = feed.filter(f => f.user_id === member.user_id);
                const latestWeight = memberWeights[0];
                const streak = getStreak(memberWeights);
                const change = getWeightChange(memberWeights.slice(0, 30));
                const isYou = member.user_id === user.id;

                return (
                  <div key={member.user_id} className={`bg-surface-mid rounded-xl p-4 border ${isYou ? 'border-accent/20' : 'border-white/5'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">
                          {(member.profiles?.display_name || '?')[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-cream font-medium text-sm">
                            {member.profiles?.display_name || 'Unknown'}
                            {isYou && <span className="text-accent/60 ml-1">(you)</span>}
                          </p>
                          <div className="flex gap-3 text-[10px] text-cream/40">
                            <span>🔥 {streak}d streak</span>
                            {change && (
                              <span className={change.change < 0 ? 'text-success' : 'text-danger'}>
                                {change.change > 0 ? '+' : ''}{change.change.toFixed(1)} (30d)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {latestWeight && (
                        <div className="text-right">
                          <p className="font-display text-xl text-cream">{formatWeight(latestWeight.weight, latestWeight.unit || unit)}</p>
                          <p className="text-cream/30 text-[10px]">{formatDateShort(latestWeight.date)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Circles Tab */}
          {tab === 'circles' && (
            <div className="space-y-3">
              {circles.map(circle => {
                const circleMembers = members.filter(m => m.circle_id === circle.id);
                return (
                  <div key={circle.id} className="bg-surface-mid rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-cream font-medium">{circle.name}</h3>
                      <span className="text-cream/30 text-xs">{circle.role}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-cream/40 text-xs">{circleMembers.length} members</span>
                        <span className="text-cream/20">·</span>
                        <span className="text-cream/40 text-xs font-mono tracking-wider">Code: {circle.invite_code}</span>
                      </div>
                      <button onClick={() => leaveCircle(circle.id)} className="text-cream/20 hover:text-danger text-xs">
                        Leave
                      </button>
                    </div>
                    {/* Copy invite code */}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(circle.invite_code);
                        showToast('Invite code copied!');
                      }}
                      className="mt-2 text-accent text-xs hover:underline"
                    >
                      Copy invite code to share
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
