'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, ensureAuth } from '@/lib/api';
import { Search, Users, ArrowUpDown } from 'lucide-react';
import type { Actor } from '@/types';

export default function ActorsPage() {
  const [actors, setActors] = useState<Actor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [sortBy, setSortBy] = useState<'confidence' | 'name' | 'risk'>('confidence');

  useEffect(() => {
    ensureAuth().then(() => {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (riskFilter) params.set('risk_level', riskFilter);
      apiFetch<Actor[]>(`/api/v1/actors/?${params}`)
        .then(setActors)
        .catch(console.error)
        .finally(() => setLoading(false));
    });
  }, [search, riskFilter]);

  const sorted = [...actors].sort((a, b) => {
    if (sortBy === 'confidence') return b.confidence_score - a.confidence_score;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    const riskOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 };
    return (riskOrder[a.risk_level as keyof typeof riskOrder] || 4) - (riskOrder[b.risk_level as keyof typeof riskOrder] || 4);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 tracking-tight">Threat Actors</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor and investigate threat actor profiles</p>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-cyber-blue" />
          <span className="text-sm font-mono text-gray-400">{actors.length}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search actors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="input-field w-40"
        >
          <option value="">All Risk Levels</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <div className="flex items-center gap-1 bg-dark-800 rounded-lg border border-dark-600/50 p-0.5">
          {(['confidence', 'name', 'risk'] as const).map(s => (
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

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-cyber-blue/30 border-t-cyber-blue rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="glass-card text-center py-12">
          <p className="text-gray-500">No actors found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((actor) => (
            <Link
              key={actor.id}
              href={`/actors/${actor.id}`}
              className="glass-card hover:border-dark-500/50 transition-all duration-200 cursor-pointer group block"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-100 group-hover:text-cyber-blue transition-colors">
                    {actor.name}
                  </h3>
                  <p className="text-[10px] text-gray-600 font-mono mt-0.5">ID: {String(actor.id).padStart(3, '0')}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                  actor.risk_level === 'CRITICAL' ? 'bg-cyber-red/15 text-cyber-red border-cyber-red/25' :
                  actor.risk_level === 'HIGH' ? 'bg-cyber-orange/15 text-cyber-orange border-cyber-orange/25' :
                  actor.risk_level === 'MEDIUM' ? 'bg-cyber-yellow/15 text-cyber-yellow border-cyber-yellow/25' :
                  'bg-cyber-green/15 text-cyber-green border-cyber-green/25'
                }`}>
                  {actor.risk_level}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="text-center">
                  <div className="text-base font-bold font-mono text-cyber-blue">{actor.alias_count}</div>
                  <div className="text-[9px] text-gray-600 uppercase tracking-wider">Aliases</div>
                </div>
                <div className="text-center">
                  <div className="text-base font-bold font-mono text-cyber-green">{actor.pgp_count}</div>
                  <div className="text-[9px] text-gray-600 uppercase tracking-wider">PGP</div>
                </div>
                <div className="text-center">
                  <div className="text-base font-bold font-mono text-cyber-yellow">{actor.wallet_count}</div>
                  <div className="text-[9px] text-gray-600 uppercase tracking-wider">Wallets</div>
                </div>
                <div className="text-center">
                  <div className="text-base font-bold font-mono text-cyber-purple">{actor.post_count}</div>
                  <div className="text-[9px] text-gray-600 uppercase tracking-wider">Posts</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-600">Confidence</span>
                <div className="flex-1 h-1 rounded-full bg-dark-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${actor.confidence_score * 100}%`,
                      background: actor.confidence_score >= 0.7 ? '#00ff88' : actor.confidence_score >= 0.4 ? '#ffcc00' : '#ff3366',
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-gray-500 w-8 text-right">{Math.round(actor.confidence_score * 100)}%</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
