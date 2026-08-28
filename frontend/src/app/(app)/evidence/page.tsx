'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { apiFetch, ensureAuth } from '@/lib/api';
import {
  Shield,
  Search,
  Filter,
  Hash,
  Clock,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
  ChevronDown,
  Eye,
  Database,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { Evidence, Actor } from '@/types';

type SortKey = 'confidence' | 'date' | 'type';
type ConfidenceRange = '' | 'high' | 'medium' | 'low';

const CHART_COLORS = ['#00ff88', '#00d4ff', '#ffcc00', '#ff3366', '#8855ff', '#ff8800', '#00ffcc', '#ff55aa'];

const TYPE_BADGE_STYLES: Record<string, string> = {
  alias_correlation: 'bg-cyber-blue/15 text-cyber-blue border-cyber-blue/25',
  pgp_match: 'bg-cyber-green/15 text-cyber-green border-cyber-green/25',
  wallet_link: 'bg-cyber-yellow/15 text-cyber-yellow border-cyber-yellow/25',
  stylometric: 'bg-cyber-purple/15 text-cyber-purple border-cyber-purple/25',
  behavior_pattern: 'bg-cyber-orange/15 text-cyber-orange border-cyber-orange/25',
  infrastructure: 'bg-cyber-red/15 text-cyber-red border-cyber-red/25',
};

function getBadgeClass(type: string): string {
  return TYPE_BADGE_STYLES[type] || 'bg-dark-600/50 text-gray-400 border-dark-500/30';
}

function truncateHash(hash: string | null): string {
  if (!hash) return '—';
  return hash.length > 16 ? `${hash.slice(0, 8)}...${hash.slice(-8)}` : hash;
}

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [confidenceRange, setConfidenceRange] = useState<ConfidenceRange>('');
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [showFilters, setShowFilters] = useState(false);
  const [copiedHash, setCopiedHash] = useState<number | null>(null);

  useEffect(() => {
    ensureAuth().then(() => {
      Promise.all([
        apiFetch<Evidence[]>('/api/v1/intelligence/evidence?limit=200'),
        apiFetch<Actor[]>('/api/v1/actors/?limit=100'),
      ])
        .then(([evData, actorData]) => {
          setEvidence(evData);
          setActors(actorData);
        })
        .catch((err) => {
          setError(err.message || 'Failed to load evidence');
        })
        .finally(() => setLoading(false));
    });
  }, []);

  const actorMap = useMemo(() => {
    const map: Record<number, string> = {};
    actors.forEach((a) => {
      map[a.id] = a.name;
    });
    return map;
  }, [actors]);

  const evidenceTypes = useMemo(() => [...new Set(evidence.map((e) => e.evidence_type))].sort(), [evidence]);
  const actorIds = useMemo(
    () => [...new Set(evidence.map((e) => e.actor_id).filter((id): id is number => id !== null))].sort((a, b) => a - b),
    [evidence],
  );

  const typeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    evidence.forEach((e) => {
      counts[e.evidence_type] = (counts[e.evidence_type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [evidence]);

  const filtered = useMemo(() => {
    let result = evidence;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          e.evidence_type.toLowerCase().includes(q) ||
          (e.source && e.source.toLowerCase().includes(q)) ||
          (e.evidence_hash && e.evidence_hash.toLowerCase().includes(q)),
      );
    }

    if (typeFilter) {
      result = result.filter((e) => e.evidence_type === typeFilter);
    }

    if (actorFilter) {
      const id = Number(actorFilter);
      result = result.filter((e) => e.actor_id === id);
    }

    if (confidenceRange) {
      result = result.filter((e) => {
        if (confidenceRange === 'high') return e.confidence >= 0.8;
        if (confidenceRange === 'medium') return e.confidence >= 0.5 && e.confidence < 0.8;
        return e.confidence < 0.5;
      });
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'confidence') return b.confidence - a.confidence;
      if (sortBy === 'date') {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      }
      return a.evidence_type.localeCompare(b.evidence_type);
    });

    return result;
  }, [evidence, search, typeFilter, actorFilter, confidenceRange, sortBy]);

  const stats = useMemo(() => {
    const verified = evidence.filter((e) => e.evidence_hash).length;
    const pending = evidence.length - verified;
    const avgConfidence = evidence.length > 0 ? evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length : 0;
    return { verified, pending, avgConfidence };
  }, [evidence]);

  const copyHash = (hash: string, id: number) => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopiedHash(id);
      setTimeout(() => setCopiedHash(null), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-10 h-10 border-2 border-cyber-blue/30 border-t-cyber-blue rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading evidence chain...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="w-8 h-8 text-cyber-red" />
        <p className="text-sm text-gray-300">Failed to load evidence</p>
        <p className="text-xs text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 tracking-tight">Evidence Chain</h1>
          <p className="text-sm text-gray-500 mt-1">Tamper-evident intelligence records with cryptographic hashes</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Database className="w-3.5 h-3.5" />
            <span className="font-mono">{filtered.length}</span>
            <span>of</span>
            <span className="font-mono">{evidence.length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card">
          <span className="stat-label">Total Evidence</span>
          <span className="stat-value text-gray-100">{evidence.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Verified</span>
          <span className="stat-value text-cyber-green">{stats.verified}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending</span>
          <span className="stat-value text-cyber-yellow">{stats.pending}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg Confidence</span>
          <span className="stat-value text-cyber-blue">{Math.round(stats.avgConfidence * 100)}%</span>
        </div>
      </div>

      {typeDistribution.length > 0 && (
        <div className="glass-card">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Evidence Type Distribution</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeDistribution} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1d2e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#e5e7eb',
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {typeDistribution.map((entry, i) => (
                    <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search evidence..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
              showFilters
                ? 'bg-cyber-blue/15 text-cyber-blue border-cyber-blue/30'
                : 'bg-dark-800 text-gray-400 border-dark-600/50 hover:border-dark-500'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="glass-card flex flex-wrap items-center gap-3">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field w-48">
              <option value="">All Types</option>
              {evidenceTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} className="input-field w-48">
              <option value="">All Actors</option>
              {actorIds.map((id) => (
                <option key={id} value={id}>
                  {actorMap[id] || `Actor #${id}`}
                </option>
              ))}
            </select>
            <select
              value={confidenceRange}
              onChange={(e) => setConfidenceRange(e.target.value as ConfidenceRange)}
              className="input-field w-44"
            >
              <option value="">All Confidence</option>
              <option value="high">High (80%+)</option>
              <option value="medium">Medium (50–79%)</option>
              <option value="low">Low (&lt;50%)</option>
            </select>
            <div className="flex items-center gap-1 bg-dark-800 rounded-lg border border-dark-600/50 p-0.5">
              {(['date', 'confidence', 'type'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    sortBy === s ? 'bg-dark-600 text-gray-200' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card text-center py-12">
          <Shield className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No evidence matches your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ev) => {
            const actorName = ev.actor_id ? actorMap[ev.actor_id] : null;
            const verified = !!ev.evidence_hash;

            return (
              <div key={ev.id} className="glass-card flex items-start gap-4 hover:border-dark-500/50 transition-all">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    verified ? 'bg-cyber-green/10' : 'bg-cyber-yellow/10'
                  }`}
                >
                  <Shield className={`w-5 h-5 ${verified ? 'text-cyber-green' : 'text-cyber-yellow'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getBadgeClass(ev.evidence_type)}`}>
                      {ev.evidence_type}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">#{String(ev.id).padStart(4, '0')}</span>
                    {actorName ? (
                      <Link href={`/actors/${ev.actor_id}`} className="text-xs text-cyber-blue hover:underline flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {actorName}
                      </Link>
                    ) : ev.actor_id ? (
                      <span className="text-xs text-gray-500">Actor #{ev.actor_id}</span>
                    ) : null}
                    <span className="flex items-center gap-1 ml-auto">
                      {verified ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-cyber-green" />
                          <span className="text-[10px] text-cyber-green font-medium">Verified</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3 text-cyber-yellow" />
                          <span className="text-[10px] text-cyber-yellow font-medium">Pending</span>
                        </>
                      )}
                    </span>
                  </div>

                  <p className="text-sm text-gray-300 leading-relaxed">{ev.description}</p>

                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-500">Confidence:</span>
                      <div className="confidence-bar w-20">
                        <div
                          className="confidence-fill"
                          style={{
                            width: `${ev.confidence * 100}%`,
                            background:
                              ev.confidence >= 0.8 ? '#00ff88' : ev.confidence >= 0.5 ? '#ffcc00' : '#ff3366',
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-gray-400">{Math.round(ev.confidence * 100)}%</span>
                    </div>

                    {ev.source && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <ExternalLink className="w-3 h-3" />
                        {ev.source}
                      </span>
                    )}

                    {ev.created_at && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {new Date(ev.created_at).toLocaleDateString()}
                      </span>
                    )}

                    {ev.evidence_hash && (
                      <button
                        onClick={() => copyHash(ev.evidence_hash!, ev.id)}
                        className="flex items-center gap-1 text-[10px] text-gray-500 font-mono bg-dark-700/50 px-2 py-1 rounded hover:bg-dark-700 transition-colors group"
                        title="Click to copy full hash"
                      >
                        <Hash className="w-3 h-3 text-gray-600 group-hover:text-gray-400" />
                        {truncateHash(ev.evidence_hash)}
                        {copiedHash === ev.id ? (
                          <CheckCircle className="w-3 h-3 text-cyber-green" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-600 group-hover:text-gray-400" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
