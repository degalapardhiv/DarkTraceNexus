'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { apiFetch, ensureAuth } from '@/lib/api';
import { createSSEConnection } from '@/lib/sse';
import {
  Users, Database, Key, Wallet, Globe, Link2, Shield, AlertTriangle,
  TrendingUp, Activity, Clock, FileText, Search, ChevronRight,
  ArrowUpRight, ArrowDownRight, Zap, Eye, Crosshair, Target,
  BarChart3, RefreshCw, Wifi, WifiOff
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import Link from 'next/link';
import type { DashboardStats, Actor, Attribution } from '@/types';

const COLORS = ['#00d4ff', '#00ff88', '#ff8800', '#ff3366', '#8855ff', '#ffcc00', '#00e5ff'];

const RISK_COLORS: Record<string, string> = {
  critical: '#ff3366',
  high: '#ff8800',
  medium: '#ffcc00',
  low: '#00ff88',
  unknown: '#6b7280',
};

const CONFIDENCE_COLOR = (c: number) =>
  c >= 0.8 ? '#00ff88' : c >= 0.6 ? '#00d4ff' : c >= 0.4 ? '#ffcc00' : '#ff3366';

const POLL_INTERVAL = 30000;

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [actors, setActors] = useState<Actor[]>([]);
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'polling' | 'disconnected'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [s, a, attr] = await Promise.all([
        apiFetch<DashboardStats>('/api/v1/intelligence/dashboard'),
        apiFetch<Actor[]>('/api/v1/actors/?limit=50'),
        apiFetch<Attribution[]>('/api/v1/intelligence/attributions'),
      ]);
      setStats(s);
      setActors(a);
      setAttributions(attr);
      setLastUpdate(new Date());
      return { stats: s, actors: a, attributions: attr };
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    setSseStatus('polling');
    pollTimerRef.current = setInterval(async () => {
      await fetchData();
    }, POLL_INTERVAL);
  }, [fetchData]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let sseDestroy: (() => void) | null = null;

    const init = async () => {
      await ensureAuth();
      const result = await fetchData();
      if (result) setLoading(false);

      sseDestroy = createSSEConnection('/api/v1/events', {
        onOpen: () => setSseStatus('connected'),
        onEvent: (event, data) => {
          if (event === 'heartbeat') return;
          if (['actor_created', 'attribution_updated', 'evidence_added', 'relationship_updated', 'timeline_updated'].includes(event)) {
            fetchData();
          }
        },
        onError: () => {
          setSseStatus('polling');
          startPolling();
        },
        pollingFallback: fetchData,
        pollingInterval: POLL_INTERVAL,
      }).destroy;
    };

    init();

    return () => {
      sseDestroy?.();
      stopPolling();
    };
  }, [fetchData, startPolling, stopPolling]);

  const actorMap = useMemo(() => {
    const m = new Map<number, Actor>();
    actors.forEach(a => m.set(a.id, a));
    return m;
  }, [actors]);

  const riskData = useMemo(() => {
    const dist = actors.reduce(
      (acc, a) => { acc[a.risk_level] = (acc[a.risk_level] || 0) + 1; return acc; },
      {} as Record<string, number>
    );
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [actors]);

  const confDistribution = useMemo(() => [
    { name: 'VERY_HIGH', label: 'Very High', value: attributions.filter(a => a.confidence_level === 'VERY_HIGH').length, fill: '#00ff88' },
    { name: 'HIGH', label: 'High', value: attributions.filter(a => a.confidence_level === 'HIGH').length, fill: '#00d4ff' },
    { name: 'MEDIUM', label: 'Medium', value: attributions.filter(a => a.confidence_level === 'MEDIUM').length, fill: '#ffcc00' },
    { name: 'LOW', label: 'Low', value: attributions.filter(a => a.confidence_level === 'LOW').length, fill: '#ff3366' },
  ], [attributions]);

  const topActors = useMemo(() =>
    [...actors]
      .sort((a, b) => b.confidence_score - a.confidence_score)
      .slice(0, 8)
      .map(a => ({
        name: a.name.length > 14 ? a.name.slice(0, 14) + '..' : a.name,
        score: Math.round(a.confidence_score * 100),
        risk: a.risk_level,
      })),
    [actors]
  );

  const radarData = useMemo(() => {
    if (attributions.length === 0) return [];
    const avg = (fn: (a: Attribution) => number) =>
      Math.round((attributions.reduce((s, a) => s + fn(a), 0) / attributions.length) * 100);
    return [
      { dimension: 'PGP', value: avg(a => a.pgp_match), fullMark: 100 },
      { dimension: 'Wallet', value: avg(a => a.wallet_relationship), fullMark: 100 },
      { dimension: 'Stylometry', value: avg(a => a.stylometry_similarity), fullMark: 100 },
      { dimension: 'Behavior', value: avg(a => a.behavior_similarity), fullMark: 100 },
      { dimension: 'Infra', value: avg(a => a.infrastructure_match), fullMark: 100 },
      { dimension: 'Temporal', value: avg(a => a.temporal_correlation), fullMark: 100 },
      { dimension: 'Alias', value: avg(a => a.alias_similarity), fullMark: 100 },
    ];
  }, [attributions]);

  const activityTimeline = useMemo(() =>
    actors.slice(0, 12).map((a, i) => ({
      name: a.name.length > 8 ? a.name.slice(0, 8) + '..' : a.name,
      aliases: a.alias_count,
      infrastructure: a.domain_count + a.wallet_count,
      posts: a.post_count,
    })),
    [actors]
  );

  const highConfAlerts = useMemo(() =>
    attributions
      .filter(a => a.overall_confidence >= 0.65)
      .sort((a, b) => b.overall_confidence - a.overall_confidence)
      .slice(0, 6),
    [attributions]
  );

  const recentIntel = useMemo(() =>
    [...actors]
      .filter(a => a.created_at)
      .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
      .slice(0, 6),
    [actors]
  );

  const statCards = stats
    ? [
        { label: 'Threat Actors', value: stats.total_actors, icon: Users, color: 'text-cyber-blue', bg: 'bg-cyber-blue/10', border: 'border-cyber-blue/20', trend: '+2.4%' as string | null, up: true },
        { label: 'Aliases', value: stats.total_aliases, icon: Database, color: 'text-cyber-cyan', bg: 'bg-cyber-cyan/10', border: 'border-cyber-cyan/20', trend: '+5.1%' as string | null, up: true },
        { label: 'PGP Keys', value: stats.total_pgps, icon: Key, color: 'text-cyber-green', bg: 'bg-cyber-green/10', border: 'border-cyber-green/20', trend: '+1.8%' as string | null, up: true },
        { label: 'Wallets', value: stats.total_wallets, icon: Wallet, color: 'text-cyber-yellow', bg: 'bg-cyber-yellow/10', border: 'border-cyber-yellow/20', trend: '+3.2%' as string | null, up: true },
        { label: 'Domains', value: stats.total_domains, icon: Globe, color: 'text-cyber-purple', bg: 'bg-cyber-purple/10', border: 'border-cyber-purple/20', trend: '+0.7%' as string | null, up: true },
        { label: 'Correlations', value: stats.total_attributions, icon: Link2, color: 'text-cyber-orange', bg: 'bg-cyber-orange/10', border: 'border-cyber-orange/20', trend: '+8.3%' as string | null, up: true },
        { label: 'Evidence Items', value: stats.total_evidence, icon: Shield, color: 'text-cyber-green', bg: 'bg-cyber-green/10', border: 'border-cyber-green/20', trend: '+4.5%' as string | null, up: true },
        { label: 'High-Conf Links', value: stats.high_confidence_linkages, icon: AlertTriangle, color: 'text-cyber-red', bg: 'bg-cyber-red/10', border: 'border-cyber-red/20', trend: null, up: false },
      ]
    : [];

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
              <Crosshair className="w-5 h-5 text-cyber-blue/60" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-400 font-medium">Initializing Intelligence Dashboard</p>
            <p className="text-xs text-gray-600 mt-1">Connecting to DarkTrace Nexus backend...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card flex flex-col items-center gap-4 py-16">
        <div className="w-16 h-16 rounded-full bg-cyber-red/10 flex items-center justify-center border border-cyber-red/20">
          <AlertTriangle className="w-8 h-8 text-cyber-red" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-200">Connection Error</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md">{error}</p>
          <p className="text-xs text-gray-600 mt-2">Ensure the backend API is running and accessible</p>
        </div>
        <button onClick={() => window.location.reload()} className="btn-primary mt-2 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-100 tracking-tight">Intelligence Overview</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider flex items-center gap-1 ${
              sseStatus === 'connected'
                ? 'bg-cyber-green/10 text-cyber-green border-cyber-green/20'
                : sseStatus === 'polling'
                  ? 'bg-cyber-yellow/10 text-cyber-yellow border-cyber-yellow/20'
                  : 'bg-cyber-blue/10 text-cyber-blue border-cyber-blue/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                sseStatus === 'connected' ? 'bg-cyber-green animate-pulse' :
                sseStatus === 'polling' ? 'bg-cyber-yellow' : 'bg-cyber-blue animate-pulse'
              }`} />
              {sseStatus === 'connected' ? 'Live (SSE)' : sseStatus === 'polling' ? 'Polling' : 'Connecting'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time threat actor correlation and attribution analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-[10px] text-gray-600 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Updated {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <span className="px-3 py-1 rounded-full text-[10px] font-medium bg-cyber-purple/10 text-cyber-purple border border-cyber-purple/20 uppercase tracking-wider">
            Demo Mode
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="glass-card group hover:border-dark-500/50 hover:bg-dark-800/60 transition-all duration-200 cursor-default"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg ${card.bg} border ${card.border} flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${card.color}`} />
                </div>
                <div className="flex items-center gap-1">
                  {card.trend && (
                    <span className={`flex items-center gap-0.5 text-[10px] font-mono ${card.up ? 'text-cyber-green' : 'text-cyber-red'}`}>
                      {card.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {card.trend}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
              <div className={`text-2xl font-bold font-mono ${card.color}`}>
                {card.value.toLocaleString()}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-cyber-blue" />
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Threat Severity Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={riskData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                {riskData.map((entry, i) => (
                  <Cell key={i} fill={RISK_COLORS[entry.name.toLowerCase()] || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#141620', border: '1px solid #2e3352', borderRadius: 8, fontSize: 12 }} itemStyle={{ color: '#e5e7eb' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {riskData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: RISK_COLORS[d.name.toLowerCase()] || COLORS[i % COLORS.length] }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-cyber-green" />
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Attribution Confidence Levels</h3>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={confDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1d2e" />
              <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#141620', border: '1px solid #2e3352', borderRadius: 8, fontSize: 12 }} itemStyle={{ color: '#e5e7eb' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {confDistribution.map((entry, i) => (<Cell key={i} fill={entry.fill} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-cyber-purple" />
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Attribution Dimensions (Avg)</h3>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="#2e3352" />
              <PolarAngleAxis dataKey="dimension" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <PolarRadiusAxis tick={{ fill: '#4b5563', fontSize: 9 }} domain={[0, 100]} />
              <Radar name="Avg Confidence" dataKey="value" stroke="#8855ff" fill="#8855ff" fillOpacity={0.2} strokeWidth={2} />
              <Tooltip contentStyle={{ background: '#141620', border: '1px solid #2e3352', borderRadius: 8, fontSize: 12 }} itemStyle={{ color: '#e5e7eb' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-cyber-cyan" />
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Top Actors by Confidence</h3>
            </div>
            <Link href="/actors" className="text-[11px] text-cyber-blue hover:text-cyber-cyan transition-colors flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topActors} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1d2e" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip contentStyle={{ background: '#141620', border: '1px solid #2e3352', borderRadius: 8, fontSize: 12 }} itemStyle={{ color: '#e5e7eb' }} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={16}>
                {topActors.map((entry, i) => (
                  <Cell key={i} fill={entry.score >= 80 ? '#00ff88' : entry.score >= 50 ? '#00d4ff' : '#ffcc00'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-cyber-orange" />
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Actor Activity Timeline</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={activityTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1d2e" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#141620', border: '1px solid #2e3352', borderRadius: 8, fontSize: 12 }} itemStyle={{ color: '#e5e7eb' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
              <Area type="monotone" dataKey="aliases" stackId="1" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="infrastructure" stackId="2" stroke="#ff8800" fill="#ff8800" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="posts" stackId="3" stroke="#8855ff" fill="#8855ff" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Attribution Alerts */}
      {highConfAlerts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-cyber-yellow" />
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">High-Confidence Attribution Alerts</h3>
            <span className="badge-info text-[10px]">{highConfAlerts.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {highConfAlerts.map(attr => {
              const src = actorMap.get(attr.source_actor_id);
              const tgt = actorMap.get(attr.target_actor_id);
              const confPct = Math.round(attr.overall_confidence * 100);
              const badgeClass = attr.confidence_level === 'VERY_HIGH' ? 'badge-critical' : attr.confidence_level === 'HIGH' ? 'badge-high' : attr.confidence_level === 'MEDIUM' ? 'badge-medium' : 'badge-low';
              return (
                <div key={attr.id} className="glass-card group hover:border-dark-500/50 transition-all duration-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${CONFIDENCE_COLOR(attr.overall_confidence)}15` }}>
                        <AlertTriangle className="w-4 h-4" style={{ color: CONFIDENCE_COLOR(attr.overall_confidence) }} />
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${badgeClass}`}>{attr.confidence_level}</span>
                    </div>
                    <span className="text-lg font-bold font-mono" style={{ color: CONFIDENCE_COLOR(attr.overall_confidence) }}>{confPct}%</span>
                  </div>
                  <div className="mb-3 flex items-center gap-2 text-xs">
                    <Link href={`/actors/${attr.source_actor_id}`} className="text-cyber-blue hover:text-cyber-cyan font-mono transition-colors">{src?.name || `Actor #${attr.source_actor_id}`}</Link>
                    <ArrowUpRight className="w-3 h-3 text-gray-600" />
                    <Link href={`/actors/${attr.target_actor_id}`} className="text-cyber-blue hover:text-cyber-cyan font-mono transition-colors">{tgt?.name || `Actor #${attr.target_actor_id}`}</Link>
                  </div>
                  <div className="space-y-1.5">
                    {[{ label: 'PGP Match', value: attr.pgp_match }, { label: 'Wallet Rel', value: attr.wallet_relationship }, { label: 'Stylometry', value: attr.stylometry_similarity }, { label: 'Behavior', value: attr.behavior_similarity }].map(dim => (
                      <div key={dim.label} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 w-16 shrink-0">{dim.label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-dark-700 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${dim.value * 100}%`, background: CONFIDENCE_COLOR(dim.value) }} />
                        </div>
                        <span className="text-[10px] font-mono text-gray-500 w-8 text-right">{Math.round(dim.value * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Correlations Table */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-cyber-green" />
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Cross-Actor Correlations</h3>
            <span className="badge-info text-[10px]">{attributions.length} total</span>
          </div>
          <Link href="/search" className="text-xs text-cyber-blue hover:text-cyber-cyan transition-colors flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-600/50">
                {['Source', 'Target', 'Confidence', 'Level', 'PGP', 'Wallet', 'Stylometry', 'Behavior'].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attributions.slice(0, 12).map(attr => {
                const src = actorMap.get(attr.source_actor_id);
                const tgt = actorMap.get(attr.target_actor_id);
                const levelColor = attr.confidence_level === 'VERY_HIGH' ? 'bg-cyber-green/20 text-cyber-green border-cyber-green/30' : attr.confidence_level === 'HIGH' ? 'bg-cyber-blue/20 text-cyber-blue border-cyber-blue/30' : attr.confidence_level === 'MEDIUM' ? 'bg-cyber-yellow/20 text-cyber-yellow border-cyber-yellow/30' : 'bg-cyber-red/20 text-cyber-red border-cyber-red/30';
                return (
                  <tr key={attr.id} className="border-b border-dark-700/30 hover:bg-dark-800/30 transition-colors">
                    <td className="py-2.5 px-3"><Link href={`/actors/${attr.source_actor_id}`} className="text-cyber-blue hover:text-cyber-cyan font-mono text-xs transition-colors">{src?.name || `Actor #${attr.source_actor_id}`}</Link></td>
                    <td className="py-2.5 px-3"><Link href={`/actors/${attr.target_actor_id}`} className="text-cyber-blue hover:text-cyber-cyan font-mono text-xs transition-colors">{tgt?.name || `Actor #${attr.target_actor_id}`}</Link></td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-dark-700 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${attr.overall_confidence * 100}%`, background: CONFIDENCE_COLOR(attr.overall_confidence) }} />
                        </div>
                        <span className="text-xs font-mono text-gray-400 w-10 text-right">{Math.round(attr.overall_confidence * 100)}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${levelColor}`}>{attr.confidence_level}</span></td>
                    <td className="py-2.5 px-3 text-xs font-mono text-gray-400">{Math.round(attr.pgp_match * 100)}%</td>
                    <td className="py-2.5 px-3 text-xs font-mono text-gray-400">{Math.round(attr.wallet_relationship * 100)}%</td>
                    <td className="py-2.5 px-3 text-xs font-mono text-gray-400">{Math.round(attr.stylometry_similarity * 100)}%</td>
                    <td className="py-2.5 px-3 text-xs font-mono text-gray-400">{Math.round(attr.behavior_similarity * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Intel */}
      {recentIntel.length > 0 && (
        <div className="glass-card">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-cyber-orange" />
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Recent Intelligence Activity</h3>
          </div>
          <div className="space-y-3">
            {recentIntel.map(actor => {
              const riskColor = actor.risk_level === 'critical' ? 'text-cyber-red' : actor.risk_level === 'high' ? 'text-cyber-orange' : actor.risk_level === 'medium' ? 'text-cyber-yellow' : 'text-cyber-green';
              return (
                <Link key={actor.id} href={`/actors/${actor.id}`} className="flex items-center gap-4 p-3 rounded-lg hover:bg-dark-700/30 transition-colors group">
                  <div className="w-10 h-10 rounded-lg bg-dark-700/50 border border-dark-600/30 flex items-center justify-center shrink-0 group-hover:border-cyber-blue/20 transition-colors">
                    <Eye className="w-4 h-4 text-gray-500 group-hover:text-cyber-blue transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200 truncate group-hover:text-cyber-blue transition-colors">{actor.name}</span>
                      <span className={`text-[10px] font-medium uppercase ${riskColor}`}>{actor.risk_level}</span>
                      {actor.is_active && <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" />}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-[11px] text-gray-500">{actor.alias_count} aliases</span>
                      <span className="text-[11px] text-gray-500">{actor.post_count} posts</span>
                      <span className="text-[11px] text-gray-500">Confidence: {Math.round(actor.confidence_score * 100)}%</span>
                      {actor.created_at && (
                        <span className="text-[11px] text-gray-600 flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(actor.created_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="glass-card border-dashed border-dark-600/40">
        <div className="flex items-start gap-3">
          <Shield className="w-4 h-4 text-gray-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-gray-600 leading-relaxed">
            DarkTrace Nexus is a defensive cyber-threat intelligence research platform. Demonstration data is synthetic/sanitized. Attribution represents analytical correlation, not definitive identity determination.
          </p>
        </div>
      </div>
    </div>
  );
}
