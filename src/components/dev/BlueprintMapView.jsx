// src/components/dev/BlueprintMapView.jsx
import React, { useState } from 'react';

// Visual Blueprint map for the Codex inspector.
// Reuses Narrative Branch View styling for consistency.
export function BlueprintMapView({ blueprint, currentPosition, targets }) {
  const [expandedArcs, setExpandedArcs] = useState({});
  const [expandedChapters, setExpandedChapters] = useState({});

  if (!blueprint) {
    return (
      <div style={{ color: '#666', fontFamily: 'monospace', fontSize: 11, padding: 12 }}>
        (planning...)
      </div>
    );
  }

  const arcs = blueprint.arcs ?? [];
  const currentArcIdx = currentPosition?.arcIndex ?? 0;
  const currentChIdx = currentPosition?.chapterIndex ?? 0;
  const currentWaveIdx = currentPosition?.sceneWaveIndex ?? 0;

  const toggleArc = (arcId) => {
    setExpandedArcs(prev => ({ ...prev, [arcId]: !prev[arcId] }));
  };

  const toggleChapter = (chId) => {
    setExpandedChapters(prev => ({ ...prev, [chId]: !prev[chId] }));
  };

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 11, padding: 8, overflow: 'auto', maxHeight: '100%' }}>
      {/* Core Question */}
      <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(0,255,136,0.08)', borderRadius: 8, border: '1px solid rgba(0,255,136,0.2)' }}>
        <div style={{ color: '#666', fontSize: 10, marginBottom: 2 }}>CORE QUESTION</div>
        <div style={{ color: '#00ff88', fontSize: 12 }}>{blueprint.coreQuestion ?? '(none)'}</div>
        {blueprint.storyIdentity && (
          <div style={{ marginTop: 6, color: '#aaa', fontSize: 10 }}>{blueprint.storyIdentity}</div>
        )}
      </div>

      {/* Targets */}
      {targets && (
        <div style={{ marginBottom: 12, padding: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
          <div style={{ color: '#666', fontSize: 10, marginBottom: 4 }}>TARGETS</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <TargetBadge label="tension" value={targets.tension} />
            <TargetBadge label="intimacy" value={targets.intimacy} />
            <TargetBadge label="mystery" value={targets.mystery} />
            <TargetBadge label="harshness" value={targets.choiceHarshness} />
            <TargetBadge label="pace" value={targets.pacing} />
            <TargetBadge label="revelation" value={targets.revelation} />
          </div>
        </div>
      )}

      {/* Arcs flow */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {arcs.map((arc, arcIdx) => {
          const chapters = arc.chapters ?? [];
          const isCurrentArc = arcIdx === currentArcIdx;
          const isPastArc = arcIdx < currentArcIdx;
          const arcExpanded = expandedArcs[arc.id] ?? true;

          return (
            <div key={arc.id}>
              {/* Arc node */}
              <div
                onClick={() => toggleArc(arc.id)}
                style={{
                  cursor: 'pointer',
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: isCurrentArc ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                  border: isCurrentArc ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: isCurrentArc ? '0 8px 24px rgba(16,185,129,0.15)' : 'none',
                  opacity: isPastArc ? 0.5 : 1,
                  marginBottom: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: '#222', marginRight: 8 }}>{arcExpanded ? '▼' : '▶'}</span>
                    <span style={{ color: isCurrentArc ? '#10f59a' : '#ccc', fontWeight: isCurrentArc ? 600 : 400 }}>
                      {arc.id}
                    </span>
                    <span style={{ color: '#666', marginLeft: 6 }}>({arc.waveRole})</span>
                  </div>
                  <div style={{ color: '#888', fontSize: 10 }}>{chapters.length} chapters</div>
                </div>
                <div style={{ color: '#888', fontSize: 10, marginTop: 4 }}>{arc.purpose}</div>
              </div>

              {/* Sub-chapters */}
              {arcExpanded && chapters.length > 0 && (
                <div style={{ marginLeft: 20, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {chapters.map((ch, chIdx) => {
                    const isCurrentCh = isCurrentArc && chIdx === currentChIdx;
                    const isPastCh = isCurrentArc ? chIdx < currentChIdx : arcIdx < currentArcIdx;
                    const isFutureCh = !isCurrentCh && !isPastCh;
                    const chExpanded = expandedChapters[ch.id] ?? (chIdx < 2);  // Show first 2

                    return (
                      <div key={ch.id}>
                        {/* Chapter node */}
                        <div
                          onClick={(e) => { e.stopPropagation(); toggleChapter(ch.id); }}
                          style={{
                            cursor: 'pointer',
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: isCurrentCh ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.02)',
                            border: isCurrentCh ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(255,255,255,0.08)',
                            boxShadow: isCurrentCh ? '0 6px 18px rgba(34,211,238,0.12)' : 'none',
                            opacity: isPastCh ? 0.4 : 1,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ color: '#555', marginRight: 8 }}>{chExpanded ? '▼' : '▶'}</span>
                              <span style={{ color: isCurrentCh ? '#22d3ee' : '#999', fontWeight: isCurrentCh ? 500 : 400 }}>
                                {ch.id}
                              </span>
                              <span style={{ color: '#666', marginLeft: 6 }}>({ch.waveRole})</span>
                            </div>
                          </div>
                          <div style={{ color: '#777', fontSize: 9, marginTop: 3 }}>{ch.purpose}</div>
                          {ch.mustResolve && (
                            <div style={{ color: '#884444', fontSize: 9, marginTop: 2 }}>
                              resolve: {ch.mustResolve}
                            </div>
                          )}
                        </div>

                        {/* SceneWave */}
                        {chExpanded && ch.sceneWave && ch.sceneWave.length > 0 && (
                          <div style={{ marginLeft: 12, marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {ch.sceneWave.map((wave, waveIdx) => {
                              const isCurrentWave = isCurrentCh && waveIdx === currentWaveIdx;
                              const isPastWave = isCurrentCh ? waveIdx < currentWaveIdx : chIdx < currentChIdx;
                              return (
                                <WaveNode
                                  key={waveIdx}
                                  wave={wave}
                                  isCurrent={isCurrentWave}
                                  isPast={isPastWave}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TargetBadge({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <span style={{ color: '#666' }}>{label}:</span>
      <span style={{ color: '#aaa' }}>{value}</span>
    </div>
  );
}

function WaveNode({ wave, isCurrent, isPast }) {
  const waveColors = {
    open: '#10f59a',
    build: '#f59e0b',
    resolve: '#f97316',
    cooldown: '#6366f1',
  };
  const color = waveColors[wave] ?? '#666';

  return (
    <div
      style={{
        padding: '3px 8px',
        borderRadius: 4,
        fontSize: 9,
        background: isCurrent ? 'rgba(255,255,255,0.1)' : 'transparent',
        border: `1px solid ${isCurrent ? color : isPast ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
        color: isCurrent ? color : isPast ? '#666' : '#555',
        boxShadow: isCurrent ? `0 0 8px ${color}40` : 'none',
        fontWeight: isCurrent ? 600 : 400,
      }}
    >
      [{wave}]
    </div>
  );
}