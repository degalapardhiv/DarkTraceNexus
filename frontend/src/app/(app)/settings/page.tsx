'use client';

import { useEffect, useState } from 'react';
import { apiFetch, apiUpload, ensureAuth } from '@/lib/api';
import {
  Settings as SettingsIcon, Upload, Database, Check, AlertTriangle,
  Shield, Server, Wifi, WifiOff, RefreshCw, FileText, Globe, Lock
} from 'lucide-react';

interface DataSource {
  id: number;
  name: string;
  source_type: string;
  is_active: boolean;
  last_ingested_at: string | null;
  record_count: number;
}

export default function SettingsPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [loadingSources, setLoadingSources] = useState(true);

  useEffect(() => {
    const load = async () => {
      await ensureAuth();
      try {
        const [src, _] = await Promise.allSettled([
          apiFetch<DataSource[]>('/api/v1/ingestion/sources'),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/health`).then(r => {
            if (r.ok) setApiStatus('connected');
            else setApiStatus('error');
          }).catch(() => setApiStatus('error')),
        ]);
        if (src.status === 'fulfilled') setSources(src.value);
      } catch {
        // sources endpoint may not exist
      } finally {
        setLoadingSources(false);
        if (apiStatus === 'checking') setApiStatus('connected');
      }
    };
    load();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await ensureAuth();
    setUploading(true);
    setUploadStatus(null);
    try {
      const result = await apiUpload('/api/v1/ingestion/upload?source_name=manual_upload', file);
      setUploadStatus(
        `Uploaded successfully: ${result.records_processed ?? 0} records processed, ${result.actors_discovered ?? 0} actors discovered`
      );
      try {
        const src = await apiFetch<DataSource[]>('/api/v1/ingestion/sources');
        setSources(src);
      } catch { /* ignore refresh error */ }
    } catch (err: any) {
      setUploadStatus(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const statusIcon = (active: boolean) =>
    active ? (
      <span className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
    ) : (
      <span className="w-2 h-2 rounded-full bg-gray-600" />
    );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 tracking-tight">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Platform configuration, data management, and system status</p>
        </div>
        <SettingsIcon className="w-5 h-5 text-gray-600" />
      </div>

      {/* ── Top Row: API Status | System Info ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Connection Status */}
        <div className="glass-card">
          <div className="flex items-center gap-2 mb-4">
            {apiStatus === 'connected' ? (
              <Wifi className="w-4 h-4 text-cyber-green" />
            ) : apiStatus === 'error' ? (
              <WifiOff className="w-4 h-4 text-cyber-red" />
            ) : (
              <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />
            )}
            <h3 className="text-sm font-medium text-gray-300">API Connection Status</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Backend Health</span>
              <span className={`flex items-center gap-2 text-sm font-medium ${
                apiStatus === 'connected' ? 'text-cyber-green' : apiStatus === 'error' ? 'text-cyber-red' : 'text-gray-400'
              }`}>
                {apiStatus === 'connected' ? 'Connected' : apiStatus === 'error' ? 'Disconnected' : 'Checking...'}
                <span className={`w-2 h-2 rounded-full ${
                  apiStatus === 'connected' ? 'bg-cyber-green' : apiStatus === 'error' ? 'bg-cyber-red' : 'bg-gray-500 animate-pulse'
                }`} />
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">API Endpoint</span>
              <span className="text-xs font-mono text-gray-400 truncate max-w-[220px]">
                {process.env.NEXT_PUBLIC_API_URL || '(not set)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Authentication</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Lock className="w-3 h-3" />
                JWT + Argon2
              </span>
            </div>
          </div>
        </div>

        {/* System Information */}
        <div className="glass-card">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-4 h-4 text-cyber-blue" />
            <h3 className="text-sm font-medium text-gray-300">System Information</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Platform', value: 'DarkTrace Nexus', badge: 'v1.0' },
              { label: 'Mode', value: 'Synthetic / Demo', badge: 'Demo' },
              { label: 'Backend', value: 'FastAPI + PostgreSQL', badge: null },
              { label: 'Graph DB', value: 'Neo4j', badge: null },
              { label: 'ML Engine', value: 'scikit-learn + Custom', badge: null },
              { label: 'Security', value: 'JWT + Argon2 + RBAC', badge: null },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{row.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-300">{row.value}</span>
                  {row.badge && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/20">
                      {row.badge}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Data Sources ── */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyber-purple" />
            <h3 className="text-sm font-medium text-gray-300">Data Sources</h3>
            {sources.length > 0 && (
              <span className="badge-info text-[10px]">{sources.length}</span>
            )}
          </div>
        </div>

        {loadingSources ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-cyber-blue/30 border-t-cyber-blue rounded-full animate-spin" />
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-8">
            <Globe className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No data sources configured</p>
            <p className="text-xs text-gray-600 mt-1">Upload intelligence data below to create a source</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600/50">
                  <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">Status</th>
                  <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">Name</th>
                  <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">Type</th>
                  <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">Records</th>
                  <th className="text-left py-2.5 px-3 text-[10px] text-gray-500 font-medium uppercase tracking-wider">Last Ingested</th>
                </tr>
              </thead>
              <tbody>
                {sources.map(src => (
                  <tr key={src.id} className="border-b border-dark-700/30 hover:bg-dark-800/30 transition-colors">
                    <td className="py-2.5 px-3">{statusIcon(src.is_active)}</td>
                    <td className="py-2.5 px-3 text-xs font-medium text-gray-200">{src.name}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-dark-700 text-gray-400 border border-dark-600/50">
                        {src.source_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs font-mono text-gray-400">
                      {src.record_count.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500">
                      {src.last_ingested_at
                        ? new Date(src.last_ingested_at).toLocaleString()
                        : <span className="text-gray-600">Never</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── File Upload ── */}
      <div className="glass-card">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="w-4 h-4 text-cyber-blue" />
          <h3 className="text-sm font-medium text-gray-300">Data Ingestion</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Upload JSON or CSV intelligence files to ingest into the platform. Supported formats include actor profiles, aliases, PGP keys, wallets, domains, and posts.
        </p>
        <div className="border-2 border-dashed border-dark-600 rounded-lg p-8 text-center hover:border-dark-500 transition-colors">
          <input
            type="file"
            accept=".json,.csv"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload-settings"
          />
          <label htmlFor="file-upload-settings" className="cursor-pointer">
            <FileText className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">Click to upload JSON or CSV</p>
            <p className="text-xs text-gray-600 mt-1">Maximum file size: 10MB</p>
          </label>
        </div>
        {uploading && (
          <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-dark-700/30">
            <div className="w-5 h-5 border-2 border-cyber-blue/30 border-t-cyber-blue rounded-full animate-spin" />
            <span className="text-sm text-gray-400">Processing upload...</span>
          </div>
        )}
        {uploadStatus && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${
            uploadStatus.startsWith('Error')
              ? 'bg-cyber-red/10 text-cyber-red border border-cyber-red/20'
              : 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20'
          }`}>
            <div className="flex items-center gap-2">
              {uploadStatus.startsWith('Error')
                ? <AlertTriangle className="w-4 h-4 shrink-0" />
                : <Check className="w-4 h-4 shrink-0" />
              }
              {uploadStatus}
            </div>
          </div>
        )}
      </div>

      {/* ── Platform Disclaimer ── */}
      <div className="glass-card border-dashed border-dark-600/40">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-cyber-orange mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-cyber-orange mb-2">Safety &amp; Legal Disclaimer</h3>
            <div className="text-xs text-gray-400 space-y-2">
              <p>
                This platform operates as a <strong className="text-gray-300">defensive cybersecurity research tool</strong>.
                DarkTrace Nexus is designed for lawful threat-intelligence research and defense only.
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-500">
                <li>All data in this demo is synthetic and generated for demonstration purposes</li>
                <li>No real dark-web content is accessed or stored</li>
                <li>No unauthorized access, exploitation, or credential attacks are performed</li>
                <li>No real individuals are de-anonymized</li>
                <li>The platform demonstrates intelligence-correlation methodology only</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
