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
  const panContainerRef = useRef(null);
  const panStateRef = useRef(null);
  const viewRef = useRef({ x: 72, y: 72, scale: 1 });
  const [view, setView] = useState({ x: 72, y: 72, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);

  // Apply transform directly to DOM — bypasses React re-renders during panning.
  const applyView = useCallback((v) => {
    viewRef.current = v;
    if (panContainerRef.current) {
      panContainerRef.current.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.scale})`;
    }
  }, []);

  const commitView = useCallback((v) => {
    applyView(v);
    setView(v);
  }, [applyView]);

  const fitToView = useCallback(() => {
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport) return;
    commitView(fitTransform(layout.bounds, viewport));
  }, [layout.bounds, commitView]);

  const centerOnActiveNode = useCallback(() => {
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport || viewport.width === 0) { fitToView(); return; }
    const activeNode = layout.nodes.find(n => n.id === graph?.activeNodeId);
    if (!activeNode) { fitToView(); return; }
    const scale = clamp(1.0, MIN_SCALE, MAX_SCALE);
    const { nodeWidth, nodeHeight } = layout.metrics;
    commitView({
      scale,
      x: viewport.width / 2 - (activeNode.position.x + nodeWidth / 2) * scale,
      y: viewport.height / 2 - (activeNode.position.y + nodeHeight / 2) * scale,
    });
  }, [layout, graph?.activeNodeId, fitToView, commitView]);

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
    commitView(applyZoomFromPoint(viewRef.current, viewRef.current.scale * delta, { x: viewport.width / 2, y: viewport.height / 2 }));
  }, [commitView]);

  const handleWheel = (event) => {
    event.preventDefault();
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport) return;
    commitView(applyZoomFromPoint(viewRef.current, viewRef.current.scale * (event.deltaY > 0 ? 0.92 : 1.08), { x: event.clientX - viewport.left, y: event.clientY - viewport.top }));
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('[data-map-node]')) return;
    if (event.target.closest('[data-map-control]')) return;
    event.preventDefault(); // stop text selection on fast drag
    const v = viewRef.current;
    panStateRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: v.x, originY: v.y };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const p = panStateRef.current;
    if (!p || p.pointerId !== event.pointerId) return;
    applyView({ ...viewRef.current, x: p.originX + (event.clientX - p.startX), y: p.originY + (event.clientY - p.startY) });
  };

  const endPan = (event) => {
    if (!panStateRef.current || panStateRef.current.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    panStateRef.current = null;
    setIsPanning(false);
    setView({ ...viewRef.current });
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
            className={`relative flex-1 overflow-hidden select-none transition-[filter] duration-200 ${detailNode ? 'blur-sm' : ''} ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ touchAction: 'none' }}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.12),transparent_32%)]" />
            <div className="pointer-events-none absolute inset-0 opacity-25"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
                backgroundSize: `${92 * view.scale}px ${92 * view.scale}px`
              }}
            />

            <div ref={panContainerRef} className="absolute left-0 top-0 will-change-transform"
              style={{
                width: layout.bounds.width + VIEW_PADDING * 2,
                height: layout.bounds.height + VIEW_PADDING * 2,
                transform: `translate(${view.x}px,${view.y}px) scale(${view.scale})`,
                transformOrigin: '0 0'
              }}
            >
              {/* HTML edge connectors — same coordinate space as node buttons, no SVG offset bugs.
                  Edges grouped by source: stub + optional trunk for branching, then per-edge branch + pill. */}
              {Object.entries(
                layout.edges.reduce((acc, e) => { (acc[e.parentId] = acc[e.parentId] || []).push(e); return acc; }, {})
              ).map(([parentId, edges]) => {
                const isSourceActive = activePathIds.has(parentId);
                const { sourceX, sourceY } = edges[0];
                const STUB = 20;
                const elbowX = sourceX + STUB;
                const isMulti = edges.length > 1;
                const targetYs = edges.map(e => e.targetY);
                const minY = Math.min(...targetYs);
                const maxY = Math.max(...targetYs);
                const trunkColor = isSourceActive ? 'rgba(246,209,139,0.5)' : 'rgba(125,211,201,0.18)';
                const LINE = 16; // fixed connector line length on each side of pill

                return (
                  <React.Fragment key={parentId}>
                    {/* Horizontal stub: source right-center → elbow */}
                    <div style={{ position: 'absolute', left: sourceX, top: sourceY - 1, width: STUB, height: 2, background: trunkColor, pointerEvents: 'none' }} />

                    {/* Vertical trunk connecting all branches (branching nodes only) */}
                    {isMulti && (
                      <div style={{ position: 'absolute', left: elbowX, top: minY, width: 2, height: Math.max(2, maxY - minY), background: trunkColor, pointerEvents: 'none' }} />
                    )}

                    {edges.map(edge => {
                      const isActive = activeEdgeIds.has(edge.id);
                      const lineColor = isActive ? 'rgba(246,209,139,0.62)' : 'rgba(125,211,201,0.18)';
                      const branchStart = isMulti ? elbowX + 2 : sourceX;
                      // Pill fills the gap minus LINE px on each side — adapts to any columnGap
                      const pillWidth = edge.targetX - branchStart - LINE * 2;
                      const pillLeft = branchStart + LINE;

                      return (
                        <React.Fragment key={edge.id}>
                          {/* Left line */}
                          <div style={{ position: 'absolute', left: branchStart, top: edge.targetY - 1, width: LINE, height: 2, background: lineColor, pointerEvents: 'none' }} />

                          {/* Choice pill — full text, word-wrap, vertically centered via transform */}
                          <div style={{
                            position: 'absolute',
                            left: pillLeft,
                            top: edge.targetY,
                            transform: 'translateY(-50%)',
                            width: pillWidth,
                            borderRadius: 10,
                            border: `1px solid ${isActive ? 'rgba(246,209,139,0.38)' : 'rgba(255,255,255,0.09)'}`,
                            background: isActive ? 'rgba(26,14,8,0.96)' : 'rgba(4,4,8,0.88)',
                            fontFamily: 'Cardo, Georgia, serif',
                            fontSize: 10,
                            lineHeight: 1.55,
                            color: isActive ? '#fde68a' : 'rgba(148,163,184,0.55)',
                            textAlign: 'center',
                            padding: '5px 10px',
                            wordBreak: 'break-word',
                            pointerEvents: 'none',
                          }}>
                            {edge.choiceText || 'Continue'}
                          </div>

                          {/* Right line */}
                          <div style={{ position: 'absolute', left: edge.targetX - LINE, top: edge.targetY - 1, width: LINE, height: 2, background: lineColor, pointerEvents: 'none' }} />

                          {/* Arrowhead: tip = (targetX, targetY). CSS triangle tip is at (left+6, top+5). */}
                          <div style={{
                            position: 'absolute',
                            left: edge.targetX - 6, top: edge.targetY - 5,
                            width: 0, height: 0,
                            borderTop: '5px solid transparent',
                            borderBottom: '5px solid transparent',
                            borderLeft: `6px solid ${isActive ? 'rgba(246,209,139,0.65)' : 'rgba(125,211,201,0.25)'}`,
                            pointerEvents: 'none',
                          }} />
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {layout.nodes.map((node) => {
                const isCurrent = graph?.activeNodeId === node.id;
                const isSelected = detailNodeId === node.id;
                const isOnActivePath = activePathIds.has(node.id);
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
                        {isCurrent && (
                          <span className="rounded-full border border-emerald-300/55 bg-emerald-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-emerald-100">Current</span>
                        )}
                      </div>
                      <p className="font-cardo text-sm leading-6 text-white/70"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {getNarrativeNodeExcerpt(node)}
                      </p>
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
