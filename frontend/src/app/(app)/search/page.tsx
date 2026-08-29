'use client';

import { useState, useMemo, useEffect } from 'react';
import { apiFetch, ensureAuth } from '@/lib/api';
import {
  Search as SearchIcon, Users, Tag, Key, Wallet, Globe, ChevronRight,
  Link2, Shield, ArrowRight
} from 'lucide-react';
import Link from 'next/link';

interface SearchResult {
  id: number;
  type: 'Actor' | 'Alias' | 'PGP' | 'Wallet' | 'Domain';
  name: string;
  actor_id?: number;
  platform?: string;
  confidence?: number;
  risk_level?: string;
  [key: string]: any;
}

const TYPE_CONFIG: Record<string, { icon: typeof Users; color: string; bg: string; border: string }> = {
  Actor:  { icon: Users,  color: 'text-cyber-blue',   bg: 'bg-cyber-blue/10',   border: 'border-cyber-blue/20' },
  Alias:  { icon: Tag,    color: 'text-cyber-cyan',   bg: 'bg-cyber-cyan/10',   border: 'border-cyber-cyan/20' },
  PGP:    { icon: Key,    color: 'text-cyber-green',   bg: 'bg-cyber-green/10',  border: 'border-cyber-green/20' },
  Wallet: { icon: Wallet, color: 'text-cyber-yellow',  bg: 'bg-cyber-yellow/10', border: 'border-cyber-yellow/20' },
  Domain: { icon: Globe,  color: 'text-cyber-purple',  bg: 'bg-cyber-purple/10', border: 'border-cyber-purple/20' },
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => { ensureAuth(); }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    await ensureAuth();
    setLoading(true);
    setSearched(true);
    try {
      const data = await apiFetch<SearchResult[]>(`/api/v1/intelligence/search?q=${encodeURIComponent(query)}`);
      setResults(data);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const list = map.get(r.type) || [];
      list.push(r);
      map.set(r.type, list);
    }
    return Array.from(map.entries());
  }, [results]);

  const totalCount = results.length;

  return (
    <div className="space-y-6 pb-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-100 tracking-tight">Global Search</h1>
          {totalCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/20 uppercase tracking-wider">
              {totalCount} result{totalCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">Search across all actors, aliases, PGP keys, wallets, and domains</p>
      </div>

      {/* ── Search Input ── */}
      <div className="glass-card">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search actors, aliases, PGP fingerprints, wallets, domains..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="input-field pl-12 py-3 text-base"
              autoFocus
            />
          </div>
          <button onClick={handleSearch} disabled={loading || !query.trim()} className="btn-primary py-3 px-6">
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-cyber-blue/30 border-t-cyber-blue rounded-full animate-spin" />
                Searching
              </span>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-cyber-blue/30 border-t-cyber-blue rounded-full animate-spin" />
            <p className="text-xs text-gray-500">Querying intelligence database...</p>
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && searched && totalCount === 0 && (
        <div className="glass-card text-center py-12">
          <SearchIcon className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400">No results found for &quot;{query}&quot;</p>
          <p className="text-xs text-gray-600 mt-1">Try a different search term or check spelling</p>
        </div>
      )}

      {/* ── Initial State ── */}
      {!loading && !searched && (
        <div className="glass-card text-center py-16">
          <div className="w-14 h-14 rounded-full bg-dark-700/50 border border-dark-600/30 flex items-center justify-center mx-auto mb-4">
            <SearchIcon className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-sm text-gray-400">Enter a search query to find threat intelligence</p>
          <p className="text-xs text-gray-600 mt-1">Search by actor name, alias, PGP fingerprint, wallet address, or domain</p>
        </div>
      )}

      {/* ── Results Grouped by Type ── */}
      {!loading && grouped.length > 0 && (
        <div className="space-y-6">
          {grouped.map(([type, items]) => {
            const config = TYPE_CONFIG[type] || { icon: Shield, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' };
            const Icon = config.icon;
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-lg ${config.bg} border ${config.border} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                  </div>
                  <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">{type}</h2>
                  <span className="text-[10px] font-mono text-gray-600">{items.length}</span>
                </div>

                <div className="space-y-2">
                  {items.map((r) => {
                    const itemConfig = TYPE_CONFIG[r.type] || { icon: Shield, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' };
                    const ItemIcon = itemConfig.icon;
                    const href = r.type === 'Actor'
                      ? `/actors/${r.id}`
                      : r.actor_id
                        ? `/actors/${r.actor_id}`
                        : '#';

                    return (
                      <Link
                        key={`${r.type}-${r.id}`}
                        href={href}
                        className="glass-card flex items-center gap-4 hover:border-dark-500/50 transition-all duration-200 cursor-pointer group"
                      >
                        <div className={`w-10 h-10 rounded-lg ${itemConfig.bg} border ${itemConfig.border} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                          <ItemIcon className={`w-4.5 h-4.5 ${itemConfig.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${itemConfig.bg} ${itemConfig.color} border ${itemConfig.border}`}>
                              {r.type}
                            </span>
                            <span className="text-sm font-medium text-gray-200 truncate group-hover:text-cyber-blue transition-colors">
                              {r.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {r.platform && (
                              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                                <Globe className="w-3 h-3" />
                                {r.platform}
                              </span>
                            )}
                            {r.actor_id && r.type !== 'Actor' && (
                              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                Actor #{r.actor_id}
                              </span>
                            )}
                            {r.confidence != null && (
                              <span className="text-[11px] text-gray-500">
                                Confidence: <span className="font-mono text-gray-400">{Math.round(r.confidence * 100)}%</span>
                              </span>
                            )}
                            {r.risk_level && (
                              <span className={`text-[10px] font-medium uppercase ${
                                r.risk_level === 'critical' ? 'text-cyber-red' :
                                r.risk_level === 'high' ? 'text-cyber-orange' :
                                r.risk_level === 'medium' ? 'text-cyber-yellow' :
                                'text-cyber-green'
                              }`}>
                                {r.risk_level}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-gray-600 group-hover:text-gray-400 transition-colors hidden sm:inline">View</span>
                          <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-cyber-blue group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Disclaimer ── */}
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
