import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppData, useAppActions } from '../App';
import { supabase } from '../supabase';
import { formatWeight, formatDateShort, getWeightChange, getStreak, generateId, todayStr } from '../utils';
import Avatar from '../components/Avatar';

const REACTIONS = [
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💪', label: 'Strong' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '🎯', label: 'Target' },
  { emoji: '❤️', label: 'Love' }
];

export default function Circle() {
  const { user, unit, weights: localWeights, displayName, pendingInvite } = useAppData();
  const { showToast, clearPendingInvite } = useAppActions();
  const [tab, setTab] = useState('feed');
  const [circles, setCircles] = useState([]);
  const [members, setMembers] = useState([]);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [circleName, setCircleName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [reactions, setReactions] = useState({});
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [selectedCircle, setSelectedCircle] = useState(null); // null = All Circles

  const loadCircleData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: memberRows } = await supabase
        .from('circle_members')
        .select('circle_id, role, circles(id, name, invite_code, created_by)')
        .eq('user_id', user.id);

      const userCircles = (memberRows || []).map(m => ({ ...m.circles, role: m.role }));
      setCircles(userCircles);

      if (userCircles.length === 0) { setLoading(false); return; }

      const circleIds = userCircles.map(c => c.id);

      const { data: allMembers } = await supabase
        .from('circle_members')
        .select('user_id, circle_id, role, profiles(display_name, avatar_url)')
        .in('circle_id', circleIds);

      setMembers(allMembers || []);

      const memberIds = [...new Set((allMembers || []).map(m => m.user_id))];

      // Fetch more entries for richer member stats
      const { data: sharedWeights } = await supabase
        .from('weight_entries')
        .select('*')
        .in('user_id', memberIds)
        .order('date', { ascending: false })
        .limit(200);

      // Load reactions
      const entryIds = (sharedWeights || []).map(w => w.id);
      if (entryIds.length) {
        const { data: cheerData } = await supabase
          .from('cheers')
          .select('entry_id, user_id, emoji')
          .in('entry_id', entryIds);
        const reactionMap = {};
        (cheerData || []).forEach(c => {
          if (!reactionMap[c.entry_id]) reactionMap[c.entry_id] = [];
          reactionMap[c.entry_id].push({ user_id: c.user_id, emoji: c.emoji || '🔥' });
        });
        setReactions(reactionMap);
      }

      // Build feed with profile info
      const profileMap = {};
      const avatarMap = {};
      (allMembers || []).forEach(m => {
        profileMap[m.user_id] = m.profiles?.display_name || 'Unknown';
        avatarMap[m.user_id] = m.profiles?.avatar_url || null;
      });

      // Merge local weights for current user that may not be in cloud yet
      const cloudIds = new Set((sharedWeights || []).map(w => w.id));
      const localOnly = localWeights
        .filter(w => !cloudIds.has(w.id))
        .map(w => ({
          id: w.id,
          user_id: user.id,
          date: w.date,
          weight: w.weight,
          unit: w.unit,
          notes: w.notes,
          is_morning: w.isMorning || false,
          updated_at: new Date(w.updatedAt).toISOString()
        }));

      const allWeights = [...(sharedWeights || []), ...localOnly]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 200);

      const feedItems = allWeights.map(w => ({
        ...w,
        displayName: profileMap[w.user_id] || displayName,
        avatarUrl: avatarMap[w.user_id] || null,
        isOwn: w.user_id === user.id
      }));

      setFeed(feedItems);
    } catch (err) {
      console.error('Circle load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user.id, localWeights, displayName]);

  useEffect(() => { loadCircleData(); }, [loadCircleData]);

  // Auto-join from invite URL
  useEffect(() => {
    if (!pendingInvite || loading) return;
    const autoJoin = async () => {
      try {
        const { data: circle, error } = await supabase
          .from('circles')
          .select('id')
          .eq('invite_code', pendingInvite.trim().toUpperCase())
          .single();
        if (error || !circle) { showToast('Invalid invite code', 'error'); return; }

        const { error: joinErr } = await supabase.from('circle_members').insert({
          circle_id: circle.id,
          user_id: user.id,
          role: 'member'
        });
        if (joinErr) {
          if (joinErr.code === '23505') showToast('Already in this circle');
          else throw joinErr;
        } else {
          showToast('Joined circle!');
        }
        await loadCircleData();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        clearPendingInvite();
      }
    };
    autoJoin();
  }, [pendingInvite, loading, user.id, showToast, clearPendingInvite, loadCircleData]);

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

      const { error: memberErr } = await supabase.from('circle_members').insert({
        circle_id: circle.id,
        user_id: user.id,
        role: 'owner'
      });
      if (memberErr) throw memberErr;

      showToast('Circle created!');
      setCircleName('');
      setShowCreate(false);
      setTab('circles');
      // Await full reload so creator appears in member list
      await loadCircleData();
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
      await loadCircleData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleReaction = async (entryId, emoji) => {
    try {
      const entryReactions = reactions[entryId] || [];
      const existing = entryReactions.find(r => r.user_id === user.id && r.emoji === emoji);

      if (existing) {
        await supabase.from('cheers').delete()
          .eq('entry_id', entryId)
          .eq('user_id', user.id)
          .eq('emoji', emoji);
      } else {
        await supabase.from('cheers').insert({ entry_id: entryId, user_id: user.id, emoji });
      }

      setReactions(prev => {
        const list = [...(prev[entryId] || [])];
        if (existing) {
          return { ...prev, [entryId]: list.filter(r => !(r.user_id === user.id && r.emoji === emoji)) };
        }
        return { ...prev, [entryId]: [...list, { user_id: user.id, emoji }] };
      });
      setShowReactionPicker(null);
    } catch (err) {
      showToast('Failed to react', 'error');
    }
  };

  const leaveCircle = async (circleId) => {
    try {
      await supabase.from('circle_members').delete().eq('circle_id', circleId).eq('user_id', user.id);
      showToast('Left circle');
      await loadCircleData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Filter members and feed by selected circle
  const filteredMembers = useMemo(() => {
    if (!selectedCircle) return members;
    return members.filter(m => m.circle_id === selectedCircle);
  }, [members, selectedCircle]);

  const filteredFeed = useMemo(() => {
    if (!selectedCircle) return feed;
    const circleMemberIds = new Set(filteredMembers.map(m => m.user_id));
    return feed.filter(f => circleMemberIds.has(f.user_id));
  }, [feed, selectedCircle, filteredMembers]);

  // Compute per-member stats for the Members tab
  const memberStats = useMemo(() => {
    let unique = filteredMembers.filter((m, i, arr) => arr.findIndex(x => x.user_id === m.user_id) === i);
    // Ensure current user always appears in member list
    const activeCircles = selectedCircle ? circles.filter(c => c.id === selectedCircle) : circles;
    if (activeCircles.length > 0 && !unique.some(m => m.user_id === user.id)) {
      unique = [...unique, {
        user_id: user.id,
        circle_id: activeCircles[0].id,
        role: activeCircles[0].role || 'member',
        profiles: { display_name: displayName, avatar_url: null }
      }];
    }
    const today = todayStr();
    const d7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    return unique.map(member => {
      const allWeights = filteredFeed.filter(f => f.user_id === member.user_id);
      const latest = allWeights[0];
      const streak = getStreak(allWeights);
      const totalEntries = allWeights.length;
      const last7 = allWeights.filter(w => w.date >= d7);
      const last30 = allWeights.filter(w => w.date >= d30);
      const change7 = getWeightChange(last7);
      const change30 = getWeightChange(last30);
      const loggedToday = allWeights.some(w => w.date === today);

      // Mini trend: last 7 daily weights for sparkline
      const recentDays = allWeights.slice(0, 7).reverse();

      return {
        ...member,
        latest,
        streak,
        totalEntries,
        change7,
        change30,
        loggedToday,
        recentDays,
        isYou: member.user_id === user.id,
      };
    }).sort((a, b) => b.streak - a.streak); // Sort by streak
  }, [filteredMembers, filteredFeed, user.id, circles, selectedCircle, displayName]);

  if (loading) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-heading text-2xl font-bold text-cream mb-6">My Circle</h1>
        <div className="text-cream/40 text-center py-12 animate-pulse-accent">Loading circles...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-heading text-2xl font-bold text-cream">My Circle</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowJoin(true); setShowCreate(false); }} className="text-accent text-xs font-medium hover:underline">Join</button>
          <button onClick={() => { setShowCreate(true); setShowJoin(false); }} className="bg-accent hover:bg-accent-dark text-white px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors">
            + Create
          </button>
        </div>
      </div>

      {/* Create Circle Form */}
      {showCreate && (
        <form onSubmit={createCircle} className="bg-surface-mid rounded-sm p-4 border border-white/5 mb-4 animate-slide-up">
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
            <button type="submit" className="bg-accent text-white px-4 py-2 rounded-sm text-sm font-semibold">Create</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-cream/40 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Join Circle Form */}
      {showJoin && (
        <form onSubmit={joinCircle} className="bg-surface-mid rounded-sm p-4 border border-white/5 mb-4 animate-slide-up">
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
            <button type="submit" className="bg-accent text-white px-4 py-2 rounded-sm text-sm font-semibold">Join</button>
            <button type="button" onClick={() => setShowJoin(false)} className="text-cream/40 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {circles.length === 0 && !showCreate && !showJoin ? (
        <div className="bg-surface-mid rounded-sm p-8 border border-white/5 text-center">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-cream font-medium mb-1">No circles yet</p>
          <p className="text-cream/40 text-sm mb-4">Create a circle and invite friends to share progress and stay accountable together.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowCreate(true)} className="bg-accent hover:bg-accent-dark text-white px-5 py-2.5 rounded-sm font-semibold text-sm transition-colors">
              Create Circle
            </button>
            <button onClick={() => setShowJoin(true)} className="bg-surface-up border border-white/10 text-cream px-5 py-2.5 rounded-sm font-semibold text-sm transition-colors hover:border-accent/30">
              Join Circle
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Circle Picker */}
          {circles.length > 1 && (
            <div className="mb-3">
              <select
                value={selectedCircle || ''}
                onChange={e => setSelectedCircle(e.target.value || null)}
                className="w-full bg-surface-up border border-white/10 text-cream text-sm rounded-sm px-3 py-2 appearance-none cursor-pointer hover:border-accent/30 transition-colors"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
              >
                <option value="">All Circles</option>
                {circles.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tab Bar */}
          <div className="flex gap-1 bg-surface-up rounded-sm p-0.5 mb-4">
            {[['feed', 'Feed'], ['members', 'Members'], ['circles', 'Circles']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-2 rounded-sm text-xs font-medium transition-colors ${
                  tab === id ? 'bg-accent text-white' : 'text-cream/50 hover:text-cream'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Feed Tab */}
          {tab === 'feed' && (
            <div className="space-y-3 desktop:grid desktop:grid-cols-2 desktop:gap-3 desktop:space-y-0">
              {filteredFeed.length === 0 ? (
                <p className="text-cream/40 text-center py-8 text-sm desktop:col-span-2">No entries shared yet. Log your weight and it will appear here!</p>
              ) : (
                filteredFeed.map(entry => {
                  const entryReactions = reactions[entry.id] || [];
                  const groupedReactions = {};
                  entryReactions.forEach(r => {
                    if (!groupedReactions[r.emoji]) groupedReactions[r.emoji] = [];
                    groupedReactions[r.emoji].push(r.user_id);
                  });

                  return (
                    <div key={entry.id} className={`bg-surface-mid rounded-sm p-4 border ${entry.isOwn ? 'border-accent/20' : 'border-white/5'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Avatar url={entry.avatarUrl} name={entry.displayName} size="sm" />
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

                      {/* Reactions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-white/5 flex-wrap">
                        {Object.entries(groupedReactions).map(([emoji, userIds]) => {
                          const hasReacted = userIds.includes(user.id);
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(entry.id, emoji)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                                hasReacted
                                  ? 'bg-accent/15 border border-accent/30'
                                  : 'bg-white/5 border border-white/5 hover:border-accent/20'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className={hasReacted ? 'text-accent' : 'text-cream/40'}>{userIds.length}</span>
                            </button>
                          );
                        })}

                        {/* Add reaction button */}
                        <div className="relative">
                          <button
                            onClick={() => setShowReactionPicker(showReactionPicker === entry.id ? null : entry.id)}
                            className="w-7 h-7 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-cream/30 hover:text-cream/60 hover:border-accent/20 transition-colors text-sm"
                          >
                            +
                          </button>
                          {showReactionPicker === entry.id && (
                            <div className="absolute bottom-full left-0 mb-1 bg-surface-up border border-white/10 rounded-sm p-1.5 flex gap-1 shadow-lg z-10 animate-slide-up">
                              {REACTIONS.map(r => (
                                <button
                                  key={r.emoji}
                                  onClick={() => handleReaction(entry.id, r.emoji)}
                                  className="w-8 h-8 rounded-sm hover:bg-white/10 flex items-center justify-center text-lg transition-colors"
                                  title={r.label}
                                >
                                  {r.emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Members Tab - Rich Progress Cards */}
          {tab === 'members' && (
            <div className="space-y-3">
              {memberStats.length === 0 ? (
                <p className="text-cream/40 text-center py-8 text-sm">No members yet.</p>
              ) : (
                memberStats.map(member => (
                  <div key={member.user_id} className={`bg-surface-mid rounded-sm border ${member.isYou ? 'border-accent/20' : 'border-white/5'}`}>
                    {/* Member header */}
                    <div className="flex items-center justify-between p-4 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar
                            url={member.profiles?.avatar_url}
                            name={member.profiles?.display_name || '?'}
                            size="md"
                          />
                          {member.loggedToday && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-surface-mid" />
                          )}
                        </div>
                        <div>
                          <p className="text-cream font-medium text-sm">
                            {member.profiles?.display_name || 'Unknown'}
                            {member.isYou && <span className="text-accent/60 ml-1">(you)</span>}
                          </p>
                          <p className="text-cream/30 text-[10px]">
                            {member.loggedToday ? 'Logged today' : member.latest ? `Last log ${formatDateShort(member.latest.date)}` : 'No entries yet'}
                          </p>
                        </div>
                      </div>
                      {member.latest && (
                        <div className="text-right">
                          <p className="font-display text-2xl text-cream">{formatWeight(member.latest.weight, member.latest.unit || unit)}</p>
                        </div>
                      )}
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-4 gap-px bg-white/5 border-t border-white/5">
                      <div className="bg-surface-mid p-2.5 text-center">
                        <p className="text-cream/40 text-[9px] uppercase tracking-wider">Streak</p>
                        <p className="font-display text-lg text-accent">{member.streak}</p>
                        <p className="text-cream/30 text-[9px]">days</p>
                      </div>
                      <div className="bg-surface-mid p-2.5 text-center">
                        <p className="text-cream/40 text-[9px] uppercase tracking-wider">Entries</p>
                        <p className="font-display text-lg text-cream">{member.totalEntries}</p>
                        <p className="text-cream/30 text-[9px]">total</p>
                      </div>
                      <div className="bg-surface-mid p-2.5 text-center">
                        <p className="text-cream/40 text-[9px] uppercase tracking-wider">7 Day</p>
                        {member.change7 ? (
                          <>
                            <p className={`font-display text-lg ${member.change7.change < 0 ? 'text-success' : member.change7.change > 0 ? 'text-danger' : 'text-cream/50'}`}>
                              {member.change7.change > 0 ? '+' : ''}{member.change7.change.toFixed(1)}
                            </p>
                            <p className="text-cream/30 text-[9px]">{unit}</p>
                          </>
                        ) : (
                          <p className="text-cream/20 text-xs mt-1">--</p>
                        )}
                      </div>
                      <div className="bg-surface-mid p-2.5 text-center">
                        <p className="text-cream/40 text-[9px] uppercase tracking-wider">30 Day</p>
                        {member.change30 ? (
                          <>
                            <p className={`font-display text-lg ${member.change30.change < 0 ? 'text-success' : member.change30.change > 0 ? 'text-danger' : 'text-cream/50'}`}>
                              {member.change30.change > 0 ? '+' : ''}{member.change30.change.toFixed(1)}
                            </p>
                            <p className="text-cream/30 text-[9px]">{unit}</p>
                          </>
                        ) : (
                          <p className="text-cream/20 text-xs mt-1">--</p>
                        )}
                      </div>
                    </div>

                    {/* Mini sparkline trend */}
                    {member.recentDays.length > 1 && (
                      <div className="px-4 py-2.5 border-t border-white/5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-cream/30 text-[9px] uppercase tracking-wider">Recent trend</span>
                          <span className="text-cream/30 text-[9px]">Last {member.recentDays.length} entries</span>
                        </div>
                        <MiniSparkline data={member.recentDays} />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Circles Tab */}
          {tab === 'circles' && (
            <div className="space-y-3">
              {circles.map(circle => {
                const circleMembers = members.filter(m => m.circle_id === circle.id);
                return (
                  <div key={circle.id} className="bg-surface-mid rounded-sm p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-cream font-medium">{circle.name}</h3>
                      <span className="text-cream/30 text-xs">{circle.role}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {circleMembers.slice(0, 5).map(m => (
                            <Avatar
                              key={m.user_id}
                              url={m.profiles?.avatar_url}
                              name={m.profiles?.display_name || '?'}
                              size="xs"
                            />
                          ))}
                        </div>
                        <span className="text-cream/40 text-xs">{circleMembers.length} members</span>
                        <span className="text-cream/20">·</span>
                        <span className="text-cream/40 text-xs font-mono tracking-wider">Code: {circle.invite_code}</span>
                      </div>
                      <button onClick={() => leaveCircle(circle.id)} className="text-cream/20 hover:text-danger text-xs">
                        Leave
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}?join=${circle.invite_code}`;
                        navigator.clipboard.writeText(url);
                        showToast('Invite link copied!');
                      }}
                      className="mt-2 text-accent text-xs hover:underline"
                    >
                      Copy invite link
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

function MiniSparkline({ data }) {
  if (!data || data.length < 2) return null;
  const weights = data.map(d => d.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const h = 32;
  const w = 100;
  const step = w / (weights.length - 1);

  const points = weights.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const first = weights[0];
  const last = weights[weights.length - 1];
  const trending = last < first ? 'text-success' : last > first ? 'text-danger' : 'text-cream/40';

  return (
    <div className="flex items-center gap-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="flex-1 h-8" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={trending}
        />
        {weights.map((v, i) => {
          const x = i * step;
          const y = h - ((v - min) / range) * (h - 4) - 2;
          return <circle key={i} cx={x} cy={y} r="2.5" fill="currentColor" className={trending} />;
        })}
      </svg>
      <div className={`text-xs font-medium ${trending} whitespace-nowrap`}>
        {last > first ? '+' : ''}{(last - first).toFixed(1)}
      </div>
    </div>
  );
}
