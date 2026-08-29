'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { apiFetch, ensureAuth } from '@/lib/api';
import {
  GitBranch, Filter, Info, X, Maximize2, ChevronDown, Layers, ChevronRight,
} from 'lucide-react';
import type { GraphData } from '@/types';

const NODE_COLORS: Record<string, string> = {
  Actor: '#00d4ff', Alias: '#00ff88', PGP: '#ff8800',
  Wallet: '#ffcc00', Domain: '#8855ff', IP: '#ff3366',
};

function computeLayout(graphData: GraphData, cx: number, cy: number): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  const byType: Record<string, string[]> = {};
  graphData.nodes.forEach((n) => {
    if (!byType[n.type]) byType[n.type] = [];
    byType[n.type].push(n.id);
  });
  const actors = byType['Actor'] || [];
  if (actors.length === 0) {
    graphData.nodes.forEach((n, i) => {
      const a = (2 * Math.PI * i) / Math.max(graphData.nodes.length, 1);
      pos[n.id] = { x: cx + 300 * Math.cos(a), y: cy + 300 * Math.sin(a) };
    });
    return pos;
  }
  const primary = actors[0];
  pos[primary] = { x: cx, y: cy };
  const neighbors = new Set<string>();
  const crossActors = new Set<string>();
  graphData.edges.forEach((e) => {
    if (e.source === primary) neighbors.add(e.target);
    if (e.target === primary) neighbors.add(e.source);
  });
  graphData.nodes.forEach((n) => {
    if (n.id !== primary && !neighbors.has(n.id)) crossActors.add(n.id);
  });
  const innerR = 280;
  const nArr = Array.from(neighbors);
  const aStep = (2 * Math.PI) / Math.max(nArr.length, 1);
  nArr.forEach((nid, i) => {
    const a = aStep * i - Math.PI / 2;
    pos[nid] = { x: cx + innerR * Math.cos(a), y: cy + innerR * Math.sin(a) };
  });
  const outerR = 550;
  const cArr = Array.from(crossActors);
  const cStep = (2 * Math.PI) / Math.max(cArr.length, 1);
  cArr.forEach((nid, i) => {
    const a = cStep * i - Math.PI / 2;
    pos[nid] = { x: cx + outerR * Math.cos(a), y: cy + outerR * Math.sin(a) };
  });
  return pos;
}

interface PanelNode { id: string; label: string; type: string; properties?: Record<string, unknown> }
interface PanelEdge { id: string; source: string; target: string; label: string; properties?: Record<string, unknown> }

export default function GraphPage() {
  const [selectedActor, setSelectedActor] = useState('');
  const [actorList, setActorList] = useState<Array<{ id: number; name: string }>>([]);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [confThreshold, setConfThreshold] = useState(0);
  const [selectedNode, setSelectedNode] = useState<PanelNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<PanelEdge | null>(null);
  const [actorsLoaded, setActorsLoaded] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const a = p.get('actor');
      if (a) setSelectedActor(a);
    }
  }, []);

  useEffect(() => {
    ensureAuth().then(() =>
      apiFetch<Array<{ id: number; name: string }>>('/api/v1/actors/?limit=50')
        .then((list) => {
          setActorList(list);
          setActorsLoaded(true);
          if (!selectedActor && list.length > 0) {
            setSelectedActor(String(list[0].id));
          }
        })
        .catch(console.error)
    );
  }, []);

  const fetchGraph = useCallback(async (actorId: string) => {
    try {
      await ensureAuth();
      setLoading(true);
      setError(null);
      const data = await apiFetch<GraphData>(`/api/v1/intelligence/graph/${actorId}?depth=2`);
      setGraphData(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedActor) fetchGraph(selectedActor);
  }, [selectedActor, fetchGraph]);

  useEffect(() => {
    if (selectedActor) {
      pollTimerRef.current = setInterval(() => {
        fetchGraph(selectedActor);
      }, 30000);
    }
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [selectedActor, fetchGraph]);

  const stats = useMemo(() => {
    if (!graphData) return null;
    const tc: Record<string, number> = {};
    graphData.nodes.forEach((n) => { tc[n.type] = (tc[n.type] || 0) + 1; });
    return { nodeCount: graphData.nodes.length, edgeCount: graphData.edges.length, typeCounts: tc };
  }, [graphData]);

  const { nodes: flowNodes, edges: flowEdges } = useMemo(() => {
    if (!graphData) return { nodes: [] as Node[], edges: [] as Edge[] };
    const positions = computeLayout(graphData, 900, 600);
    const filtered = filterType === 'all' ? graphData.nodes : graphData.nodes.filter((n) => n.type === filterType);
    const fIds = new Set(filtered.map((n) => n.id));
    const nodes: Node[] = filtered.map((n) => {
      const p = positions[n.id] || { x: Math.random() * 1200, y: Math.random() * 800 };
      const color = NODE_COLORS[n.type] || '#3d4266';
      const isActor = n.type === 'Actor';
      const sel = selectedNode?.id === n.id;
      return {
        id: n.id,
        data: { label: n.label },
        position: p,
        style: {
          background: sel ? `${color}40` : `${color}20`,
          color: '#fff',
          border: `2px solid ${sel ? color : `${color}60`}`,
          borderRadius: isActor ? '16px' : '12px',
          padding: isActor ? '12px 18px' : '8px 14px',
          fontSize: isActor ? '13px' : '11px',
          fontWeight: isActor ? 700 : 500,
          boxShadow: sel ? `0 0 20px ${color}40` : 'none',
          cursor: 'pointer',
        },
        type: 'default' as const,
      };
    });
    const eList: Edge[] = graphData.edges
      .filter((e) => fIds.has(e.source) && fIds.has(e.target) && (confThreshold === 0 || (e.properties?.confidence ?? 0) >= confThreshold))
      .map((e, i) => {
        const conf = e.properties?.confidence as number | undefined;
        const ec = conf !== undefined && conf >= 0.8 ? '#00ff88' : conf !== undefined && conf >= 0.5 ? '#ffcc00' : '#3d4266';
        return {
          id: e.id || `edge_${i}`, source: e.source, target: e.target, label: e.label,
          animated: conf !== undefined && conf >= 0.8,
          style: { stroke: ec, strokeWidth: conf !== undefined && conf >= 0.8 ? 2.5 : 1.5 },
          labelStyle: { fontSize: 9, fill: '#6b7280' },
          labelBgStyle: { fill: '#0f1117', fillOpacity: 0.8 },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
          markerEnd: { type: MarkerType.ArrowClosed, color: ec, width: 16, height: 16 },
        };
      });
    return { nodes, edges: eList };
  }, [graphData, filterType, confThreshold, selectedNode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);
  useEffect(() => { setNodes(flowNodes); }, [flowNodes, setNodes]);
  useEffect(() => { setEdges(flowEdges); }, [flowEdges, setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const gn = graphData?.nodes.find((n) => n.id === node.id);
    if (gn) { setSelectedNode(gn); setSelectedEdge(null); }
  }, [graphData]);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    const ge = graphData?.edges.find((e) => (e.id || `edge_${graphData.edges.indexOf(e)}`) === edge.id);
    if (ge) { setSelectedEdge(ge); setSelectedNode(null); }
  }, [graphData]);

  const onPaneClick = useCallback(() => { setSelectedNode(null); setSelectedEdge(null); }, []);

  const connectedNodes = useMemo(() => {
    if (!selectedNode || !graphData) return [];
    const ids = new Set<string>();
    graphData.edges.forEach((e) => {
      if (e.source === selectedNode.id) ids.add(e.target);
      if (e.target === selectedNode.id) ids.add(e.source);
    });
    return graphData.nodes.filter((n) => ids.has(n.id));
  }, [selectedNode, graphData]);

  const connectedEdges = useMemo(() => {
    if (!selectedNode || !graphData) return [];
    return graphData.edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id);
  }, [selectedNode, graphData]);

  return (
    <div className="space-y-4 h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyber-blue/10 border border-cyber-blue/20 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-cyber-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-100">Relationship Graph</h1>
            <p className="text-xs text-gray-500">Interactive actor-entity correlation visualization</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stats && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{stats.nodeCount} nodes</span>
              <span className="text-dark-600">|</span>
              <span>{stats.edgeCount} edges</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Actor:</label>
          <select value={selectedActor} onChange={(e) => setSelectedActor(e.target.value)} className="input-field w-48">
            {actorList.map((a) => (
              <option key={a.id} value={String(a.id)}>{a.name} (#{a.id})</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input-field w-36">
            <option value="all">All Types</option>
            {Object.keys(NODE_COLORS).map((t) => (
              <option key={t} value={t}>{t}s</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Confidence:</label>
          <input type="range" min={0} max={1} step={0.1} value={confThreshold}
            onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
            className="w-24 accent-cyber-blue" />
          <span className="text-xs font-mono text-gray-400 w-8">{Math.round(confThreshold * 100)}%</span>
        </div>
      </div>

      <div className="flex-1 glass-card relative overflow-hidden" style={{ minHeight: 0 }}>
        {loading && actorsLoaded ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-cyber-blue/20 border-t-cyber-blue rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading graph...</p>
            </div>
          </div>
        ) : !actorsLoaded ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-cyber-blue/20 border-t-cyber-blue rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Connecting to backend...</p>
            </div>
          </div>
        )
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-3">{error}</p>
              <button onClick={() => fetchGraph(selectedActor)} className="btn-primary">Retry</button>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} onPaneClick={onPaneClick}
            fitView attributionPosition="bottom-left"
          >
            <Background color="#1a1d2e" gap={20} />
            <Controls />
            <MiniMap nodeColor={(n) => NODE_COLORS[(n.type as string) || 'Actor'] || '#3d4266'} maskColor="rgba(0,0,0,0.7)" style={{ background: '#0f1117' }} />
          </ReactFlow>
        )}

        {selectedNode && (
          <div className="absolute top-4 right-4 w-72 glass-panel p-4 space-y-3 max-h-[calc(100%-2rem)] overflow-y-auto z-10">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">Node Details</h3>
              <button onClick={() => setSelectedNode(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ background: NODE_COLORS[selectedNode.type] || '#3d4266' }} />
                <span className="text-sm font-medium text-gray-200">{selectedNode.label}</span>
              </div>
              <div className="text-xs text-gray-500">Type: {selectedNode.type}</div>
              {selectedNode.properties && Object.entries(selectedNode.properties).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-gray-500">{k.replace(/_/g, ' ')}</span>
                  <span className="text-gray-300 font-mono">{String(v)}</span>
                </div>
              ))}
            </div>
            {connectedNodes.length > 0 && (
              <div>
                <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Connected Nodes ({connectedNodes.length})</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {connectedNodes.map((cn) => (
                    <div key={cn.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-dark-800/50">
                      <div className="w-2 h-2 rounded-sm" style={{ background: NODE_COLORS[cn.type] || '#3d4266' }} />
                      <span className="text-gray-300 truncate">{cn.label}</span>
                      <span className="text-gray-600 ml-auto">{cn.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {connectedEdges.length > 0 && (
              <div>
                <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Relationships ({connectedEdges.length})</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {connectedEdges.map((ce) => (
                    <div key={ce.id} className="text-xs py-1 px-2 rounded bg-dark-800/50">
                      <span className="text-cyber-blue">{ce.label}</span>
                      <span className="text-gray-600 ml-2">{Math.round(((ce.properties?.confidence as number) || 0) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedNode.type === 'Actor' && selectedNode.properties?.id != null && (
              <button onClick={() => { setSelectedActor(String(selectedNode.properties!.id)); setSelectedNode(null); }}
                className="btn-primary w-full text-xs flex items-center justify-center gap-2">
                <Maximize2 className="w-3 h-3" /> Expand This Actor
              </button>
            )}
          </div>
        )}

        {selectedEdge && (
          <div className="absolute top-4 right-4 w-72 glass-panel p-4 space-y-3 z-10">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">Edge Details</h3>
              <button onClick={() => setSelectedEdge(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-cyber-blue font-medium">{selectedEdge.label}</div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Source</span>
                <span className="text-gray-300 font-mono">{selectedEdge.source}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Target</span>
                <span className="text-gray-300 font-mono">{selectedEdge.target}</span>
              </div>
              {selectedEdge.properties && Object.entries(selectedEdge.properties).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-gray-500">{k.replace(/_/g, ' ')}</span>
                  <span className="text-gray-300 font-mono">{typeof v === 'number' ? Math.round(v * 100) + '%' : String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
            <Info className="w-3 h-3" /> Legend
          </div>
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: `${color}40`, border: `1px solid ${color}80` }} />
              {type}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 rounded" style={{ background: '#00ff88' }} />
            <span>High (80%+)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 rounded" style={{ background: '#ffcc00' }} />
            <span>Medium (50%+)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 rounded" style={{ background: '#3d4266' }} />
            <span>Low</span>
          </div>
        </div>
      </div>
    </div>
  );
}
