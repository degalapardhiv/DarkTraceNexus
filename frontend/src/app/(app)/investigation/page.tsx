'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { apiFetch, ensureAuth } from '@/lib/api';
import {
  Search, User, GitBranch, Target, Shield, Clock, FileText,
  ChevronRight, Eye, Activity, Link2, AlertTriangle, Crosshair,
  ArrowRight, Play, CheckCircle
} from 'lucide-react';
import type { Actor, ActorDetail, TimelineEvent, Attribution } from '@/types';

const WORKFLOW_STEPS = [
  {
    key: 'profile',
    label: 'Profile',
    description: 'View full actor profile, aliases, and intelligence data',
    icon: User,
    href: (id: number) => `/actors/${id}`,
    color: 'text-cyber-blue',
    bg: 'bg-cyber-blue/10',
    border: 'border-cyber-blue/20',
  },
  {
    key: 'graph',
    label: 'Graph',
    description: 'Visualize actor relationships and network connections',
    icon: GitBranch,
    href: (id: number) => `/graph?actor=${id}`,
    color: 'text-cyber-purple',
    bg: 'bg-cyber-purple/10',
    border: 'border-cyber-purple/20',
  },
  {
    key: 'attribution',
    label: 'Attribution',
    description: 'Analyze cross-actor correlation and attribution scores',
    icon: Target,
    href: () => '/attributions',
    color: 'text-cyber-orange',
    bg: 'bg-cyber-orange/10',
    border: 'border-cyber-orange/20',
  },
  {
    key: 'evidence',
    label: 'Evidence',
    description: 'Review collected evidence items and forensic data',
    icon: Shield,
    href: (id: number) => `/evidence?actor=${id}`,
    color: 'text-cyber-green',
    bg: 'bg-cyber-green/10',
    border: 'border-cyber-green/20',
  },
  {
    key: 'timeline',
    label: 'Timeline',
    description: 'Chronological view of actor activity and events',
    icon: Clock,
    href: (id: number) => `/timeline?actor=${id}`,
    color: 'text-cyber-cyan',
    bg: 'bg-cyber-cyan/10',
    border: 'border-cyber-cyan/20',
  },
  {
    key: 'report',
    label: 'Report',
    description: 'Generate investigation report and summary',
    icon: FileText,
    href: (id: number) => `/reports?actor=${id}`,
    color: 'text-cyber-yellow',
    bg: 'bg-cyber-yellow/10',
    border: 'border-cyber-yellow/20',
  },
];

const RISK_BADGE: Record<string, string> = {
  CRITICAL: 'bg-cyber-red/15 text-cyber-red border-cyber-red/25',
  HIGH: 'bg-cyber-orange/15 text-cyber-orange border-cyber-orange/25',
  MEDIUM: 'bg-cyber-yellow/15 text-cyber-yellow border-cyber-yellow/25',
  LOW: 'bg-cyber-green/15 text-cyber-green border-cyber-green/25',
};

const CONFIDENCE_COLOR = (c: number) =>
  c >= 0.8 ? '#00ff88' : c >= 0.6 ? '#00d4ff' : c >= 0.4 ? '#ffcc00' : '#ff3366';

const EVENT_ICON_COLOR: Record<string, string> = {
  alias_change: 'text-cyber-blue',
  wallet_transfer: 'text-cyber-yellow',
  new_post: 'text-cyber-purple',
  infrastructure: 'text-cyber-orange',
  pgp_activity: 'text-cyber-green',
  attribution_update: 'text-cyber-cyan',
  evidence_added: 'text-cyber-green',
};

export default function InvestigationPage() {
  const [actors, setActors] = useState<Actor[]>([]);
  const [selectedActorId, setSelectedActorId] = useState<number | null>(null);
  const [actorDetail, setActorDetail] = useState<ActorDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [allAttributions, setAllAttributions] = useState<Attribution[]>([]);
  const [loadingActors, setLoadingActors] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActors = useCallback(async () => {
    try {
      const data = await apiFetch<Actor[]>('/api/v1/actors/?limit=100');
      setActors(data);
      return data;
    } catch { return []; }
  }, []);

  useEffect(() => {
    ensureAuth().then(() => {
      fetchActors().then((data) => {
        if (data.length > 0 && !selectedActorId) {
          setSelectedActorId(data[0].id);
        }
      }).finally(() => setLoadingActors(false));
    });
  }, [fetchActors]);

  useEffect(() => {
    pollTimerRef.current = setInterval(fetchActors, 30000);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [fetchActors]);

  useEffect(() => {
    if (!selectedActorId) return;
    setLoadingDetail(true);
    Promise.all([
      apiFetch<ActorDetail>(`/api/v1/actors/${selectedActorId}`),
      apiFetch<TimelineEvent[]>(`/api/v1/intelligence/timeline?actor_id=${selectedActorId}&limit=10`),
      apiFetch<Attribution[]>('/api/v1/intelligence/attributions'),
    ])
      .then(([detail, tl, attrs]) => {
        setActorDetail(detail);
        setTimeline(tl);
        setAllAttributions(attrs);
      })
      .catch(console.error)
      .finally(() => setLoadingDetail(false));
  }, [selectedActorId]);

  const filteredActors = useMemo(() => {
    if (!searchQuery) return actors;
    const q = searchQuery.toLowerCase();
    return actors.filter(
      a => a.name.toLowerCase().includes(q) || a.risk_level.toLowerCase().includes(q)
    );
  }, [actors, searchQuery]);

  const selectedActor = useMemo(
    () => actors.find(a => a.id === selectedActorId) || null,
    [actors, selectedActorId]
  );

  const actorAttributions = useMemo(
    () => allAttributions.filter(a => a.source_actor_id === selectedActorId || a.target_actor_id === selectedActorId),
    [allAttributions, selectedActorId]
  );

  const connectedActors = useMemo(() => {
    const ids = new Set<number>();
    actorAttributions.forEach(a => {
      if (a.source_actor_id === selectedActorId) ids.add(a.target_actor_id);
      else if (a.target_actor_id === selectedActorId) ids.add(a.source_actor_id);
    });
    return actors.filter(a => ids.has(a.id));
  }, [actorAttributions, actors, selectedActorId]);

  return (
    <div className="space-y-6 pb-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-100 tracking-tight">Investigation Workspace</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/20 uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-blue animate-pulse" />
              Active
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Actor-centric investigation flow — select a target to begin
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Crosshair className="w-3.5 h-3.5 text-cyber-blue" />
          <span className="font-mono">SIH26151</span>
        </div>
      </div>

      {/* ── Actor Selector ── */}
      <div className="glass-card">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-cyber-blue" />
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Select Target Actor
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Filter actors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
          <select
            value={selectedActorId ?? ''}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSelectedActorId(val || null);
            }}
            className="input-field w-72"
            disabled={loadingActors}
          >
            <option value="" disabled>
              {loadingActors ? 'Loading actors...' : 'Select an actor'}
            </option>
            {filteredActors.map(actor => (
              <option key={actor.id} value={actor.id}>
                {actor.name} — {actor.risk_level} ({Math.round(actor.confidence_score * 100)}%)
              </option>
            ))}
          </select>
        </div>
        {selectedActor && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-500">Selected:</span>
            <span className="text-sm font-medium text-gray-200">{selectedActor.name}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${RISK_BADGE[selectedActor.risk_level] || ''}`}>
              {selectedActor.risk_level}
            </span>
            <span className="text-xs font-mono text-gray-500">
              Confidence: {Math.round(selectedActor.confidence_score * 100)}%
            </span>
            {selectedActor.is_active && (
              <span className="flex items-center gap-1 text-[10px] text-cyber-green">
                <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" />
                Active
              </span>
            )}
          </div>
        )}
      </div>

      {loadingDetail ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 border-2 border-cyber-blue/20 border-t-cyber-blue rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Crosshair className="w-4 h-4 text-cyber-blue/60" />
              </div>
            </div>
            <p className="text-xs text-gray-500">Loading investigation data...</p>
          </div>
        </div>
      ) : selectedActor && actorDetail ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* ── Left Column: Workflow + Stats ── */}
          <div className="xl:col-span-2 space-y-6">
            {/* ── Investigation Workflow Panel ── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Play className="w-4 h-4 text-cyber-green" />
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Investigation Workflow
                </h3>
                <span className="text-[10px] text-gray-600 font-mono">
                  {WORKFLOW_STEPS.length} steps
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {WORKFLOW_STEPS.map((step, idx) => {
                  const Icon = step.icon;
                  const href = step.href(selectedActor.id);
                  const isComplete = idx < 2;
                  return (
                    <Link
                      key={step.key}
                      href={href}
                      className="glass-card group hover:border-dark-500/50 hover:bg-dark-800/60 transition-all duration-200 cursor-pointer block"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-10 h-10 rounded-lg ${step.bg} border ${step.border} flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${step.color}`} />
                        </div>
                        {isComplete ? (
                          <CheckCircle className="w-4 h-4 text-cyber-green" />
                        ) : (
                          <span className="text-[10px] font-mono text-gray-600">
                            Step {idx + 1}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-gray-200 mb-1 group-hover:text-white transition-colors">
                        {step.label}
                      </h4>
                      <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                        {step.description}
                      </p>
                      <div className="flex items-center gap-1 text-xs font-medium text-cyber-blue group-hover:text-cyber-cyan transition-colors">
                        <span>Open</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* ── Quick Stats ── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-cyber-cyan" />
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actor Intelligence Summary
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Aliases', value: selectedActor.alias_count, icon: User, color: 'text-cyber-blue', bg: 'bg-cyber-blue/10', border: 'border-cyber-blue/20' },
                  { label: 'PGP Keys', value: selectedActor.pgp_count, icon: Shield, color: 'text-cyber-green', bg: 'bg-cyber-green/10', border: 'border-cyber-green/20' },
                  { label: 'Wallets', value: selectedActor.wallet_count, icon: Target, color: 'text-cyber-yellow', bg: 'bg-cyber-yellow/10', border: 'border-cyber-yellow/20' },
                  { label: 'Posts', value: selectedActor.post_count, icon: FileText, color: 'text-cyber-purple', bg: 'bg-cyber-purple/10', border: 'border-cyber-purple/20' },
                ].map(card => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className="glass-card group hover:border-dark-500/50 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-lg ${card.bg} border ${card.border} flex items-center justify-center`}>
                          <Icon className={`w-4 h-4 ${card.color}`} />
                        </div>
                      </div>
                      <div className={`text-xl font-bold font-mono ${card.color}`}>
                        {card.value}
                      </div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{card.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Additional metrics row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                {[
                  { label: 'Domains', value: selectedActor.domain_count, color: 'text-cyber-orange' },
                  { label: 'Confidence', value: `${Math.round(selectedActor.confidence_score * 100)}%`, color: CONFIDENCE_COLOR(selectedActor.confidence_score) },
                  { label: 'Connections', value: connectedActors.length, color: 'text-cyber-purple' },
                  { label: 'Attributions', value: actorAttributions.length, color: 'text-cyber-cyan' },
                ].map(card => (
                  <div key={card.label} className="glass-card flex items-center gap-3">
                    <div className={`text-lg font-bold font-mono ${card.color}`}>
                      {card.value}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">{card.label}</div>
                  </div>
                ))}
              </div>

              {/* Description */}
              {selectedActor.description && (
                <div className="glass-card mt-3">
                  <p className="text-xs text-gray-400 leading-relaxed">{selectedActor.description}</p>
                  {selectedActor.tags && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {selectedActor.tags.split(',').map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] bg-dark-700/50 text-gray-400 border border-dark-600/30">
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column: Activity Feed + Connected Actors ── */}
          <div className="space-y-6">
            {/* ── Recent Activity Feed ── */}
            <div className="glass-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyber-orange" />
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Recent Activity
                  </h3>
                </div>
                <Link
                  href={`/timeline?actor=${selectedActor.id}`}
                  className="text-[11px] text-cyber-blue hover:text-cyber-cyan transition-colors flex items-center gap-1"
                >
                  View all <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {timeline.length === 0 ? (
                <div className="text-center py-6">
                  <Clock className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {timeline.map(event => {
                    const iconColor = EVENT_ICON_COLOR[event.event_type] || 'text-gray-500';
                    return (
                      <div
                        key={event.id}
                        className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-dark-700/30 transition-colors"
                      >
                        <div className="mt-0.5 shrink-0">
                          <div className={`w-2 h-2 rounded-full bg-current ${iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-300 truncate">
                              {event.title}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium bg-dark-700/50 border border-dark-600/30 ${iconColor}`}>
                              {event.event_type}
                            </span>
                          </div>
                          {event.description && (
                            <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-600 font-mono">
                              {new Date(event.event_date).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-gray-600">
                              Conf: {Math.round(event.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Connected Actors ── */}
            <div className="glass-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-cyber-green" />
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Connected Actors
                  </h3>
                  <span className="text-[10px] text-gray-600 font-mono">
                    {connectedActors.length}
                  </span>
                </div>
                <Link
                  href="/attributions"
                  className="text-[11px] text-cyber-blue hover:text-cyber-cyan transition-colors flex items-center gap-1"
                >
                  View all <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {connectedActors.length === 0 ? (
                <div className="text-center py-6">
                  <Link2 className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No connected actors found</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {connectedActors.map(actor => {
                    const attr = actorAttributions.find(
                      a => a.source_actor_id === actor.id || a.target_actor_id === actor.id
                    );
                    const conf = attr?.overall_confidence || 0;
                    const riskColor =
                      actor.risk_level === 'CRITICAL' ? 'text-cyber-red' :
                      actor.risk_level === 'HIGH' ? 'text-cyber-orange' :
                      actor.risk_level === 'MEDIUM' ? 'text-cyber-yellow' :
                      'text-cyber-green';
                    return (
                      <Link
                        key={actor.id}
                        href={`/actors/${actor.id}`}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-dark-700/30 transition-colors group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-dark-700/50 border border-dark-600/30 flex items-center justify-center shrink-0 group-hover:border-cyber-blue/20 transition-colors">
                          <User className="w-4 h-4 text-gray-500 group-hover:text-cyber-blue transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-300 truncate group-hover:text-cyber-blue transition-colors">
                              {actor.name}
                            </span>
                            <span className={`text-[9px] font-medium uppercase ${riskColor}`}>
                              {actor.risk_level}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex-1 h-1 rounded-full bg-dark-700 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${conf * 100}%`,
                                  background: CONFIDENCE_COLOR(conf),
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-gray-500 w-8 text-right">
                              {Math.round(conf * 100)}%
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Quick Actions ── */}
            <div className="glass-card">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-cyber-purple" />
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Quick Actions
                </h3>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'View Full Profile', href: `/actors/${selectedActor.id}`, icon: User, color: 'text-cyber-blue' },
                  { label: 'Explore Graph', href: `/graph?actor=${selectedActor.id}`, icon: GitBranch, color: 'text-cyber-purple' },
                  { label: 'View Timeline', href: `/timeline?actor=${selectedActor.id}`, icon: Clock, color: 'text-cyber-cyan' },
                  { label: 'View Evidence', href: `/evidence?actor=${selectedActor.id}`, icon: Shield, color: 'text-cyber-green' },
                ].map(action => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-dark-700/30 transition-colors group"
                    >
                      <Icon className={`w-3.5 h-3.5 ${action.color}`} />
                      <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">
                        {action.label}
                      </span>
                      <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-gray-400 ml-auto transition-colors" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card flex flex-col items-center gap-4 py-16">
          <div className="w-16 h-16 rounded-full bg-cyber-blue/10 flex items-center justify-center border border-cyber-blue/20">
            <Crosshair className="w-8 h-8 text-cyber-blue" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-200">No Actor Selected</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md">
              Select a threat actor from the dropdown above to begin your investigation
            </p>
          </div>
        </div>
      )}

      {/* ── Disclaimer ── */}
      <div className="glass-card border-dashed border-dark-600/40">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-gray-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-gray-600 leading-relaxed">
            DarkTrace Nexus is a defensive cyber-threat intelligence research platform. All investigation data is synthetic/sanitized for demonstration. Attribution represents analytical correlation, not definitive identity determination. Always follow responsible disclosure guidelines.
          </p>
        </div>
      </div>
    </div>
  );
}
