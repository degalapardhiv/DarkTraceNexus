'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch, ensureAuth } from '@/lib/api';
import Link from 'next/link';
import {
  Shield, AlertTriangle, Link2, Eye, User, Key, Wallet, Brain,
  Activity, Globe, Clock, ChevronDown, ChevronUp, ArrowRight,
  Search, Filter, Info, Target, Crosshair, BarChart3,
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts';

interface Attribution {
  id: number; source_actor_id: number; target_actor_id: number;
  overall_confidence: number; confidence_level: string;
  alias_similarity: number; pgp_match: number; wallet_relationship: number;
  behavior_similarity: number; stylometry_similarity: number;
  infrastructure_match: number; temporal_correlation: number;
  source_reliability: number;
}

interface Actor {
  id: number; name: string; risk_level: string; confidence_score: number;
  [key: string]: unknown;
}

const FACTORS = [
  { key: 'alias_similarity', label: 'Identity Correlation', weight: 0.1, icon: User, color: '#8b5cf6' },
  { key: 'pgp_match', label: 'PGP Correlation', weight: 0.2, icon: Key, color: '#06b6d4' },
  { key: 'wallet_relationship', label: 'Wallet Correlation', weight: 0.15, icon: Wallet, color: '#10b981' },
  { key: 'behavior_similarity', label: 'Behavior Correlation', weight: 0.15, icon: Activity, color: '#f59e0b' },
  { key: 'stylometry_similarity', label: 'Stylometric Correlation', weight: 0.2, icon: Brain, color: '#ec4899' },
  { key: 'infrastructure_match', label: 'Infrastructure Correlation', weight: 0.1, icon: Globe, color: '#3b82f6' },
  { key: 'temporal_correlation', label: 'Temporal Correlation', weight: 0.05, icon: Clock, color: '#6366f1' },
  { key: 'source_reliability', label: 'Source Reliability', weight: 0.05, icon: Shield, color: '#22c55e' },
] as const;

const CONFIDENCE_LEVELS = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW'] as const;

function getConfidenceColor(c: number): string {
  if (c >= 0.8) return 'text-green-400';
  if (c >= 0.6) return 'text-yellow-400';
  if (c >= 0.4) return 'text-orange-400';
  return 'text-red-400';
}

function getConfidenceBarColor(c: number): string {
  if (c >= 0.8) return 'bg-green-500';
  if (c >= 0.6) return 'bg-yellow-500';
  if (c >= 0.4) return 'bg-orange-500';
  return 'bg-red-500';
}

function getBadgeClass(level: string): string {
  switch (level) {
    case 'VERY_HIGH': return 'badge-critical';
    case 'HIGH': return 'badge-high';
    case 'MEDIUM': return 'badge-medium';
    case 'LOW': return 'badge-low';
    default: return 'badge-info';
  }
}

function getFactorValue(attribution: Attribution, key: string): number {
  return ((attribution as unknown as Record<string, number>)[key]) || 0;
}

function generateExplanation(attribution: Attribution): string {
  const high = FACTORS.filter((f) => getFactorValue(attribution, f.key) >= 0.7);
  const medium = FACTORS.filter((f) => {
    const v = getFactorValue(attribution, f.key);
    return v >= 0.4 && v < 0.7;
  });
  const low = FACTORS.filter((f) => getFactorValue(attribution, f.key) < 0.4);
  const parts: string[] = [];
  if (high.length > 0) {
    parts.push(`Strong ${high.map((f) => f.label.toLowerCase()).join(' and ')} correlations were identified`);
  }
  if (medium.length > 0) {
    parts.push(`Moderate ${medium.map((f) => f.label.toLowerCase()).join(' and ')} patterns were observed`);
  }
  if (low.length > 0) {
    parts.push(`${low.map((f) => f.label.toLowerCase()).join(', ')} showed minimal correlation`);
  }
  if (parts.length === 0) return 'Insufficient data to generate detailed attribution explanation.';
  return parts.join('. ') + '.';
}

function AttributionRadarChart({ attribution }: { attribution: Attribution }) {
  const data = FACTORS.map((f) => ({
    factor: f.label.split(' ')[0],
    value: Math.round(getFactorValue(attribution, f.key) * 100),
    fullMark: 100,
  }));
  return (
    <ResponsiveContainer width="100%" height={250}>
      <RadarChart data={data}>
        <PolarGrid stroke="#374151" />
        <PolarAngleAxis dataKey="factor" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} />
        <Radar name="Correlation" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function FactorBar({ label, value, weight, icon: Icon, color }: {
  label: string; value: number; weight: number;
  icon: React.ComponentType<any>;
  color: string;
}) {
  const percentage = Math.round(value * 100);
  const weightPercent = Math.round(weight * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-48 shrink-0">
        <Icon size={14} style={{ color }} />
        <span className="text-sm text-gray-300">{label}</span>
      </div>
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: color }} />
      </div>
      <div className="w-20 text-right shrink-0">
        <span className="text-sm font-mono" style={{ color }}>{percentage}%</span>
        <span className="text-xs text-gray-500 ml-1">({weightPercent}w)</span>
      </div>
    </div>
  );
}

function AttributionCard({ attribution, actors, isExpanded, onToggle }: {
  attribution: Attribution; actors: Map<number, Actor>;
  isExpanded: boolean; onToggle: () => void;
}) {
  const sourceActor = actors.get(attribution.source_actor_id);
  const targetActor = actors.get(attribution.target_actor_id);
  return (
    <div className="glass-card p-5 hover:border-purple-500/30 transition-all duration-300">
      <div className="flex items-center justify-between cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Target size={20} className="text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <Link href={`/actors/${attribution.source_actor_id}`} className="text-white font-semibold hover:text-purple-400 transition-colors" onClick={(e) => e.stopPropagation()}>
                {sourceActor?.name || `Actor #${attribution.source_actor_id}`}
              </Link>
              <ArrowRight size={14} className="text-gray-500" />
              <Link href={`/actors/${attribution.target_actor_id}`} className="text-white font-semibold hover:text-purple-400 transition-colors" onClick={(e) => e.stopPropagation()}>
                {targetActor?.name || `Actor #${attribution.target_actor_id}`}
              </Link>
            </div>
            <p className="text-xs text-gray-500 mt-1">Attribution ID: {attribution.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={getBadgeClass(attribution.confidence_level)}>{attribution.confidence_level.replace('_', ' ')}</span>
          <div className="text-right">
            <div className={`text-lg font-bold ${getConfidenceColor(attribution.overall_confidence)}`}>{Math.round(attribution.overall_confidence * 100)}%</div>
          </div>
          {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </div>
      <div className="mt-3 confidence-bar">
        <div className={`confidence-fill ${getConfidenceBarColor(attribution.overall_confidence)}`} style={{ width: `${attribution.overall_confidence * 100}%` }} />
      </div>
      {isExpanded && (
        <div className="mt-6 space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Crosshair size={14} className="text-purple-400" /> 8-Factor Correlation Radar
            </h4>
            <AttributionRadarChart attribution={attribution} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <BarChart3 size={14} className="text-blue-400" /> Detailed Factor Breakdown
            </h4>
            <div className="space-y-2">
              {FACTORS.map((factor) => (
                <FactorBar key={factor.key} label={factor.label} value={getFactorValue(attribution, factor.key)} weight={factor.weight} icon={factor.icon} color={factor.color} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2"><Eye size={14} /> Supporting Evidence</h4>
              <ul className="space-y-1">
                {FACTORS.filter((f) => getFactorValue(attribution, f.key) >= 0.5).map((f) => (
                  <li key={f.key} className="text-xs text-gray-300 flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">+</span>
                    <span>{f.label}: {Math.round(getFactorValue(attribution, f.key) * 100)}% match</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2"><AlertTriangle size={14} /> Contradicting Evidence</h4>
              <ul className="space-y-1">
                {FACTORS.filter((f) => getFactorValue(attribution, f.key) < 0.4).map((f) => (
                  <li key={f.key} className="text-xs text-gray-300 flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">-</span>
                    <span>{f.label}: {Math.round(getFactorValue(attribution, f.key) * 100)}% match</span>
                  </li>
                ))}
                {FACTORS.filter((f) => getFactorValue(attribution, f.key) < 0.4).length === 0 && (
                  <li className="text-xs text-gray-400">No contradicting evidence found</li>
                )}
              </ul>
            </div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2"><Info size={14} className="text-blue-400" /> Attribution Analysis</h4>
            <p className="text-sm text-gray-300 leading-relaxed">{generateExplanation(attribution)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttributionsPage() {
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [actors, setActors] = useState<Map<number, Actor>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ensureAuth();
    fetchData();
  }, []);

  useEffect(() => {
    pollTimerRef.current = setInterval(fetchData, 30000);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const [attrData, actorsData] = await Promise.all([
        apiFetch<Attribution[]>('/api/v1/intelligence/attributions'),
        apiFetch<Actor[]>('/api/v1/actors/?limit=100'),
      ]);
      const actorMap = new Map<number, Actor>();
      actorsData.forEach((actor) => actorMap.set(actor.id, actor));
      attrData.sort((a, b) => b.overall_confidence - a.overall_confidence);
      setAttributions(attrData);
      setActors(actorMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const filteredAttributions = attributions.filter((a) => {
    if (filterLevel !== 'ALL' && a.confidence_level !== filterLevel) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const src = actors.get(a.source_actor_id)?.name?.toLowerCase() || '';
      const tgt = actors.get(a.target_actor_id)?.name?.toLowerCase() || '';
      if (!src.includes(q) && !tgt.includes(q)) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading attributions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card flex flex-col items-center gap-4 py-16">
        <AlertTriangle className="w-8 h-8 text-cyber-orange" />
        <p className="text-sm text-gray-400">{error}</p>
        <button onClick={fetchData} className="btn-primary">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 tracking-tight flex items-center gap-3">
            <Target className="w-7 h-7 text-purple-400" />
            Threat Actor Attributions
          </h1>
          <p className="text-sm text-gray-500 mt-1">Multi-factor correlation analysis for threat actor identification</p>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="text" placeholder="Search by actor name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input-field pl-10" />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-500" />
            <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="input-field w-40">
              <option value="ALL">All Levels</option>
              {CONFIDENCE_LEVELS.map((level) => (
                <option key={level} value={level}>{level.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <span className="text-sm text-gray-500">{filteredAttributions.length} attributions</span>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle size={18} className="text-yellow-400 mt-0.5 shrink-0" />
        <p className="text-sm text-yellow-200">
          <strong>Disclaimer:</strong> Attribution represents analytical correlation between synthetic entities, not definitive identity determination. All attributions should be validated through independent analysis before operational use.
        </p>
      </div>

      {filteredAttributions.length === 0 ? (
        <div className="glass-card text-center py-12">
          <Eye className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No attributions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAttributions.map((attr) => (
            <AttributionCard key={attr.id} attribution={attr} actors={actors} isExpanded={expandedIds.has(attr.id)} onToggle={() => toggleExpand(attr.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
