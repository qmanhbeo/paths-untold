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

const NarrativeBranchView = ({
  graph,
  selectedNodeId,
  onSelectNode,
  onJumpToNode,
  onClose
}) => {
  const selectedNode =
    getNarrativeNode(graph, selectedNodeId) ??
    getNarrativeNode(graph, graph?.activeNodeId);

  const layout = useMemo(() => createNarrativeGraphLayout(graph), [graph]);
  const activePathIds = useMemo(
    () => new Set(getActiveNarrativePathIds(graph)),
    [graph]
  );
  const activeEdgeIds = useMemo(() => {
    const ids = new Set();
    layout.edges.forEach((edge) => {
      if (activePathIds.has(edge.parentId) && activePathIds.has(edge.childId)) {
        ids.add(edge.id);
      }
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

  useEffect(() => {
    fitToView();
  }, [fitToView, graph?.activeNodeId, layout.nodes.length]);

  useEffect(() => {
    const handleResize = () => fitToView();
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [fitToView, onClose]);

  const zoomBy = useCallback((delta) => {
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport) return;

    setView((current) =>
      applyZoomFromPoint(
        current,
        current.scale * delta,
        { x: viewport.width / 2, y: viewport.height / 2 }
      )
    );
  }, []);

  const handleWheel = (event) => {
    event.preventDefault();

    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport) return;

    const origin = {
      x: event.clientX - viewport.left,
      y: event.clientY - viewport.top
    };

    setView((current) =>
      applyZoomFromPoint(
        current,
        current.scale * (event.deltaY > 0 ? 0.92 : 1.08),
        origin
      )
    );
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('[data-map-node]')) return;
    if (event.target.closest('[data-map-control]')) return;
    if (event.target.closest('[data-edge-label]')) return;

    panStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const panState = panStateRef.current;
    if (!panState || panState.pointerId !== event.pointerId) return;

    setView((current) => ({
      ...current,
      x: panState.originX + (event.clientX - panState.startX),
      y: panState.originY + (event.clientY - panState.startY)
    }));
  };

  const handlePointerUp = (event) => {
    if (panStateRef.current?.pointerId !== event.pointerId) return;
    panStateRef.current = null;
    setIsPanning(false);
  };

  return (
    <div className="fixed inset-4 z-50 overflow-hidden rounded-[28px] border border-amber-200/20 bg-[#06060c]/95 shadow-[0_24px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr),420px]">
        <section className="relative min-h-0 overflow-hidden border-b border-white/10 lg:border-b-0 lg:border-r">
          <div className="relative z-20 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 bg-black/30 px-6 py-5">
            <div>
              <p className="font-cardo text-xs uppercase tracking-[0.34em] text-amber-200/70">
                Paths Untold
              </p>
              <h2 className="font-berkshire text-3xl text-amber-50">Narrative Map</h2>
              <p className="mt-1 max-w-2xl font-cardo text-sm text-white/60">
                Concrete scenes become nodes. Actual choices become edges. Every detour in this
                save remains visible.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                data-map-control
                onClick={() => zoomBy(0.9)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                Zoom Out
              </button>
              <button
                data-map-control
                onClick={() => zoomBy(1.1)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                Zoom In
              </button>
              <button
                data-map-control
                onClick={fitToView}
                className="rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-2 text-sm text-amber-100 transition hover:bg-amber-300/20"
              >
                Fit View
              </button>
              <button
                data-map-control
                onClick={onClose}
                className="rounded-full border border-red-300/30 bg-red-950/40 px-3 py-2 text-sm text-red-100 transition hover:bg-red-900/60"
              >
                Close
              </button>
            </div>
          </div>

          <div
            ref={viewportRef}
            className={`relative h-[calc(100%-97px)] overflow-hidden ${
              isPanning ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onDoubleClick={fitToView}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]" />
            <div
              className="pointer-events-none absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
                backgroundSize: `${92 * view.scale}px ${92 * view.scale}px`
              }}
            />

            <div
              className="absolute left-0 top-0 will-change-transform"
              style={{
                width: layout.bounds.width + VIEW_PADDING * 2,
                height: layout.bounds.height + VIEW_PADDING * 2,
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                transformOrigin: '0 0'
              }}
            >
              <svg
                className="absolute left-0 top-0 overflow-visible"
                width={layout.bounds.width + VIEW_PADDING * 2}
                height={layout.bounds.height + VIEW_PADDING * 2}
                viewBox={`-40 -40 ${layout.bounds.width + VIEW_PADDING * 2} ${
                  layout.bounds.height + VIEW_PADDING * 2
                }`}
              >
                <defs>
                  <marker
                    id="narrative-map-arrow"
                    markerWidth="10"
                    markerHeight="10"
                    refX="8"
                    refY="5"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,0 L10,5 L0,10 z" fill="#f6d18b" />
                  </marker>
                </defs>

                {layout.edges.map((edge) => {
                  const isActiveEdge = activeEdgeIds.has(edge.id);
                  const path = createEdgePath(edge);
                  const labelX = (edge.sourceX + edge.targetX) / 2;
                  const labelY = (edge.sourceY + edge.targetY) / 2 - 14;

                  return (
                    <g key={edge.id}>
                      <path
                        d={path}
                        fill="none"
                        stroke={isActiveEdge ? '#f6d18b' : '#7dd3c9'}
                        strokeOpacity={isActiveEdge ? 0.92 : 0.32}
                        strokeWidth={isActiveEdge ? 3.6 : 2.1}
                        markerEnd="url(#narrative-map-arrow)"
                      />
                      <foreignObject
                        x={labelX - 78}
                        y={labelY - 14}
                        width="156"
                        height="48"
                        requiredExtensions="http://www.w3.org/1999/xhtml"
                      >
                        <div
                          data-edge-label
                          title={edge.choiceText}
                          className={`pointer-events-auto inline-flex max-w-[156px] items-center justify-center rounded-full border px-3 py-1 text-center font-cardo text-[11px] leading-4 ${
                            isActiveEdge
                              ? 'border-amber-200/45 bg-[#24170d]/85 text-amber-50'
                              : 'border-white/10 bg-black/60 text-white/65'
                          }`}
                        >
                          {truncate(edge.choiceText || 'Continue', 40)}
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </svg>

              {layout.nodes.map((node) => {
                const isCurrent = graph?.activeNodeId === node.id;
                const isSelected = selectedNode?.id === node.id;
                const isOnActivePath = activePathIds.has(node.id);
                const branchCount = getNarrativeOutgoingEdges(graph, node.id).length;
                const isBranching = branchCount > 1;
                const isDimmed = !isOnActivePath && !isCurrent && !isSelected;

                return (
                  <button
                    key={node.id}
                    type="button"
                    data-map-node
                    onClick={() => onSelectNode(node.id)}
                    className={`absolute overflow-hidden rounded-[22px] border p-4 text-left transition duration-200 ${
                      isSelected
                        ? 'border-amber-200/80 bg-[#1d120d]/96 shadow-[0_12px_30px_rgba(245,158,11,0.22)]'
                        : isCurrent
                          ? 'border-emerald-300/70 bg-[#0d1714]/92 shadow-[0_12px_28px_rgba(16,185,129,0.18)]'
                          : isOnActivePath
                            ? 'border-cyan-300/55 bg-[#091218]/88 shadow-[0_10px_24px_rgba(34,211,238,0.12)]'
                            : 'border-white/10 bg-black/72'
                    } ${isDimmed ? 'opacity-55 hover:opacity-85' : 'opacity-100 hover:-translate-y-0.5'}`}
                    style={{
                      left: node.position.x,
                      top: node.position.y,
                      width: layout.metrics.nodeWidth,
                      minHeight: layout.metrics.nodeHeight
                    }}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_52%)]" />

                    <div className="relative flex h-full flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-cardo text-[11px] uppercase tracking-[0.28em] text-white/45">
                            Scene {node.depth}
                          </p>
                          <h3 className="mt-1 font-berkshire text-xl leading-6 text-white">
                            {truncate(node.title || `Scene ${node.depth}`, 34)}
                          </h3>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          {isCurrent && (
                            <span className="rounded-full border border-emerald-300/55 bg-emerald-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-emerald-100">
                              Current
                            </span>
                          )}
                          {!isCurrent && isOnActivePath && (
                            <span className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-cyan-100">
                              Active Path
                            </span>
                          )}
                          {isBranching && (
                            <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-amber-100">
                              Fork x{branchCount}
                            </span>
                          )}
                        </div>
                      </div>

                      <p
                        className="font-cardo text-sm leading-6 text-white/70"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {getNarrativeNodeExcerpt(node)}
                      </p>

                      {node.choiceFromParent && (
                        <p className="mt-auto font-cardo text-xs leading-5 text-amber-100/70">
                          From: {truncate(node.choiceFromParent, 56)}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="absolute bottom-4 left-4 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 font-cardo text-xs text-white/65 backdrop-blur-sm">
              <p>Drag to pan. Scroll to zoom. Double-click empty space to fit the full story.</p>
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col bg-[linear-gradient(180deg,rgba(245,158,11,0.06),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]">
          {selectedNode ? (
            <>
              <div className="border-b border-white/10 px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-cardo text-xs uppercase tracking-[0.3em] text-amber-200/70">
                      Scene {selectedNode.depth}
                    </p>
                    <h3 className="mt-1 font-berkshire text-3xl leading-8 text-white">
                      {selectedNode.title || `Untitled Scene ${selectedNode.depth}`}
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {graph?.activeNodeId === selectedNode.id && (
                        <span className="rounded-full border border-emerald-300/45 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-emerald-100">
                          Current Timeline
                        </span>
                      )}
                      {activePathIds.has(selectedNode.id) && graph?.activeNodeId !== selectedNode.id && (
                        <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-cyan-100">
                          On Active Path
                        </span>
                      )}
                      {getNarrativeOutgoingEdges(graph, selectedNode.id).length > 1 && (
                        <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-amber-100">
                          Branch Point
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onJumpToNode(selectedNode.id)}
                    className="rounded-full border border-amber-300/45 bg-amber-300/10 px-4 py-2 font-cardo text-sm text-amber-50 transition hover:bg-amber-300/20"
                  >
                    {graph?.activeNodeId === selectedNode.id ? 'Current Scene' : 'Resume From Here'}
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <section className="rounded-[20px] border border-white/10 bg-black/30 p-4">
                  <h4 className="font-cardo text-xs uppercase tracking-[0.28em] text-amber-200/70">
                    Story
                  </h4>
                  <p className="mt-3 whitespace-pre-wrap font-cardo text-sm leading-7 text-white/88">
                    {selectedNode.story || 'No story stored for this scene.'}
                  </p>
                </section>

                <section className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                  <h4 className="font-cardo text-xs uppercase tracking-[0.28em] text-amber-200/70">
                    Summary
                  </h4>
                  <p className="mt-3 whitespace-pre-wrap font-cardo text-sm leading-7 text-white/72">
                    {selectedNode.summary || 'No summary stored for this scene.'}
                  </p>
                </section>

                <section className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-cardo text-xs uppercase tracking-[0.28em] text-amber-200/70">
                      Available Choices
                    </h4>
                    <p className="font-cardo text-xs text-white/45">
                      Reusing a taken choice follows its existing branch.
                    </p>
                  </div>

                  {selectedNode.choices?.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {selectedNode.choices.map((choice, index) => {
                        const childId = findChildNodeId(graph, selectedNode.id, choice, index);
                        const childNode = childId ? getNarrativeNode(graph, childId) : null;

                        return (
                          <li
                            key={`${selectedNode.id}-${index}`}
                            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
                          >
                            <p className="font-cardo text-sm leading-6 text-white/85">{choice}</p>
                            <p className="mt-2 font-cardo text-xs text-white/50">
                              {childNode
                                ? `Existing branch leads to Scene ${childNode.depth}`
                                : 'Unexplored from this node'}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-3 font-cardo text-sm leading-6 text-white/55">
                      This scene has no stored choices. Older converted saves only preserve
                      complete choice history for nodes created after the graph system existed.
                    </p>
                  )}
                </section>

                <section className="space-y-3">
                  <details className="rounded-[18px] border border-white/10 bg-black/15 p-4">
                    <summary className="cursor-pointer font-cardo text-sm uppercase tracking-[0.22em] text-amber-100/85">
                      Prompt
                    </summary>
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs leading-6 text-white/65">
                      {selectedNode.prompt || 'Prompt not stored for this scene.'}
                    </pre>
                  </details>

                  <details className="rounded-[18px] border border-white/10 bg-black/15 p-4">
                    <summary className="cursor-pointer font-cardo text-sm uppercase tracking-[0.22em] text-amber-100/85">
                      Parsed Packet
                    </summary>
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs leading-6 text-white/65">
                      {selectedNode.packet && Object.keys(selectedNode.packet).length > 0
                        ? JSON.stringify(selectedNode.packet, null, 2)
                        : 'No parsed packet stored for this scene.'}
                    </pre>
                  </details>

                  <details className="rounded-[18px] border border-white/10 bg-black/15 p-4">
                    <summary className="cursor-pointer font-cardo text-sm uppercase tracking-[0.22em] text-amber-100/85">
                      Raw Output
                    </summary>
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs leading-6 text-white/65">
                      {selectedNode.rawOutput || 'No raw output stored for this scene.'}
                    </pre>
                  </details>
                </section>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center font-cardo text-white/55">
              Select a scene node to inspect the full prose, choices, and debug artifacts.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default NarrativeBranchView;
