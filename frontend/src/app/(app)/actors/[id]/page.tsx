'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ensureAuth } from '@/lib/api';
import {
  ArrowLeft, Users, Key, Wallet, Globe, FileText,
  Shield, Brain, Activity, Link2, Clock, Eye,
  ExternalLink, MapPin, Hash, Calendar, AlertTriangle,
  ChevronRight, Target, Crosshair
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import type {
  ActorDetail, Alias, PGPKey, Wallet as WalletType, Domain, IP,
  BehaviorProfile, StylometricProfile, Attribution, Evidence, TimelineEvent
} from '@/types';

interface ActorDetailData {
  actor: ActorDetail['actor'];
  aliases: Alias[];
  pgp_keys: PGPKey[];
  wallets: WalletType[];
  domains: Domain[];
  ips: IP[];
  posts: any[];
  behavior_profile: BehaviorProfile | null;
  stylometric_profile: StylometricProfile | null;
  attributions: Attribution[];
  evidence: Evidence[];
}

function riskBadgeClass(level: string): string {
  switch (level?.toUpperCase()) {
    case 'CRITICAL': return 'badge-critical';
    case 'HIGH': return 'badge-high';
    case 'MEDIUM': return 'badge-medium';
    case 'LOW': return 'badge-low';
    default: return 'badge-info';
  }
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return '#00ff88';
  if (score >= 0.5) return '#ffcc00';
  return '#ff4444';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return dateStr.split('T')[0];
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ActorDetailPage() {
  const params = useParams();
  const actorId = params?.id;
  const [data, setData] = useState<ActorDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    if (!actorId) return;
    ensureAuth().then(() => {
      apiFetch<ActorDetailData>(`/api/v1/actors/${actorId}`)
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    });
  }, [actorId]);

  useEffect(() => {
    if (activeTab === 'timeline' && actorId && timeline.length === 0) {
      setTimelineLoading(true);
      ensureAuth().then(() => {
        apiFetch<TimelineEvent[]>(`/api/v1/intelligence/timeline?actor_id=${actorId}`)
          .then(setTimeline)
          .catch(console.error)
          .finally(() => setTimelineLoading(false));
      });
    }
  }, [activeTab, actorId, timeline.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-2 border-cyber-blue/20 rounded-full" />
            <div className="w-12 h-12 border-2 border-transparent border-t-cyber-blue rounded-full animate-spin absolute top-0 left-0" />
          </div>
          <p className="text-sm text-gray-500 animate-pulse">Loading actor intelligence...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Link href="/actors" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Actors</span>
        </Link>
        <div className="glass-card text-center py-16">
          <AlertTriangle className="w-12 h-12 text-yellow-500/50 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Actor not found</p>
          <p className="text-gray-600 text-sm mt-2">The requested actor could not be located.</p>
        </div>
      </div>
    );
  }

  const {
    actor, aliases, pgp_keys, wallets, domains, ips, posts,
    behavior_profile, stylometric_profile, attributions, evidence
  } = data;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Eye },
    { id: 'aliases', label: `Aliases (${aliases.length})`, icon: Users },
    { id: 'pgp_keys', label: `PGP Keys (${pgp_keys.length})`, icon: Key },
    { id: 'wallets', label: `Wallets (${wallets.length})`, icon: Wallet },
    { id: 'infrastructure', label: `Infrastructure (${domains.length + ips.length})`, icon: Globe },
    { id: 'behavior', label: 'Behavior', icon: Brain },
    { id: 'stylometry', label: 'Stylometry', icon: Activity },
    { id: 'attributions', label: `Attributions (${attributions.length})`, icon: Link2 },
    { id: 'evidence', label: `Evidence (${evidence.length})`, icon: Shield },
    { id: 'timeline', label: 'Timeline', icon: Clock },
  ];

  const radarData = behavior_profile
    ? [
        { metric: 'Night Activity', value: behavior_profile.night_activity_pct },
        { metric: 'Weekend Activity', value: behavior_profile.weekend_activity_pct },
        {
          metric: 'Posting Freq',
          value: Math.min(behavior_profile.posting_frequency * 20, 100),
        },
        {
          metric: 'Marketplace',
          value:
            behavior_profile.marketplace_activity === 'HIGH'
              ? 90
              : behavior_profile.marketplace_activity === 'MEDIUM'
              ? 50
              : 20,
        },
        {
          metric: 'Forum',
          value:
            behavior_profile.forum_activity === 'HIGH'
              ? 90
              : behavior_profile.forum_activity === 'MEDIUM'
              ? 50
              : 20,
        },
      ]
    : [];

  const stylometryRadar = stylometric_profile
    ? [
        {
          metric: 'Sentence Length',
          value: Math.min(stylometric_profile.avg_sentence_length * 3, 100),
        },
        {
          metric: 'Vocabulary',
          value: stylometric_profile.vocabulary_richness * 100,
        },
        {
          metric: 'Punctuation',
          value: stylometric_profile.punctuation_ratio * 1000,
        },
        {
          metric: 'Word Length',
          value: stylometric_profile.avg_word_length * 15,
        },
        {
          metric: 'Samples',
          value: Math.min(stylometric_profile.sample_count * 5, 100),
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link
          href="/actors"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-100 truncate">
              {actor.name}
            </h1>
            <span className={riskBadgeClass(actor.risk_level)}>
              {actor.risk_level}
            </span>
            {actor.is_active && (
              <span className="badge-info text-[10px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyber-blue inline-block animate-pulse" />
                ACTIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            <p className="text-sm text-gray-500 font-mono">Actor #{actor.id}</p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Confidence:</span>
              <div className="confidence-bar w-20">
                <div
                  className="confidence-fill"
                  style={{
                    width: `${actor.confidence_score * 100}%`,
                    background: confidenceColor(actor.confidence_score),
                  }}
                />
              </div>
              <span
                className="text-xs font-mono"
                style={{ color: confidenceColor(actor.confidence_score) }}
              >
                {Math.round(actor.confidence_score * 100)}%
              </span>
            </div>
            {actor.first_seen && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                First seen: {formatDate(actor.first_seen)}
              </span>
            )}
            {actor.last_seen && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last seen: {formatDate(actor.last_seen)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/graph?actor=${actor.id}`}
            className="btn-primary inline-flex items-center gap-2 text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Relationship Graph
          </Link>
          <Link
            href={`/reports?actor=${actor.id}`}
            className="px-4 py-2 bg-dark-700/50 hover:bg-dark-600/50 border border-dark-600/50 rounded-lg text-sm text-gray-300 transition-all inline-flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Generate Report
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-dark-700/50 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'text-cyber-blue border-b-2 border-cyber-blue'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Description */}
          <div className="lg:col-span-2 glass-card">
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyber-blue" />
              Description
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              {actor.description || 'No description available for this actor.'}
            </p>
            {actor.tags && (
              <div className="mt-4">
                <h4 className="text-xs text-gray-500 uppercase mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {actor.tags.split(',').map((tag, i) => (
                    <span key={i} className="badge-info text-[10px]">
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="glass-card">
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-cyber-blue" />
              Quick Stats
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs text-gray-500">Aliases</span>
                </div>
                <span className="text-sm font-mono text-gray-300">{aliases.length}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                <div className="flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs text-gray-500">PGP Keys</span>
                </div>
                <span className="text-sm font-mono text-gray-300">{pgp_keys.length}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                <div className="flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs text-gray-500">Wallets</span>
                </div>
                <span className="text-sm font-mono text-gray-300">{wallets.length}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs text-gray-500">Domains</span>
                </div>
                <span className="text-sm font-mono text-gray-300">{domains.length}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs text-gray-500">IP Addresses</span>
                </div>
                <span className="text-sm font-mono text-gray-300">{ips.length}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs text-gray-500">Posts</span>
                </div>
                <span className="text-sm font-mono text-gray-300">{posts.length}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs text-gray-500">Attributions</span>
                </div>
                <span className="text-sm font-mono text-gray-300">{attributions.length}</span>
              </div>
            </div>
          </div>

          {/* Aliases Summary */}
          <div className="glass-card">
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <Hash className="w-4 h-4 text-cyber-blue" />
              Known Aliases
            </h3>
            <div className="flex flex-wrap gap-2">
              {aliases.length > 0 ? (
                aliases.slice(0, 8).map((a) => (
                  <span key={a.id} className="badge-info text-xs flex items-center gap-1">
                    {a.is_primary && <Crosshair className="w-3 h-3" />}
                    {a.handle}
                    {a.platform && (
                      <span className="text-gray-500 text-[10px]">({a.platform})</span>
                    )}
                  </span>
                ))
              ) : (
                <p className="text-xs text-gray-500">No aliases recorded.</p>
              )}
              {aliases.length > 8 && (
                <button
                  onClick={() => setActiveTab('aliases')}
                  className="text-xs text-cyber-blue hover:text-cyber-blue/80 transition-colors"
                >
                  +{aliases.length - 8} more
                </button>
              )}
            </div>
          </div>

          {/* Quick PGP */}
          <div className="glass-card">
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <Key className="w-4 h-4 text-cyber-blue" />
              PGP Keys
            </h3>
            {pgp_keys.length > 0 ? (
              <div className="space-y-2">
                {pgp_keys.slice(0, 3).map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between py-1.5 border-b border-dark-700/20 last:border-0"
                  >
                    <span className="font-mono text-[11px] text-gray-400 truncate max-w-[180px]">
                      {k.fingerprint.slice(0, 20)}...
                    </span>
                    <span className="text-[10px] text-gray-500">{k.algorithm || 'RSA'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">No PGP keys recorded.</p>
            )}
          </div>

          {/* Quick Wallets */}
          <div className="glass-card">
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-cyber-blue" />
              Wallets
            </h3>
            {wallets.length > 0 ? (
              <div className="space-y-2">
                {wallets.slice(0, 3).map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between py-1.5 border-b border-dark-700/20 last:border-0"
                  >
                    <span className="font-mono text-[11px] text-gray-400 truncate max-w-[140px]">
                      {w.address.slice(0, 16)}...
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 uppercase">{w.currency}</span>
                      <span className="text-[10px] font-mono text-gray-400">{w.balance}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">No wallets recorded.</p>
            )}
          </div>
        </div>
      )}

      {/* Aliases Tab */}
      {activeTab === 'aliases' && (
        <div className="glass-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyber-blue" />
              Aliases ({aliases.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600/50">
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Handle</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Platform</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">First Seen</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Last Seen</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Primary Indicator</th>
                </tr>
              </thead>
              <tbody>
                {aliases.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-dark-700/30 hover:bg-dark-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono text-cyber-blue text-xs">{a.handle}</td>
                    <td className="py-2.5 px-3">
                      {a.platform ? (
                        <span className="badge-info text-[10px]">{a.platform}</span>
                      ) : (
                        <span className="text-xs text-gray-600">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 text-xs">
                      {formatDate(a.first_seen)}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 text-xs">
                      {formatDate(a.last_seen)}
                    </td>
                    <td className="py-2.5 px-3">
                      {a.is_primary ? (
                        <span className="badge-critical text-[10px] flex items-center gap-1 w-fit">
                          <Crosshair className="w-3 h-3" />
                          Primary
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {aliases.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-gray-500">
                      No aliases recorded for this actor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PGP Keys Tab */}
      {activeTab === 'pgp_keys' && (
        <div className="glass-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Key className="w-4 h-4 text-cyber-blue" />
              PGP Keys ({pgp_keys.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600/50">
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Fingerprint</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Algorithm</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Key ID</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {pgp_keys.map((k) => (
                  <tr
                    key={k.id}
                    className="border-b border-dark-700/30 hover:bg-dark-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono text-xs text-gray-300 truncate max-w-[300px]">
                      {k.fingerprint}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="badge-info text-[10px]">{k.algorithm || 'RSA'}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-gray-400">
                      {k.key_id || 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-400">
                      {formatDate(k.creation_date)}
                    </td>
                  </tr>
                ))}
                {pgp_keys.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-gray-500">
                      No PGP keys recorded for this actor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Wallets Tab */}
      {activeTab === 'wallets' && (
        <div className="glass-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-cyber-blue" />
              Wallets ({wallets.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600/50">
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Address</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Currency</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Balance</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Transactions</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Label</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">First Seen</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w) => (
                  <tr
                    key={w.id}
                    className="border-b border-dark-700/30 hover:bg-dark-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono text-xs text-cyber-blue truncate max-w-[260px]">
                      {w.address}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="badge-info text-[10px] uppercase">{w.currency}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-gray-300">
                      {w.balance}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-gray-400">
                      {w.transaction_count}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-400">
                      {w.label || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-400">
                      {formatDate(w.first_seen)}
                    </td>
                  </tr>
                ))}
                {wallets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-gray-500">
                      No wallets recorded for this actor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Infrastructure Tab */}
      {activeTab === 'infrastructure' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card">
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyber-blue" />
              Domains ({domains.length})
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {domains.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-dark-800/40 border border-dark-700/20 hover:border-dark-600/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    <span className="font-mono text-xs text-gray-300 truncate">{d.domain}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {d.first_seen && (
                      <span className="text-[10px] text-gray-600">{formatDate(d.first_seen)}</span>
                    )}
                    {d.is_tor && <span className="badge-info text-[10px]">TOR</span>}
                  </div>
                </div>
              ))}
              {domains.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-6">No domains recorded.</p>
              )}
            </div>
          </div>

          <div className="glass-card">
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyber-blue" />
              IP Addresses ({ips.length})
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {ips.map((ip) => (
                <div
                  key={ip.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-dark-800/40 border border-dark-700/20 hover:border-dark-600/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    <span className="font-mono text-xs text-gray-300">{ip.ip_address}</span>
                    {ip.port && (
                      <span className="text-[10px] text-gray-600">:{ip.port}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {ip.asn && (
                      <span className="text-[10px] text-gray-500">{ip.asn}</span>
                    )}
                    {ip.country && (
                      <span className="text-[10px] text-gray-500">{ip.country}</span>
                    )}
                    {ip.is_tor && <span className="badge-info text-[10px]">TOR</span>}
                  </div>
                </div>
              ))}
              {ips.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-6">No IP addresses recorded.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Behavior Tab */}
      {activeTab === 'behavior' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card">
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyber-blue" />
              Behavioral Fingerprint
            </h3>
            {behavior_profile ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                  <span className="text-xs text-gray-500">Night Activity</span>
                  <div className="flex items-center gap-2">
                    <div className="confidence-bar w-16">
                      <div
                        className="confidence-fill"
                        style={{ width: `${behavior_profile.night_activity_pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono text-cyber-blue">
                      {behavior_profile.night_activity_pct}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                  <span className="text-xs text-gray-500">Weekend Activity</span>
                  <div className="flex items-center gap-2">
                    <div className="confidence-bar w-16">
                      <div
                        className="confidence-fill"
                        style={{ width: `${behavior_profile.weekend_activity_pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono text-cyber-blue">
                      {behavior_profile.weekend_activity_pct}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                  <span className="text-xs text-gray-500">Avg Posting Interval</span>
                  <span className="text-sm font-mono text-gray-300">
                    {behavior_profile.avg_posting_interval_hours}h
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                  <span className="text-xs text-gray-500">Posting Frequency</span>
                  <span className="text-sm font-mono text-gray-300">
                    {behavior_profile.posting_frequency}/day
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                  <span className="text-xs text-gray-500">Alias Migration</span>
                  <span
                    className={`badge-${behavior_profile.alias_migration_freq === 'HIGH' ? 'high' : behavior_profile.alias_migration_freq === 'MEDIUM' ? 'medium' : 'low'}`}
                  >
                    {behavior_profile.alias_migration_freq}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                  <span className="text-xs text-gray-500">Marketplace Activity</span>
                  <span className="text-sm text-gray-300">
                    {behavior_profile.marketplace_activity}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                  <span className="text-xs text-gray-500">Forum Activity</span>
                  <span className="text-sm text-gray-300">
                    {behavior_profile.forum_activity}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-500">Timezone Estimate</span>
                  <span className="text-sm font-mono text-gray-300">
                    {behavior_profile.timezone_estimate}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Brain className="w-10 h-10 text-gray-600 mb-3" />
                <p className="text-sm text-gray-500">
                  No behavioral profile available.
                </p>
                <p className="text-xs text-gray-600 mt-1">Run analysis first.</p>
              </div>
            )}
          </div>

          <div className="glass-card">
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyber-blue" />
              Behavioral Radar
            </h3>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#2e3352" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                  />
                  <PolarRadiusAxis tick={false} domain={[0, 100]} />
                  <Radar
                    dataKey="value"
                    stroke="#00d4ff"
                    fill="#00d4ff"
                    fillOpacity={0.2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
                No behavioral data available for radar chart.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stylometry Tab */}
      {activeTab === 'stylometry' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card">
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyber-blue" />
              Stylometric Profile
            </h3>
            {stylometric_profile ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                  <span className="text-xs text-gray-500">Avg Sentence Length</span>
                  <span className="text-sm font-mono text-gray-300">
                    {stylometric_profile.avg_sentence_length} words
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                  <span className="text-xs text-gray-500">Vocabulary Richness</span>
                  <div className="flex items-center gap-2">
                    <div className="confidence-bar w-16">
                      <div
                        className="confidence-fill"
                        style={{
                          width: `${stylometric_profile.vocabulary_richness * 100}%`,
                          background: '#00ff88',
                        }}
                      />
                    </div>
                    <span className="text-sm font-mono text-cyber-blue">
                      {(stylometric_profile.vocabulary_richness * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                  <span className="text-xs text-gray-500">Punctuation Ratio</span>
                  <span className="text-sm font-mono text-gray-300">
                    {(stylometric_profile.punctuation_ratio * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-dark-700/30">
                  <span className="text-xs text-gray-500">Avg Word Length</span>
                  <span className="text-sm font-mono text-gray-300">
                    {stylometric_profile.avg_word_length} chars
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-500">Sample Count</span>
                  <span className="text-sm font-mono text-gray-300">
                    {stylometric_profile.sample_count}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Activity className="w-10 h-10 text-gray-600 mb-3" />
                <p className="text-sm text-gray-500">No stylometric profile available.</p>
              </div>
            )}
          </div>

          <div className="glass-card">
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyber-blue" />
              Stylometric Radar
            </h3>
            {stylometryRadar.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={stylometryRadar}>
                  <PolarGrid stroke="#2e3352" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                  />
                  <PolarRadiusAxis tick={false} domain={[0, 100]} />
                  <Radar
                    dataKey="value"
                    stroke="#00ff88"
                    fill="#00ff88"
                    fillOpacity={0.2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
                No stylometric data available for radar chart.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attributions Tab */}
      {activeTab === 'attributions' && (
        <div className="glass-card">
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-cyber-blue" />
            Cross-Actor Correlations ({attributions.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600/50">
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Target Actor</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Confidence</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Level</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Alias</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">PGP</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Wallet</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Stylometry</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Behavior</th>
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-medium">Infra</th>
                </tr>
              </thead>
              <tbody>
                {attributions.map((attr) => (
                  <tr
                    key={attr.id}
                    className="border-b border-dark-700/30 hover:bg-dark-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <Link
                        href={`/actors/${attr.target_actor_id}`}
                        className="font-mono text-xs text-cyber-blue hover:underline flex items-center gap-1"
                      >
                        Actor #{attr.target_actor_id}
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="confidence-bar w-16">
                          <div
                            className="confidence-fill"
                            style={{
                              width: `${attr.overall_confidence * 100}%`,
                              background:
                                attr.overall_confidence >= 0.7 ? '#00ff88' : '#ffcc00',
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono text-gray-300">
                          {Math.round(attr.overall_confidence * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`badge-${attr.confidence_level === 'HIGH' || attr.confidence_level === 'VERY_HIGH' ? 'high' : 'medium'}`}
                      >
                        {attr.confidence_level}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs font-mono text-gray-300">
                      {Math.round(attr.alias_similarity * 100)}%
                    </td>
                    <td className="py-2.5 px-3 text-xs font-mono text-gray-300">
                      {Math.round(attr.pgp_match * 100)}%
                    </td>
                    <td className="py-2.5 px-3 text-xs font-mono text-gray-300">
                      {Math.round(attr.wallet_relationship * 100)}%
                    </td>
                    <td className="py-2.5 px-3 text-xs font-mono text-gray-300">
                      {Math.round(attr.stylometry_similarity * 100)}%
                    </td>
                    <td className="py-2.5 px-3 text-xs font-mono text-gray-300">
                      {Math.round(attr.behavior_similarity * 100)}%
                    </td>
                    <td className="py-2.5 px-3 text-xs font-mono text-gray-300">
                      {Math.round(attr.infrastructure_match * 100)}%
                    </td>
                  </tr>
                ))}
                {attributions.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-xs text-gray-500">
                      No attributions recorded for this actor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Evidence Tab */}
      {activeTab === 'evidence' && (
        <div className="glass-card">
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyber-blue" />
            Evidence Chain ({evidence.length})
          </h3>
          <div className="space-y-3">
            {evidence.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start gap-4 p-4 bg-dark-800/40 rounded-lg border border-dark-700/30 hover:border-dark-600/40 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-cyber-blue/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-cyber-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge-info text-[10px]">{ev.evidence_type}</span>
                    <span className="text-xs text-gray-500">#{ev.id}</span>
                    <div className="confidence-bar w-12">
                      <div
                        className="confidence-fill"
                        style={{
                          width: `${ev.confidence * 100}%`,
                          background: confidenceColor(ev.confidence),
                        }}
                      />
                    </div>
                    <span
                      className="text-[10px] font-mono"
                      style={{ color: confidenceColor(ev.confidence) }}
                    >
                      {Math.round(ev.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mt-1.5">{ev.description}</p>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    {ev.source && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        Source: <span className="text-gray-300">{ev.source}</span>
                      </span>
                    )}
                    {ev.created_at && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(ev.created_at)}
                      </span>
                    )}
                    {ev.evidence_hash && (
                      <span className="text-xs text-gray-500 font-mono">
                        Hash: {ev.evidence_hash.slice(0, 16)}...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {evidence.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <Shield className="w-10 h-10 text-gray-600 mb-3" />
                <p className="text-sm text-gray-500">No evidence recorded for this actor.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="glass-card">
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyber-blue" />
            Timeline Events
          </h3>
          {timelineLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-cyber-blue/30 border-t-cyber-blue rounded-full animate-spin" />
            </div>
          ) : timeline.length > 0 ? (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-dark-700/50" />
              <div className="space-y-4">
                {timeline
                  .sort(
                    (a, b) =>
                      new Date(b.event_date).getTime() -
                      new Date(a.event_date).getTime()
                  )
                  .map((event, idx) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-4 pl-2 relative"
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                          idx === 0
                            ? 'bg-cyber-blue/20 border border-cyber-blue/50'
                            : 'bg-dark-800 border border-dark-600/50'
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            idx === 0 ? 'bg-cyber-blue' : 'bg-gray-500'
                          }`}
                        />
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="badge-info text-[10px]">{event.event_type}</span>
                          <span className="text-xs text-gray-500 font-mono">
                            {formatDateTime(event.event_date)}
                          </span>
                          {event.source && (
                            <span className="text-[10px] text-gray-600">
                              via {event.source}
                            </span>
                          )}
                          <div className="confidence-bar w-10">
                            <div
                              className="confidence-fill"
                              style={{
                                width: `${event.confidence * 100}%`,
                                background: confidenceColor(event.confidence),
                              }}
                            />
                          </div>
                        </div>
                        <h4 className="text-sm text-gray-200 mt-1">{event.title}</h4>
                        {event.description && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Clock className="w-10 h-10 text-gray-600 mb-3" />
              <p className="text-sm text-gray-500">No timeline events available.</p>
              <p className="text-xs text-gray-600 mt-1">Events will appear as intelligence is gathered.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
