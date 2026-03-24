import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  findChildNodeId,
  getActiveNarrativePathIds,
  getNarrativeNode,
  getNarrativeNodeExcerpt,
  getNarrativeOutgoingEdges
} from '../state/narrativeGraph';
import { createNarrativeGraphLayout } from '../state/narrativeGraphLayout';

const MIN_SCALE = 0.42;
const MAX_SCALE = 1.7;
const VIEW_PADDING = 120;
const CLOSE_DURATION = 210;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function truncate(text = '', length = 54) {
  return text.length > length ? `${text.slice(0, Math.max(0, length - 3)).trimEnd()}...` : text;
}

function createEdgePath(edge) {
  const curve = Math.max(72, (edge.targetX - edge.sourceX) * 0.42);
  return `M ${edge.sourceX} ${edge.sourceY} C ${edge.sourceX + curve} ${edge.sourceY}, ${edge.targetX - curve} ${edge.targetY}, ${edge.targetX} ${edge.targetY}`;
}

function applyZoomFromPoint(view, requestedScale, origin) {
  const scale = clamp(requestedScale, MIN_SCALE, MAX_SCALE);
  const worldX = (origin.x - view.x) / view.scale;
  const worldY = (origin.y - view.y) / view.scale;
  return {
    scale,
    x: origin.x - worldX * scale,
    y: origin.y - worldY * scale
  };
}

function fitTransform(bounds, viewportRect) {
  const safeWidth = Math.max(1, bounds.width + VIEW_PADDING * 2);
  const safeHeight = Math.max(1, bounds.height + VIEW_PADDING * 2);
  const usableWidth = Math.max(1, viewportRect.width - 48);
  const usableHeight = Math.max(1, viewportRect.height - 48);
  const scale = clamp(
    Math.min(usableWidth / safeWidth, usableHeight / safeHeight, 1.05),
    MIN_SCALE,
    1.15
  );
  return {
    scale,
    x: (viewportRect.width - bounds.width * scale) / 2 - bounds.minX * scale,
    y: (viewportRect.height - bounds.height * scale) / 2 - bounds.minY * scale
  };
}

// ─── Node Detail Overlay ──────────────────────────────────────────────────────

const NodeDetail = ({ node, graph, activePathIds, closing, onClose, onJump }) => {
  const isCurrent = graph?.activeNodeId === node.id;
  const isOnActivePath = activePathIds.has(node.id);
  const isBranching = getNarrativeOutgoingEdges(graph, node.id).length > 1;
  const branchCount = getNarrativeOutgoingEdges(graph, node.id).length;

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm ${closing ? 'animate-fade-out' : 'animate-fade-in'}`}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-xl mx-4 max-h-[82vh] flex flex-col rounded-[24px] border border-white/10 bg-[#07070e]/97 shadow-[0_24px_80px_rgba(0,0,0,0.7)] ${closing ? 'animate-blur-out' : 'animate-blur-in'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-7 pt-6 pb-5">
          <div className="min-w-0 flex-1">
            <p className="font-cardo text-[10px] uppercase tracking-[0.34em] text-amber-200/50 mb-0.5">
              Scene {node.depth}
            </p>
            <h3 className="font-berkshire text-2xl text-white/95 leading-tight">
              {node.title || `Untitled Scene ${node.depth}`}
            </h3>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {isCurrent && (
                <span className="rounded-full border border-emerald-300/45 bg-emerald-500/10 px-2.5 py-0.5 font-cardo text-[10px] uppercase tracking-[0.22em] text-emerald-100">
                  Current
                </span>
              )}
              {!isCurrent && isOnActivePath && (
                <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-0.5 font-cardo text-[10px] uppercase tracking-[0.22em] text-cyan-100">
                  Active Path
                </span>
              )}
              {isBranching && (
                <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-0.5 font-cardo text-[10px] uppercase tracking-[0.22em] text-amber-100">
                  Fork ×{branchCount}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="font-cardo text-xs text-white/30 hover:text-white/70 transition-colors"
            >
              ✕
            </button>
            <button
              onClick={() => onJump(node.id)}
              className="rounded-full border border-amber-300/45 bg-amber-300/10 px-4 py-1.5 font-cardo text-sm text-amber-50 transition hover:bg-amber-300/20"
            >
              {isCurrent ? 'Current Scene' : 'Resume From Here'}
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
          <section>
            <h4 className="font-cardo text-[10px] uppercase tracking-[0.28em] text-amber-200/50 mb-3">Prose</h4>
            <p className="whitespace-pre-wrap font-cardo text-sm leading-7 text-white/85">
              {node.prose || node.story || 'No prose stored for this scene.'}
            </p>
          </section>

          {node.summary && (
            <section>
              <h4 className="font-cardo text-[10px] uppercase tracking-[0.28em] text-amber-200/50 mb-3">Summary</h4>
              <p className="whitespace-pre-wrap font-cardo text-sm leading-7 text-white/65">
                {node.summary}
              </p>
            </section>
          )}

          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h4 className="font-cardo text-[10px] uppercase tracking-[0.28em] text-amber-200/50">Paths</h4>
              <p className="font-cardo text-[10px] text-white/30">A taken path follows its existing branch.</p>
            </div>
            {node.paths?.length > 0 ? (
              <ul className="space-y-2">
                {node.paths.map((path, index) => {
                  const childId = findChildNodeId(graph, node.id, path, index);
                  const childNode = childId ? getNarrativeNode(graph, childId) : null;
                  return (
                    <li key={`${node.id}-${index}`} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                      <p className="font-cardo text-sm leading-6 text-white/85">{path}</p>
                      <p className="mt-1 font-cardo text-xs text-white/35">
                        {childNode ? `Branches to Scene ${childNode.depth}` : 'Unexplored'}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="font-cardo text-sm text-white/40 italic">No paths stored for this scene.</p>
            )}
          </section>

          <section className="space-y-2">
            {[
              { label: 'Prompt', content: node.prompt },
              { label: 'Parsed Packet', content: node.packet && Object.keys(node.packet).length > 0 ? JSON.stringify(node.packet, null, 2) : null },
              { label: 'Raw Output', content: node.rawOutput },
            ].map(({ label, content }) => (
              <details key={label} className="rounded-[16px] border border-white/8 bg-black/15 p-4">
                <summary className="cursor-pointer font-cardo text-xs uppercase tracking-[0.22em] text-white/40 hover:text-white/65 transition-colors">
                  {label}
                </summary>
                <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap font-mono text-xs leading-6 text-white/55">
                  {content || `No ${label.toLowerCase()} stored.`}
                </pre>
              </details>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const NarrativeBranchView = ({ graph, onJumpToNode, onClose }) => {
  const [closing, setClosing] = useState(false);
  const [detailNodeId, setDetailNodeId] = useState(null);
  const [detailClosing, setDetailClosing] = useState(false);

  const detailNode = detailNodeId ? getNarrativeNode(graph, detailNodeId) : null;

  const layout = useMemo(() => createNarrativeGraphLayout(graph), [graph]);
  const activePathIds = useMemo(() => new Set(getActiveNarrativePathIds(graph)), [graph]);
  const activeEdgeIds = useMemo(() => {
    const ids = new Set();
    layout.edges.forEach((edge) => {
      if (activePathIds.has(edge.parentId) && activePathIds.has(edge.childId)) ids.add(edge.id);
    });
    return ids;
  }, [activePathIds, layout.edges]);

  const viewportRef = useRef(null);
  const panStateRef = useRef(null);
  const [view, setView] = useState({ x: 72, y: 72, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);

  const fitToView = useCallback(() => {
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport) return;
    setView(fitTransform(layout.bounds, viewport));
  }, [layout.bounds]);

  const centerOnActiveNode = useCallback(() => {
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport || viewport.width === 0) { fitToView(); return; }
    const activeNode = layout.nodes.find(n => n.id === graph?.activeNodeId);
    if (!activeNode) { fitToView(); return; }
    const scale = clamp(1.0, MIN_SCALE, MAX_SCALE);
    const { nodeWidth, nodeHeight } = layout.metrics;
    setView({
      scale,
      x: viewport.width / 2 - (activeNode.position.x + nodeWidth / 2) * scale,
      y: viewport.height / 2 - (activeNode.position.y + nodeHeight / 2) * scale,
    });
  }, [layout, graph?.activeNodeId, fitToView]);

  // Center on the active node when the map first opens
  useEffect(() => {
    const raf = requestAnimationFrame(() => centerOnActiveNode());
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close detail only (Escape when detail is open)
  const closeDetail = useCallback(() => {
    setDetailClosing(true);
    setTimeout(() => { setDetailNodeId(null); setDetailClosing(false); }, CLOSE_DURATION);
  }, []);

  // Close the whole map
  const handleClose = useCallback(() => {
    setDetailClosing(true); // also dismiss detail if open
    setClosing(true);
    setTimeout(onClose, CLOSE_DURATION);
  }, [onClose]);

  // Jump to node: animate both out, then navigate
  const handleJump = useCallback((nodeId) => {
    setDetailClosing(true);
    setClosing(true);
    setTimeout(() => onJumpToNode(nodeId), CLOSE_DURATION);
  }, [onJumpToNode]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (detailNodeId) closeDetail();
      else handleClose();
    };
    const onResize = () => fitToView();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
  }, [detailNodeId, closeDetail, handleClose, fitToView]);

  const zoomBy = useCallback((delta) => {
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport) return;
    setView((current) => applyZoomFromPoint(current, current.scale * delta, { x: viewport.width / 2, y: viewport.height / 2 }));
  }, []);

  const handleWheel = (event) => {
    event.preventDefault();
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport) return;
    setView((current) => applyZoomFromPoint(current, current.scale * (event.deltaY > 0 ? 0.92 : 1.08), { x: event.clientX - viewport.left, y: event.clientY - viewport.top }));
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('[data-map-node]')) return;
    if (event.target.closest('[data-map-control]')) return;
    if (event.target.closest('[data-edge-label]')) return;
    panStateRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y };
    setIsPanning(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const p = panStateRef.current;
    if (!p || p.pointerId !== event.pointerId) return;
    setView((current) => ({ ...current, x: p.originX + (event.clientX - p.startX), y: p.originY + (event.clientY - p.startY) }));
  };

  const handlePointerUp = (event) => {
    if (panStateRef.current?.pointerId !== event.pointerId) return;
    panStateRef.current = null;
    setIsPanning(false);
  };

  return (
    <>
      {/* Map backdrop + card */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm ${closing ? 'animate-fade-out' : 'animate-fade-in'}`}>
        <div className={`relative w-full max-w-4xl mx-4 h-[78vh] flex flex-col overflow-hidden rounded-[28px] border border-amber-200/20 bg-[#06060c]/95 shadow-[0_24px_120px_rgba(0,0,0,0.55)] ${closing ? 'animate-blur-out' : 'animate-blur-in'}`}>

          {/* Header */}
          <div className="relative z-20 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-black/30 px-6 py-5">
            <div>
              <p className="font-cardo text-xs uppercase tracking-[0.34em] text-amber-200/70">Paths Untold</p>
              <h2 className="font-berkshire text-3xl text-amber-50">Narrative Map</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[['Zoom Out', () => zoomBy(0.9)], ['Zoom In', () => zoomBy(1.1)]].map(([label, fn]) => (
                <button key={label} data-map-control onClick={fn}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-2 font-cardo text-sm text-white/80 transition hover:bg-white/10">
                  {label}
                </button>
              ))}
              <button data-map-control onClick={fitToView}
                className="rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-2 font-cardo text-sm text-amber-100 transition hover:bg-amber-300/20">
                Fit View
              </button>
              <button data-map-control onClick={handleClose}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-2 font-cardo text-sm text-white/60 transition hover:bg-white/10">
                Close
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div
            ref={viewportRef}
            className={`relative flex-1 overflow-hidden transition-[filter] duration-200 ${detailNode ? 'blur-sm' : ''} ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onDoubleClick={fitToView}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.12),transparent_32%)]" />
            <div className="pointer-events-none absolute inset-0 opacity-25"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
                backgroundSize: `${92 * view.scale}px ${92 * view.scale}px`
              }}
            />

            <div className="absolute left-0 top-0 will-change-transform"
              style={{
                width: layout.bounds.width + VIEW_PADDING * 2,
                height: layout.bounds.height + VIEW_PADDING * 2,
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                transformOrigin: '0 0'
              }}
            >
              <svg className="absolute left-0 top-0 overflow-visible"
                width={layout.bounds.width + VIEW_PADDING * 2}
                height={layout.bounds.height + VIEW_PADDING * 2}
                viewBox={`-40 -40 ${layout.bounds.width + VIEW_PADDING * 2} ${layout.bounds.height + VIEW_PADDING * 2}`}
              >
                <defs>
                  <marker id="narrative-map-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L10,5 L0,10 z" fill="#f6d18b" />
                  </marker>
                </defs>

                {layout.edges.map((edge) => {
                  const isActive = activeEdgeIds.has(edge.id);
                  return (
                    <path key={edge.id} d={createEdgePath(edge)} fill="none"
                      stroke={isActive ? '#f6d18b' : '#7dd3c9'}
                      strokeOpacity={isActive ? 0.88 : 0.28}
                      strokeWidth={isActive ? 3.2 : 1.8}
                      markerEnd="url(#narrative-map-arrow)"
                    />
                  );
                })}
              </svg>

              {layout.nodes.map((node) => {
                const isCurrent = graph?.activeNodeId === node.id;
                const isSelected = detailNodeId === node.id;
                const isOnActivePath = activePathIds.has(node.id);
                const branchCount = getNarrativeOutgoingEdges(graph, node.id).length;
                const isDimmed = !isOnActivePath && !isCurrent && !isSelected;

                return (
                  <button key={node.id} type="button" data-map-node
                    onClick={() => setDetailNodeId(node.id)}
                    className={`absolute overflow-hidden rounded-[22px] border p-4 text-left transition duration-200 ${
                      isSelected
                        ? 'border-amber-200/80 bg-[#1d120d]/96 shadow-[0_12px_30px_rgba(245,158,11,0.22)]'
                        : isCurrent
                          ? 'border-emerald-300/70 bg-[#0d1714]/92 shadow-[0_12px_28px_rgba(16,185,129,0.18)]'
                          : isOnActivePath
                            ? 'border-cyan-300/55 bg-[#091218]/88 shadow-[0_10px_24px_rgba(34,211,238,0.12)]'
                            : 'border-white/10 bg-black/72'
                    } ${isDimmed ? 'opacity-55 hover:opacity-85' : 'opacity-100 hover:-translate-y-0.5'}`}
                    style={{ left: node.position.x, top: node.position.y, width: layout.metrics.nodeWidth, minHeight: layout.metrics.nodeHeight }}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_52%)]" />
                    <div className="relative flex h-full flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-cardo text-[11px] uppercase tracking-[0.28em] text-white/45">Scene {node.depth}</p>
                          <h3 className="mt-1 font-berkshire text-xl leading-6 text-white">{truncate(node.title || `Scene ${node.depth}`, 34)}</h3>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {isCurrent && <span className="rounded-full border border-emerald-300/55 bg-emerald-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-emerald-100">Current</span>}
                          {!isCurrent && isOnActivePath && <span className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-cyan-100">Active Path</span>}
                          {branchCount > 1 && <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-amber-100">Fork ×{branchCount}</span>}
                        </div>
                      </div>
                      <p className="font-cardo text-sm leading-6 text-white/70"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {getNarrativeNodeExcerpt(node)}
                      </p>
                      {node.choiceFromParent && (
                        <p className="mt-auto font-cardo text-xs leading-5 text-amber-100/70">From: {truncate(node.choiceFromParent, 56)}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="absolute bottom-4 left-4 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 font-cardo text-xs text-white/65 backdrop-blur-sm">
              <p>Drag to pan · Scroll to zoom · Double-click to fit · Click a scene to inspect</p>
            </div>
          </div>
        </div>
      </div>

      {/* Node detail overlay */}
      {detailNode && (
        <NodeDetail
          node={detailNode}
          graph={graph}
          activePathIds={activePathIds}
          closing={detailClosing}
          onClose={closeDetail}
          onJump={handleJump}
        />
      )}
    </>
  );
};

export default NarrativeBranchView;
