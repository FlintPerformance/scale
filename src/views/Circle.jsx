import React, { useState, useEffect, useCallback } from 'react';
import { useAppData, useAppActions } from '../App';
import { supabase } from '../supabase';
import { formatWeight, formatDateShort, getWeightChange, getStreak, generateId } from '../utils';
import Avatar from '../components/Avatar';

const REACTIONS = [
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💪', label: 'Strong' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '🎯', label: 'Target' },
  { emoji: '❤️', label: 'Love' }
];

export default function Circle() {
  const { user, unit, weights, displayName, pendingInvite } = useAppData();
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
      const { data: sharedWeights } = await supabase
        .from('weight_entries')
        .select('*')
        .in('user_id', memberIds)
        .order('date', { ascending: false })
        .limit(50);

      // Load reactions (cheers with emoji type)
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

      const feedItems = (sharedWeights || []).map(w => ({
        ...w,
        displayName: profileMap[w.user_id] || 'Unknown',
        avatarUrl: avatarMap[w.user_id] || null,
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
      loadCircleData();
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
      loadCircleData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

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
              {feed.length === 0 ? (
                <p className="text-cream/40 text-center py-8 text-sm desktop:col-span-2">No entries shared yet. Log your weight and it will appear here!</p>
              ) : (
                feed.map(entry => {
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

          {/* Members Tab */}
          {tab === 'members' && (
            <div className="space-y-2 desktop:grid desktop:grid-cols-2 desktop:gap-3 desktop:space-y-0">
              {members.filter((m, i, arr) => arr.findIndex(x => x.user_id === m.user_id) === i).map(member => {
                const memberWeights = feed.filter(f => f.user_id === member.user_id);
                const latestWeight = memberWeights[0];
                const streak = getStreak(memberWeights);
                const change = getWeightChange(memberWeights.slice(0, 30));
                const isYou = member.user_id === user.id;

                return (
                  <div key={member.user_id} className={`bg-surface-mid rounded-sm p-4 border ${isYou ? 'border-accent/20' : 'border-white/5'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar
                          url={member.profiles?.avatar_url}
                          name={member.profiles?.display_name || '?'}
                          size="md"
                        />
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
