'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch, ensureAuth } from '@/lib/api';
import type { Actor } from '@/types';
import {
  FileText, Download, Printer, Search, AlertTriangle, CheckCircle,
  User, Shield, Clock, Globe, Key, Wallet, Activity, Brain, Link2,
  Eye, ChevronDown,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ReportData {
  report: Record<string, any>;
  content?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function confidenceColor(score: number): string {
  if (score >= 0.8) return '#00ff88';
  if (score >= 0.6) return '#00d4ff';
  if (score >= 0.4) return '#ffcc00';
  return '#ff3366';
}

function confidenceLabel(score: number): string {
  if (score >= 0.8) return 'Very High';
  if (score >= 0.6) return 'High';
  if (score >= 0.4) return 'Medium';
  if (score >= 0.2) return 'Low';
  return 'Very Low';
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return dateStr.split('T')[0];
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */

export default function ReportsPage() {
  /* ---- state ---- */
  const [actors, setActors] = useState<Actor[]>([]);
  const [selectedActorId, setSelectedActorId] = useState<number | ''>('');
  const [format, setFormat] = useState('json');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingActors, setLoadingActors] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actorSearch, setActorSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  /* ---- fetch actors ---- */
  useEffect(() => {
    ensureAuth().then(() => {
      apiFetch<Actor[]>('/api/v1/actors/?limit=100')
        .then(setActors)
        .catch(console.error)
        .finally(() => setLoadingActors(false));
    });
  }, []);

  /* ---- filtered actors for dropdown ---- */
  const filteredActors = actors.filter((a) =>
    a.name.toLowerCase().includes(actorSearch.toLowerCase()) ||
    a.id.toString().includes(actorSearch)
  );

  const selectedActor = actors.find((a) => a.id === selectedActorId);

  /* ---- generate ---- */
  const generateReport = async () => {
    if (!selectedActorId) return;
    await ensureAuth();
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const result = await apiFetch<ReportData>('/api/v1/intelligence/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor_id: Number(selectedActorId), format }),
      });
      setReport(result);
    } catch (e: any) {
      setError(e.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  /* ---- download ---- */
  const downloadReport = useCallback(() => {
    if (!report) return;
    const content = format === 'csv' ? report.content : JSON.stringify(report.report, null, 2);
    const blob = new Blob([content || ''], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `darktrace-report-${selectedActorId}.${format === 'csv' ? 'csv' : 'json'}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report, format, selectedActorId]);

  /* ---- print ---- */
  const printReport = useCallback(() => {
    window.print();
  }, []);

  /* ---- pull data from report.report ---- */
  const r = report?.report as Record<string, any> | undefined;
  const execSummary = r?.executive_summary ?? {};
  const aliases = r?.aliases ?? [];
  const behaviorProfile = r?.behavior_profile ?? null;
  const stylometricProfile = r?.stylometric_profile ?? null;
  const domains = r?.domains ?? [];
  const ips = r?.ips ?? [];
  const relationships = r?.relationships ?? r?.attributions ?? [];
  const evidenceChain = r?.evidence_chain ?? r?.evidence ?? [];
  const attributionAssessment = r?.attribution_assessment ?? null;
  const confidenceAssessment = r?.confidence_assessment ?? null;
  const timeline = r?.timeline ?? [];
  const limitations = r?.limitations ?? [];

  const totalCount = (execSummary.total_aliases ?? 0)
    + (execSummary.total_pgps ?? 0)
    + (execSummary.total_wallets ?? 0)
    + (execSummary.total_domains ?? 0)
    + (execSummary.total_posts ?? 0);

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="space-y-6 pb-8 print:pb-0 print:space-y-0">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-100 tracking-tight">Report Generation</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/20 uppercase tracking-wider">
              Intel Report
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Generate professional investigation reports with full actor intelligence
          </p>
        </div>
        {report && (
          <div className="flex items-center gap-2">
            <button onClick={printReport} className="btn-secondary flex items-center gap-2">
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button onClick={downloadReport} className="btn-primary flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download {format.toUpperCase()}
            </button>
          </div>
        )}
      </div>

      {/* ── Generation Form ──────────────────────────────────────── */}
      <div className="glass-card print:hidden">
        <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyber-blue" />
          Generate Investigation Report
        </h3>
        <div className="flex flex-col sm:flex-row items-end gap-4">
          {/* Actor selector */}
          <div className="flex-1 min-w-[280px] relative">
            <label className="text-xs text-gray-500 block mb-1">Select Actor</label>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="input-field w-full flex items-center justify-between text-left"
            >
              <span className={selectedActor ? 'text-gray-100' : 'text-gray-500'}>
                {selectedActor
                  ? `${selectedActor.name} (ID: ${selectedActor.id})`
                  : loadingActors
                    ? 'Loading actors...'
                    : 'Search or select an actor...'}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-xl max-h-80 overflow-hidden">
                <div className="p-2 border-b border-dark-700/50">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search by name or ID..."
                      value={actorSearch}
                      onChange={(e) => setActorSearch(e.target.value)}
                      className="input-field pl-8 py-1.5 text-xs"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="overflow-y-auto max-h-60">
                  {filteredActors.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500">No actors found</div>
                  ) : (
                    filteredActors.map((actor) => (
                      <button
                        key={actor.id}
                        onClick={() => {
                          setSelectedActorId(actor.id);
                          setDropdownOpen(false);
                          setActorSearch('');
                        }}
                        className={`w-full text-left px-3 py-2.5 hover:bg-dark-700/50 transition-colors flex items-center justify-between ${
                          selectedActorId === actor.id ? 'bg-dark-700/70 border-l-2 border-cyber-blue' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                          <span className="text-sm text-gray-200 truncate">{actor.name}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] font-medium uppercase ${
                            actor.risk_level?.toUpperCase() === 'CRITICAL' ? 'text-cyber-red' :
                            actor.risk_level?.toUpperCase() === 'HIGH' ? 'text-cyber-orange' :
                            actor.risk_level?.toUpperCase() === 'MEDIUM' ? 'text-cyber-yellow' :
                            'text-cyber-green'
                          }`}>
                            {actor.risk_level}
                          </span>
                          <span className="text-[10px] font-mono text-gray-500">#{actor.id}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Format */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="input-field w-32"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
          </div>

          {/* Generate */}
          <button
            onClick={generateReport}
            disabled={loading || !selectedActorId}
            className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-cyber-blue/30 border-t-cyber-blue rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Generate Report
              </>
            )}
          </button>
        </div>
        {error && (
          <div className="mt-3 p-3 rounded-lg bg-cyber-red/10 border border-cyber-red/20 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-cyber-red flex-shrink-0" />
            <span className="text-sm text-cyber-red">{error}</span>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/*  REPORT OUTPUT                                                   */}
      {/* ================================================================ */}
      {report && r && (
        <div className="space-y-6 print:space-y-0">
          {/* ── Classification Banner ── */}
          <div className="hidden print:block text-center border-y border-gray-300 py-2 mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-600">
              DarkTrace Nexus &mdash; Confidential Threat Intelligence Report
            </span>
          </div>

          {/* ── Executive Summary ─────────────────────────────────── */}
          <div className="glass-card print:bg-white print:border print:border-gray-300 print:shadow-none">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-cyber-blue print:text-blue-600" />
              <h3 className="text-sm font-medium text-gray-300 print:text-gray-900 uppercase tracking-wider">
                Executive Summary
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="p-3 rounded-lg bg-dark-800/60 border border-dark-700/30 print:bg-gray-50 print:border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Actor</span>
                <div className="text-sm text-gray-200 font-medium print:text-gray-900 mt-1 truncate">
                  {execSummary.actor_name || execSummary.name || selectedActor?.name || `Actor #${selectedActorId}`}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-dark-800/60 border border-dark-700/30 print:bg-gray-50 print:border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Risk Level</span>
                <div className="mt-1">
                  <span className={riskBadgeClass(execSummary.risk_level || 'unknown')}>
                    {execSummary.risk_level || 'Unknown'}
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-dark-800/60 border border-dark-700/30 print:bg-gray-50 print:border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Confidence</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 rounded-full bg-dark-700 print:bg-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(execSummary.confidence_score ?? 0) * 100}%`,
                        background: confidenceColor(execSummary.confidence_score ?? 0),
                      }}
                    />
                  </div>
                  <span
                    className="text-sm font-mono print:text-gray-900"
                    style={{ color: confidenceColor(execSummary.confidence_score ?? 0) }}
                  >
                    {Math.round((execSummary.confidence_score ?? 0) * 100)}%
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-dark-800/60 border border-dark-700/30 print:bg-gray-50 print:border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block">First Seen</span>
                <div className="text-sm text-gray-300 font-mono print:text-gray-900 mt-1">
                  {formatDate(execSummary.first_seen)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-dark-800/60 border border-dark-700/30 print:bg-gray-50 print:border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Last Seen</span>
                <div className="text-sm text-gray-300 font-mono print:text-gray-900 mt-1">
                  {formatDate(execSummary.last_seen)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-dark-800/60 border border-dark-700/30 print:bg-gray-50 print:border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Total Entities</span>
                <div className="text-sm text-gray-200 font-mono print:text-gray-900 mt-1">
                  {totalCount}
                </div>
              </div>
            </div>
            {execSummary.description && (
              <p className="text-sm text-gray-400 print:text-gray-700 mt-4 leading-relaxed">
                {execSummary.description}
              </p>
            )}
          </div>

          {/* ── Investigation Scope ───────────────────────────────── */}
          {(r.investigation_scope || execSummary.investigation_scope) && (
            <div className="glass-card print:bg-white print:border print:border-gray-300 print:shadow-none">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-4 h-4 text-cyber-blue print:text-blue-600" />
                <h3 className="text-sm font-medium text-gray-300 print:text-gray-900 uppercase tracking-wider">
                  Investigation Scope
                </h3>
              </div>
              <div className="text-sm text-gray-400 print:text-gray-700 leading-relaxed">
                {typeof (r.investigation_scope || execSummary.investigation_scope) === 'string'
                  ? (r.investigation_scope || execSummary.investigation_scope)
                  : JSON.stringify(r.investigation_scope || execSummary.investigation_scope, null, 2)}
              </div>
            </div>
          )}

          {/* ── Actor Profile ─────────────────────────────────────── */}
          <div className="glass-card print:bg-white print:border print:border-gray-300 print:shadow-none">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-cyber-blue print:text-blue-600" />
              <h3 className="text-sm font-medium text-gray-300 print:text-gray-900 uppercase tracking-wider">
                Actor Profile
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Identity */}
              <div className="space-y-3">
                <h4 className="text-xs text-gray-500 uppercase tracking-wider font-medium">Identity</h4>
                <div className="space-y-2">
                  <div className="flex justify-between py-1.5 border-b border-dark-700/30 print:border-gray-200">
                    <span className="text-xs text-gray-500">Primary Name</span>
                    <span className="text-sm font-mono text-gray-200 print:text-gray-900">
                      {execSummary.actor_name || execSummary.name || selectedActor?.name || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-dark-700/30 print:border-gray-200">
                    <span className="text-xs text-gray-500">Actor ID</span>
                    <span className="text-sm font-mono text-gray-200 print:text-gray-900">
                      #{execSummary.actor_id ?? selectedActorId}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-dark-700/30 print:border-gray-200">
                    <span className="text-xs text-gray-500">Risk Classification</span>
                    <span className={riskBadgeClass(execSummary.risk_level || 'unknown')}>
                      {execSummary.risk_level || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-dark-700/30 print:border-gray-200">
                    <span className="text-xs text-gray-500">Active Status</span>
                    <span className={`text-sm font-mono ${selectedActor?.is_active ? 'text-cyber-green print:text-green-600' : 'text-gray-500 print:text-gray-400'}`}>
                      {selectedActor?.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Activity Window */}
              <div className="space-y-3">
                <h4 className="text-xs text-gray-500 uppercase tracking-wider font-medium">Activity Window</h4>
                <div className="space-y-2">
                  <div className="flex justify-between py-1.5 border-b border-dark-700/30 print:border-gray-200">
                    <span className="text-xs text-gray-500">First Observed</span>
                    <span className="text-sm font-mono text-gray-200 print:text-gray-900">
                      {formatDate(execSummary.first_seen)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-dark-700/30 print:border-gray-200">
                    <span className="text-xs text-gray-500">Last Observed</span>
                    <span className="text-sm font-mono text-gray-200 print:text-gray-900">
                      {formatDate(execSummary.last_seen)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-dark-700/30 print:border-gray-200">
                    <span className="text-xs text-gray-500">Report Generated</span>
                    <span className="text-sm font-mono text-gray-200 print:text-gray-900">
                      {formatDateTime(execSummary.report_date || new Date().toISOString())}
                    </span>
                  </div>
                </div>
              </div>

              {/* Entity Counts */}
              <div className="space-y-3">
                <h4 className="text-xs text-gray-500 uppercase tracking-wider font-medium">Entity Summary</h4>
                <div className="space-y-2">
                  {[
                    { label: 'Aliases', value: execSummary.total_aliases ?? aliases.length, icon: User },
                    { label: 'PGP Keys', value: execSummary.total_pgps ?? 0, icon: Key },
                    { label: 'Wallets', value: execSummary.total_wallets ?? 0, icon: Wallet },
                    { label: 'Domains', value: execSummary.total_domains ?? domains.length, icon: Globe },
                    { label: 'IP Addresses', value: execSummary.total_ips ?? ips.length, icon: Globe },
                    { label: 'Posts', value: execSummary.total_posts ?? 0, icon: FileText },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-dark-700/30 print:border-gray-200">
                      <div className="flex items-center gap-2">
                        <item.icon className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-500">{item.label}</span>
                      </div>
                      <span className="text-sm font-mono text-gray-200 print:text-gray-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Alias Analysis ────────────────────────────────────── */}
          {aliases.length > 0 && (
            <div className="glass-card print:bg-white print:border print:border-gray-300 print:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-cyber-blue print:text-blue-600" />
                  <h3 className="text-sm font-medium text-gray-300 print:text-gray-900 uppercase tracking-wider">
                    Alias Analysis
                  </h3>
                </div>
                <span className="badge-info text-[10px]">{aliases.length} aliases</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-600/50 print:border-gray-300">
                      <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">Handle</th>
                      <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">Platform</th>
                      <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">First Seen</th>
                      <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">Last Seen</th>
                      <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">Primary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aliases.map((alias: any, i: number) => (
                      <tr
                        key={alias.id || i}
                        className="border-b border-dark-700/30 print:border-gray-200 hover:bg-dark-800/30 print:hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2 px-3 font-mono text-xs text-cyber-blue print:text-blue-700">
                          {alias.handle}
                        </td>
                        <td className="py-2 px-3">
                          {alias.platform ? (
                            <span className="badge-info text-[10px]">{alias.platform}</span>
                          ) : (
                            <span className="text-xs text-gray-600">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-400 print:text-gray-600">
                          {formatDate(alias.first_seen)}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-400 print:text-gray-600">
                          {formatDate(alias.last_seen)}
                        </td>
                        <td className="py-2 px-3">
                          {alias.is_primary ? (
                            <span className="badge-critical text-[10px] flex items-center gap-1 w-fit">
                              <CheckCircle className="w-3 h-3" />
                              Primary
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Behavioral Analysis ───────────────────────────────── */}
          {behaviorProfile && (
            <div className="glass-card print:bg-white print:border print:border-gray-300 print:shadow-none">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4 text-cyber-blue print:text-blue-600" />
                <h3 className="text-sm font-medium text-gray-300 print:text-gray-900 uppercase tracking-wider">
                  Behavioral Analysis
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  {[
                    { label: 'Night Activity', value: `${behaviorProfile.night_activity_pct}%`, bar: behaviorProfile.night_activity_pct },
                    { label: 'Weekend Activity', value: `${behaviorProfile.weekend_activity_pct}%`, bar: behaviorProfile.weekend_activity_pct },
                    { label: 'Posting Frequency', value: `${behaviorProfile.posting_frequency}/day`, bar: Math.min(behaviorProfile.posting_frequency * 20, 100) },
                    { label: 'Avg Posting Interval', value: `${behaviorProfile.avg_posting_interval_hours}h`, bar: null },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-dark-700/30 print:border-gray-200">
                      <span className="text-xs text-gray-500">{item.label}</span>
                      <div className="flex items-center gap-2">
                        {item.bar !== null && (
                          <div className="w-16 h-1.5 rounded-full bg-dark-700 print:bg-gray-200 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${item.bar}%`, background: '#00d4ff' }}
                            />
                          </div>
                        )}
                        <span className="text-sm font-mono text-gray-300 print:text-gray-900">{item.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Alias Migration', value: behaviorProfile.alias_migration_freq },
                    { label: 'Marketplace Activity', value: behaviorProfile.marketplace_activity },
                    { label: 'Forum Activity', value: behaviorProfile.forum_activity },
                    { label: 'Timezone Estimate', value: behaviorProfile.timezone_estimate },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-dark-700/30 print:border-gray-200">
                      <span className="text-xs text-gray-500">{item.label}</span>
                      <span className={`text-sm font-mono print:text-gray-900 ${
                        item.value === 'HIGH'
                          ? 'text-cyber-orange print:text-orange-600'
                          : item.value === 'MEDIUM'
                            ? 'text-cyber-yellow print:text-yellow-600'
                            : 'text-gray-300'
                      }`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Stylometric Analysis ──────────────────────────────── */}
          {stylometricProfile && (
            <div className="glass-card print:bg-white print:border print:border-gray-300 print:shadow-none">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-cyber-blue print:text-blue-600" />
                <h3 className="text-sm font-medium text-gray-300 print:text-gray-900 uppercase tracking-wider">
                  Stylometric Analysis
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Avg Sentence Length', value: `${stylometricProfile.avg_sentence_length} words`, color: '#00d4ff' },
                  { label: 'Vocabulary Richness', value: `${(stylometricProfile.vocabulary_richness * 100).toFixed(1)}%`, color: '#00ff88', bar: stylometricProfile.vocabulary_richness * 100 },
                  { label: 'Punctuation Ratio', value: `${(stylometricProfile.punctuation_ratio * 100).toFixed(2)}%`, color: '#ff8800' },
                  { label: 'Avg Word Length', value: `${stylometricProfile.avg_word_length} chars`, color: '#8855ff' },
                  { label: 'Sample Count', value: `${stylometricProfile.sample_count}`, color: '#ffcc00' },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-lg bg-dark-800/60 border border-dark-700/30 print:bg-gray-50 print:border-gray-200">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider block">{item.label}</span>
                    <div className="text-sm font-mono text-gray-200 print:text-gray-900 mt-1" style={{ color: item.color }}>
                      {item.value}
                    </div>
                    {item.bar !== undefined && (
                      <div className="w-full h-1.5 rounded-full bg-dark-700 print:bg-gray-200 overflow-hidden mt-2">
                        <div className="h-full rounded-full" style={{ width: `${item.bar}%`, background: item.color }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Infrastructure Analysis ────────────────────────────── */}
          <div className="glass-card print:bg-white print:border print:border-gray-300 print:shadow-none">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-cyber-blue print:text-blue-600" />
              <h3 className="text-sm font-medium text-gray-300 print:text-gray-900 uppercase tracking-wider">
                Infrastructure Analysis
              </h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Domains */}
              <div>
                <h4 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3 flex items-center gap-2">
                  <Globe className="w-3 h-3" />
                  Domains ({domains.length})
                </h4>
                {domains.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {domains.map((d: any, i: number) => (
                      <div
                        key={d.id || i}
                        className="flex items-center justify-between py-1.5 px-2 rounded bg-dark-800/40 print:bg-gray-50 border border-dark-700/20 print:border-gray-200"
                      >
                        <span className="font-mono text-xs text-gray-300 print:text-gray-700 truncate">{d.domain}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {d.is_tor && <span className="badge-info text-[10px]">TOR</span>}
                          {d.first_seen && <span className="text-[10px] text-gray-600">{formatDate(d.first_seen)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 print:text-gray-400">No domains recorded.</p>
                )}
              </div>

              {/* IPs */}
              <div>
                <h4 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3 flex items-center gap-2">
                  <Globe className="w-3 h-3" />
                  IP Addresses ({ips.length})
                </h4>
                {ips.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {ips.map((ip: any, i: number) => (
                      <div
                        key={ip.id || i}
                        className="flex items-center justify-between py-1.5 px-2 rounded bg-dark-800/40 print:bg-gray-50 border border-dark-700/20 print:border-gray-200"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs text-gray-300 print:text-gray-700">{ip.ip_address}</span>
                          {ip.port && <span className="text-[10px] text-gray-600">:{ip.port}</span>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {ip.asn && <span className="text-[10px] text-gray-500">{ip.asn}</span>}
                          {ip.country && <span className="text-[10px] text-gray-500">{ip.country}</span>}
                          {ip.is_tor && <span className="badge-info text-[10px]">TOR</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 print:text-gray-400">No IP addresses recorded.</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Relationship Analysis ──────────────────────────────── */}
          {relationships.length > 0 && (
            <div className="glass-card print:bg-white print:border print:border-gray-300 print:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-cyber-blue print:text-blue-600" />
                  <h3 className="text-sm font-medium text-gray-300 print:text-gray-900 uppercase tracking-wider">
                    Relationship Analysis
                  </h3>
                </div>
                <span className="badge-info text-[10px]">{relationships.length} attributions</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-600/50 print:border-gray-300">
                      <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">Target Actor</th>
                      <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">Confidence</th>
                      <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">Level</th>
                      <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">Alias</th>
                      <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">PGP</th>
                      <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">Wallet</th>
                      <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">Stylometry</th>
                      <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">Behavior</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relationships.map((attr: any, i: number) => (
                      <tr
                        key={attr.id || i}
                        className="border-b border-dark-700/30 print:border-gray-200 hover:bg-dark-800/30 print:hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2 px-3 font-mono text-xs text-cyber-blue print:text-blue-700">
                          Actor #{attr.target_actor_id}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-dark-700 print:bg-gray-200 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${attr.overall_confidence * 100}%`,
                                  background: confidenceColor(attr.overall_confidence),
                                }}
                              />
                            </div>
                            <span className="text-xs font-mono text-gray-400 print:text-gray-600">
                              {Math.round(attr.overall_confidence * 100)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`badge-info text-[10px]`}>{attr.confidence_level}</span>
                        </td>
                        <td className="py-2 px-3 text-xs font-mono text-gray-400 print:text-gray-600">
                          {Math.round(attr.alias_similarity * 100)}%
                        </td>
                        <td className="py-2 px-3 text-xs font-mono text-gray-400 print:text-gray-600">
                          {Math.round(attr.pgp_match * 100)}%
                        </td>
                        <td className="py-2 px-3 text-xs font-mono text-gray-400 print:text-gray-600">
                          {Math.round(attr.wallet_relationship * 100)}%
                        </td>
                        <td className="py-2 px-3 text-xs font-mono text-gray-400 print:text-gray-600">
                          {Math.round(attr.stylometry_similarity * 100)}%
                        </td>
                        <td className="py-2 px-3 text-xs font-mono text-gray-400 print:text-gray-600">
                          {Math.round(attr.behavior_similarity * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Evidence Chain ────────────────────────────────────── */}
          {evidenceChain.length > 0 && (
            <div className="glass-card print:bg-white print:border print:border-gray-300 print:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyber-blue print:text-blue-600" />
                  <h3 className="text-sm font-medium text-gray-300 print:text-gray-900 uppercase tracking-wider">
                    Evidence Chain
                  </h3>
                </div>
                <span className="badge-info text-[10px]">{evidenceChain.length} items</span>
              </div>
              <div className="space-y-3">
                {evidenceChain.map((ev: any, i: number) => (
                  <div
                    key={ev.id || i}
                    className="flex items-start gap-4 p-4 bg-dark-800/40 print:bg-gray-50 rounded-lg border border-dark-700/30 print:border-gray-200 hover:border-dark-600/40 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-cyber-blue/10 print:bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-4 h-4 text-cyber-blue print:text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge-info text-[10px]">{ev.evidence_type || ev.type}</span>
                        <div className="flex items-center gap-1">
                          <div className="w-10 h-1.5 rounded-full bg-dark-700 print:bg-gray-200 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(ev.confidence ?? 0) * 100}%`,
                                background: confidenceColor(ev.confidence ?? 0),
                              }}
                            />
                          </div>
                          <span
                            className="text-[10px] font-mono"
                            style={{ color: confidenceColor(ev.confidence ?? 0) }}
                          >
                            {Math.round((ev.confidence ?? 0) * 100)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-300 print:text-gray-700 mt-1.5">{ev.description}</p>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {ev.source && (
                          <span className="text-xs text-gray-500 print:text-gray-600 flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            Source: <span className="text-gray-400 print:text-gray-700">{ev.source}</span>
                          </span>
                        )}
                        {ev.created_at && (
                          <span className="text-xs text-gray-500 print:text-gray-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(ev.created_at)}
                          </span>
                        )}
                        {ev.evidence_hash && (
                          <span className="text-xs text-gray-500 font-mono hidden md:inline">
                            Hash: {ev.evidence_hash.slice(0, 16)}...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Attribution Assessment ─────────────────────────────── */}
          {attributionAssessment && (
            <div className="glass-card print:bg-white print:border print:border-gray-300 print:shadow-none">
              <div className="flex items-center gap-2 mb-4">
                <Link2 className="w-4 h-4 text-cyber-blue print:text-blue-600" />
                <h3 className="text-sm font-medium text-gray-300 print:text-gray-900 uppercase tracking-wider">
                  Attribution Assessment
                </h3>
              </div>
              <div className="text-sm text-gray-400 print:text-gray-700 leading-relaxed whitespace-pre-wrap">
                {typeof attributionAssessment === 'string'
                  ? attributionAssessment
                  : JSON.stringify(attributionAssessment, null, 2)}
              </div>
            </div>
          )}

          {/* ── Confidence Assessment ──────────────────────────────── */}
          {confidenceAssessment && (
            <div className="glass-card print:bg-white print:border print:border-gray-300 print:shadow-none">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-cyber-yellow print:text-yellow-600" />
                <h3 className="text-sm font-medium text-gray-300 print:text-gray-900 uppercase tracking-wider">
                  Confidence Assessment
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {typeof confidenceAssessment === 'object' && !Array.isArray(confidenceAssessment) ? (
                  Object.entries(confidenceAssessment).map(([key, value]) => (
                    <div key={key} className="py-2 border-b border-dark-700/30 print:border-gray-200">
                      <span className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
                        {key.replace(/_/g, ' ')}
                      </span>
                      {typeof value === 'number' && value <= 1 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-dark-700 print:bg-gray-200 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${value * 100}%`,
                                background: confidenceColor(value),
                              }}
                            />
                          </div>
                          <span className="text-sm font-mono print:text-gray-900" style={{ color: confidenceColor(value) }}>
                            {Math.round(value * 100)}% &mdash; {confidenceLabel(value)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-300 print:text-gray-700">{String(value)}</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 text-sm text-gray-400 print:text-gray-700 whitespace-pre-wrap">
                    {typeof confidenceAssessment === 'string'
                      ? confidenceAssessment
                      : JSON.stringify(confidenceAssessment, null, 2)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Timeline ──────────────────────────────────────────── */}
          {timeline.length > 0 && (
            <div className="glass-card print:bg-white print:border print:border-gray-300 print:shadow-none">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-cyber-blue print:text-blue-600" />
                <h3 className="text-sm font-medium text-gray-300 print:text-gray-900 uppercase tracking-wider">
                  Timeline
                </h3>
              </div>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-dark-700/50 print:bg-gray-300" />
                <div className="space-y-4">
                  {timeline
                    .sort((a: any, b: any) => new Date(b.event_date || b.date || 0).getTime() - new Date(a.event_date || a.date || 0).getTime())
                    .map((event: any, idx: number) => (
                      <div key={event.id || idx} className="flex items-start gap-4 pl-2 relative">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                            idx === 0
                              ? 'bg-cyber-blue/20 print:bg-blue-100 border border-cyber-blue/50 print:border-blue-400'
                              : 'bg-dark-800 print:bg-gray-100 border border-dark-600/50 print:border-gray-300'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-cyber-blue print:bg-blue-600' : 'bg-gray-500 print:bg-gray-400'}`} />
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="badge-info text-[10px]">{event.event_type || event.type}</span>
                            <span className="text-xs text-gray-500 print:text-gray-600 font-mono">
                              {formatDateTime(event.event_date || event.date)}
                            </span>
                            {event.source && (
                              <span className="text-[10px] text-gray-600">via {event.source}</span>
                            )}
                          </div>
                          <h4 className="text-sm text-gray-200 print:text-gray-900 mt-1">{event.title}</h4>
                          {event.description && (
                            <p className="text-xs text-gray-400 print:text-gray-600 mt-0.5">{event.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Limitations ───────────────────────────────────────── */}
          {limitations.length > 0 && (
            <div className="glass-card print:bg-white print:border print:border-gray-300 print:shadow-none">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-cyber-orange print:text-orange-600" />
                <h3 className="text-sm font-medium text-gray-300 print:text-gray-900 uppercase tracking-wider">
                  Limitations & Disclaimers
                </h3>
              </div>
              <ul className="space-y-2">
                {limitations.map((l: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-400 print:text-gray-600">
                    <span className="text-cyber-orange print:text-orange-500 mt-0.5">•</span>
                    <span className="leading-relaxed">{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Report Footer ─────────────────────────────────────── */}
          <div className="glass-card border-dashed border-dark-600/40 print:border-gray-300">
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-gray-600 print:text-gray-400 mt-0.5 shrink-0" />
              <div className="text-[11px] text-gray-600 print:text-gray-500 leading-relaxed">
                <p>
                  DarkTrace Nexus is a defensive cyber-threat intelligence research platform. Attribution represents analytical correlation, not definitive identity determination.
                </p>
                <p className="mt-2 font-mono text-[10px]">
                  Report generated: {new Date().toISOString()} | Platform: DarkTrace Nexus SIH26151 | Actor: #{selectedActorId}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty State ────────────────────────────────────────────── */}
      {!report && !loading && !error && (
        <div className="glass-card flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-full bg-dark-700/50 border border-dark-600/30 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-300">No Report Generated</h3>
          <p className="text-sm text-gray-500 mt-1 text-center max-w-md">
            Select an actor from the dropdown above and click &ldquo;Generate Report&rdquo; to create a comprehensive intelligence report.
          </p>
        </div>
      )}

      {/* ── Loading Overlay ────────────────────────────────────────── */}
      {loading && (
        <div className="glass-card flex flex-col items-center justify-center py-16">
          <div className="relative mb-4">
            <div className="w-14 h-14 border-2 border-cyber-blue/20 border-t-cyber-blue rounded-full animate-spin" />
            <div
              className="absolute inset-0 w-14 h-14 border-2 border-cyber-green/10 border-b-cyber-green rounded-full animate-spin"
              style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <FileText className="w-5 h-5 text-cyber-blue/60" />
            </div>
          </div>
          <p className="text-sm text-gray-400 font-medium">Generating Investigation Report</p>
          <p className="text-xs text-gray-600 mt-1">Analyzing actor intelligence data...</p>
          <div className="flex items-center gap-1.5 mt-3">
            <div className="w-1.5 h-1.5 rounded-full bg-cyber-blue animate-pulse" />
            <div className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-cyber-blue animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      )}
    </div>
  );
}
