'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { apiFetch, ensureAuth } from '@/lib/api';
import {
  Clock, User, Eye, Key, Wallet, Globe, Link2, Shield,
  AlertTriangle, Search, Filter, Calendar, ArrowDown, BarChart3,
} from 'lucide-react';
import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { TimelineEvent, Actor } from '@/types';

const EVENT_CONFIG: Record<string, { color: string; bg: string; border: string; icon: typeof Clock; label: string }> = {
  alias_created: { color: '#00ff88', bg: 'bg-cyber-green/10', border: 'border-cyber-green/30', icon: User, label: 'Alias Created' },
  alias_observed: { color: '#00d4ff', bg: 'bg-cyber-blue/10', border: 'border-cyber-blue/30', icon: Eye, label: 'Alias Observed' },
  pgp_key: { color: '#ff8800', bg: 'bg-cyber-orange/10', border: 'border-cyber-orange/30', icon: Key, label: 'PGP Key' },
  wallet_activity: { color: '#ffcc00', bg: 'bg-cyber-yellow/10', border: 'border-cyber-yellow/30', icon: Wallet, label: 'Wallet Activity' },
  infrastructure: { color: '#8855ff', bg: 'bg-cyber-purple/10', border: 'border-cyber-purple/30', icon: Globe, label: 'Infrastructure' },
  correlation: { color: '#00e5ff', bg: 'bg-cyber-cyan/10', border: 'border-cyber-cyan/30', icon: Link2, label: 'Correlation' },
  evidence: { color: '#ff3366', bg: 'bg-cyber-red/10', border: 'border-cyber-red/30', icon: Shield, label: 'Evidence' },
  risk_change: { color: '#ff3366', bg: 'bg-cyber-red/10', border: 'border-cyber-red/30', icon: AlertTriangle, label: 'Risk Change' },
};

const CONFIDENCE_COLOR = (c: number) =>
  c >= 0.8 ? '#00ff88' : c >= 0.6 ? '#00d4ff' : c >= 0.4 ? '#ffcc00' : '#ff3366';

const CHART_COLORS = ['#00ff88', '#00d4ff', '#ff8800', '#ffcc00', '#8855ff', '#00e5ff', '#ff3366'];

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [loading, setLoading] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);

  const [filterType, setFilterType] = useState('');
  const [filterActor, setFilterActor] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTimeline = useCallback(async () => {
    try {
      const [ev, ac] = await Promise.all([
        apiFetch<TimelineEvent[]>('/api/v1/intelligence/timeline?limit=200'),
        apiFetch<Actor[]>('/api/v1/actors/?limit=50'),
      ]);
      setEvents(ev);
      setActors(ac);
    } catch (e) {
      console.error('Failed to load timeline:', e);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await ensureAuth();
      await fetchTimeline();
      setLoading(false);
      setTimeout(() => setFadeIn(true), 50);
    };
    load();
  }, [fetchTimeline]);

  useEffect(() => {
    pollTimerRef.current = setInterval(fetchTimeline, 30000);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [fetchTimeline]);

  const actorMap = useMemo(() => {
    const m = new Map<number, Actor>();
    actors.forEach(a => m.set(a.id, a));
    return m;
  }, [actors]);

  const uniqueEventTypes = useMemo(() => [...new Set(events.map(e => e.event_type))].sort(), [events]);

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (filterType && e.event_type !== filterType) return false;
      if (filterActor && String(e.actor_id) !== filterActor) return false;
      if (filterDateFrom && e.event_date < filterDateFrom) return false;
      if (filterDateTo && e.event_date > filterDateTo + 'T23:59:59') return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = e.title.toLowerCase().includes(q);
        const matchDesc = e.description?.toLowerCase().includes(q) ?? false;
        const matchSource = e.source?.toLowerCase().includes(q) ?? false;
        if (!matchTitle && !matchDesc && !matchSource) return false;
      }
      return true;
    });
  }, [events, filterType, filterActor, filterDateFrom, filterDateTo, searchQuery]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()),
    [filtered],
  );

  const typeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(e => { counts[e.event_type] = (counts[e.event_type] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const chartData = useMemo(() => {
    return typeBreakdown.map((d, i) => ({
      ...d,
      label: EVENT_CONFIG[d.name]?.label || d.name,
      fill: EVENT_CONFIG[d.name]?.color || CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [typeBreakdown]);

  const avgConfidence = useMemo(() => {
    if (filtered.length === 0) return 0;
    return filtered.reduce((s, e) => s + e.confidence, 0) / filtered.length;
  }, [filtered]);

  const highConfCount = useMemo(() => filtered.filter(e => e.confidence >= 0.7).length, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 border-2 border-cyber-blue/20 border-t-cyber-blue rounded-full animate-spin" />
            <div
              className="absolute inset-0 w-14 h-14 border-2 border-cyber-green/10 border-b-cyber-green rounded-full animate-spin"
              style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Clock className="w-5 h-5 text-cyber-blue/60" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-400 font-medium">Loading Investigation Timeline</p>
            <p className="text-xs text-gray-600 mt-1">Fetching intelligence events...</p>
            <div className="flex items-center gap-1.5 mt-3 justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-cyber-blue animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" style={{ animationDelay: '0.2s' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-cyber-blue animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-100 tracking-tight">Investigation Timeline</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/20 uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-blue animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Chronological view of intelligence events and threat actor activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge-info">{filtered.length} of {events.length} events</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card group hover:border-dark-500/50 transition-all duration-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-cyber-blue/10 border border-cyber-blue/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-cyber-blue" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-cyber-blue">{filtered.length.toLocaleString()}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Total Events</div>
        </div>
        <div className="glass-card group hover:border-dark-500/50 transition-all duration-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-cyber-green/10 border border-cyber-green/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-cyber-green" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-cyber-green">{highConfCount}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">High Confidence</div>
        </div>
        <div className="glass-card group hover:border-dark-500/50 transition-all duration-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-cyber-purple/10 border border-cyber-purple/20 flex items-center justify-center">
              <Link2 className="w-4 h-4 text-cyber-purple" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-cyber-purple">{uniqueEventTypes.length}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Event Types</div>
        </div>
        <div className="glass-card group hover:border-dark-500/50 transition-all duration-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-cyber-orange/10 border border-cyber-orange/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-cyber-orange" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-cyber-orange">{Math.round(avgConfidence * 100)}%</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Avg Confidence</div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyber-blue" />
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Filters</h3>
            {(filterType || filterActor || filterDateFrom || filterDateTo || searchQuery) && (
              <button
                onClick={() => { setFilterType(''); setFilterActor(''); setFilterDateFrom(''); setFilterDateTo(''); setSearchQuery(''); }}
                className="text-[10px] text-cyber-red hover:text-cyber-red/80 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="text-[11px] text-cyber-blue hover:text-cyber-cyan transition-colors flex items-center gap-1"
          >
            {showFilters ? 'Hide' : 'Advanced'}
            <ArrowDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Primary row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field pl-9 w-full"
            />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-field w-48">
            <option value="">All Event Types</option>
            {uniqueEventTypes.map(t => (
              <option key={t} value={t}>{EVENT_CONFIG[t]?.label || t}</option>
            ))}
          </select>
          <select value={filterActor} onChange={e => setFilterActor(e.target.value)} className="input-field w-44">
            <option value="">All Actors</option>
            {actors.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-dark-600/30 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-[11px] text-gray-500">Date Range:</span>
            </div>
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="input-field w-40"
            />
            <span className="text-gray-600 text-xs">to</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="input-field w-40"
            />
          </div>
        )}
      </div>

      {/* Event Type Breakdown Chart */}
      {chartData.length > 0 && (
        <div className="glass-card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-cyber-green" />
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Event Type Breakdown
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <RechartsBarChart data={chartData}>
              <XAxis
                dataKey="label"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ background: '#141620', border: '1px solid #2e3352', borderRadius: 8, fontSize: 12 }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={28}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Timeline */}
      <div className={`transition-all duration-500 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {sorted.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-4 py-16">
            <div className="w-16 h-16 rounded-full bg-dark-700/50 border border-dark-600/30 flex items-center justify-center">
              <Clock className="w-8 h-8 text-gray-600" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-300">No Events Found</h3>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-cyber-blue/30 via-cyber-purple/20 to-transparent" />

            <div className="space-y-1">
              {sorted.map((event, i) => {
                const cfg = EVENT_CONFIG[event.event_type] || {
                  color: '#6b7280',
                  bg: 'bg-gray-500/10',
                  border: 'border-gray-500/30',
                  icon: Clock,
                  label: event.event_type,
                };
                const Icon = cfg.icon;
                const actor = event.actor_id ? actorMap.get(event.actor_id) : null;
                const confPct = Math.round(event.confidence * 100);
                const confColor = CONFIDENCE_COLOR(event.confidence);
                const dateStr = event.event_date.split('T')[0];

                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 relative group"
                    style={{
                      opacity: fadeIn ? 1 : 0,
                      transform: fadeIn ? 'translateY(0)' : 'translateY(12px)',
                      transition: `all 0.4s ease ${Math.min(i * 30, 600)}ms`,
                    }}
                  >
                    {/* Dot */}
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 transition-all duration-300 group-hover:scale-110"
                      style={{
                        background: `${cfg.color}15`,
                        borderColor: `${cfg.color}60`,
                      }}
                    >
                      <Icon className="w-4.5 h-4.5" style={{ color: cfg.color }} />
                    </div>

                    {/* Content card */}
                    <div className="glass-card flex-1 group-hover:border-dark-500/50 transition-all duration-200">
                      {/* Top row: date + type badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-gray-500">{dateStr}</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
                          style={{
                            background: `${cfg.color}10`,
                            borderColor: `${cfg.color}30`,
                            color: cfg.color,
                          }}
                        >
                          {cfg.label}
                        </span>
                        {actor && (
                          <a
                            href={`/actors/${actor.id}`}
                            className="text-xs text-cyber-blue hover:text-cyber-cyan font-mono transition-colors"
                          >
                            {actor.name}
                          </a>
                        )}
                      </div>

                      {/* Title */}
                      <p className="text-sm text-gray-200 font-medium mb-1">{event.title}</p>

                      {/* Description */}
                      {event.description && (
                        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{event.description}</p>
                      )}

                      {/* Bottom row: confidence bar + source */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500">Confidence:</span>
                          <div className="w-24 h-1.5 rounded-full bg-dark-700 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${confPct}%`, background: confColor }}
                            />
                          </div>
                          <span className="text-[10px] font-mono" style={{ color: confColor }}>
                            {confPct}%
                          </span>
                        </div>
                        {event.source && (
                          <span className="text-[11px] text-gray-500">
                            Source: <span className="text-gray-400">{event.source}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="glass-card border-dashed border-dark-600/40">
        <div className="flex items-start gap-3">
          <Shield className="w-4 h-4 text-gray-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-gray-600 leading-relaxed">
            DarkTrace Nexus is a defensive cyber-threat intelligence research platform. Timeline events represent analytical observations, not definitive attributions.
          </p>
        </div>
      </div>
    </div>
  );
}


