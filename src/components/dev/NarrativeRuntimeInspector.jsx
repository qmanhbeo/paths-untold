// src/components/dev/NarrativeRuntimeInspector.jsx
import React, { useState, useEffect } from 'react';
import { BlueprintMapView } from './BlueprintMapView';

// Dev-only Narrative Runtime Inspector — shows full narrative state in one panel.
// Only rendered in development mode.
export function NarrativeRuntimeInspector({ memory, sceneIndex, storyOptions }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('blueprint');

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const handleKey = (e) => {
      if (e.key === 'F2' || e.key === '`') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (!import.meta.env.DEV) return null;

  const world = memory?.world ?? {};
  const arc = memory?.arc ?? {};
  const blueprint = arc?.storyBlueprint ?? null;
  const companions = memory?.companions ?? [];
  const objectives = world?.objectives ?? [];
  const sceneLog = memory?.sceneLog ?? [];
  const activeThreads = arc?.activeThreads ?? [];

  // Current position from blueprint
  let currentPosition = null;
  let targets = null;

  if (blueprint) {
    const arcs = blueprint.arcs ?? [];
    const currentArc = arcs[blueprint.currentArcIndex ?? 0];
    if (currentArc) {
      const chapters = currentArc.chapters ?? [];
      const currentCh = chapters[currentArc.currentChapterIndex ?? 0];
      if (currentCh) {
        currentPosition = {
          arcIndex: blueprint.currentArcIndex ?? 0,
          chapterIndex: currentArc.currentChapterIndex ?? 0,
          sceneWaveIndex: currentCh.currentSceneIndex ?? 0,
        };
        targets = currentCh.targets;
      }
    }
  }

  return (
    <>
      {/* Dev button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          top: 8,
          right: 8,
          zIndex: 9999,
          background: '#1a1a2e',
          color: '#00ff88',
          border: '1px solid #00ff88',
          padding: '4px 10px',
          fontSize: 11,
          fontFamily: 'monospace',
          cursor: 'pointer',
          opacity: 0.7,
        }}
        title="Press F2 or ` to toggle"
      >
        Codex
      </button>

      {/* Inspector panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: 420,
            height: '100vh',
            background: 'rgba(10, 10, 20, 0.97)',
            color: '#e0e0e0',
            fontFamily: 'monospace',
            fontSize: 11,
            zIndex: 9998,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid #333',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #333',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ color: '#00ff88', fontWeight: 'bold', fontSize: 12 }}>
              Narrative Inspector {blueprint ? '' : '(planning...)'}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #333',
            }}
          >
            <Tab
              label="Blueprint Map"
              active={activeTab === 'blueprint'}
              onClick={() => setActiveTab('blueprint')}
            />
            <Tab
              label="Raw State"
              active={activeTab === 'raw'}
              onClick={() => setActiveTab('raw')}
            />
            <Tab
              label="Evaluation"
              active={activeTab === 'evaluation'}
              onClick={() => setActiveTab('evaluation')}
            />
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {activeTab === 'blueprint' ? (
              <BlueprintMapView
                blueprint={blueprint}
                currentPosition={currentPosition}
                targets={targets}
              />
            ) : activeTab === 'evaluation' ? (
              <EvaluationView evaluation={memory?._lastEvaluation} />
            ) : (
              <RawStateView
                world={world}
                arc={arc}
                sceneIndex={sceneIndex}
                companions={companions}
                objectives={objectives}
                activeThreads={activeThreads}
                sceneLog={sceneLog}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 12px',
        background: active ? 'rgba(0,255,136,0.1)' : 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid #00ff88' : '2px solid transparent',
        color: active ? '#00ff88' : '#666',
        cursor: 'pointer',
        fontFamily: 'monospace',
        fontSize: 11,
      }}
    >
      {label}
    </button>
  );
}

function RawStateView({ world, arc, sceneIndex, companions, objectives, activeThreads, sceneLog }) {
  const [expanded, setExpanded] = useState({});

  const toggle = (key) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isExpanded = (key) => expanded[key] ?? true;

  return (
    <div style={{ padding: 8, fontSize: 10 }}>
      {/* Runtime Position */}
      <Section title="Runtime Position" expanded={expanded} toggle={toggle}>
        <div>scene: {sceneIndex ?? 0}</div>
        <div>location: {world?.location?.name ?? 'unknown'}</div>
        <div>time: {world?.clock?.day}d / {world?.clock?.time}</div>
        <div>arc: ch{arc?.chapter ?? 1}/beat{arc?.beat ?? 0}</div>
        <div>tension: {arc?.tension ?? 3}</div>
      </Section>

      {/* Memory */}
      <Section title="Memory" expanded={expanded} toggle={toggle}>
        <div>threads: {activeThreads.length}</div>
        {activeThreads.map((t, i) => (
          <div key={i} style={{ marginLeft: 8, color: '#888' }}>• {t.slice(0, 30)}...</div>
        ))}
        <div>objectives: {objectives.length}</div>
        {objectives.map((o, i) => (
          <div key={i} style={{ marginLeft: 8, color: '#888' }}>• {o.slice(0, 30)}...</div>
        ))}
        <div>companions: {companions.length}</div>
        {companions.map((c, i) => (
          <div key={i} style={{ marginLeft: 8, color: '#888' }}>
            • {c.name}: {c.relationship ?? 'neutral'}
          </div>
        ))}
      </Section>

      {/* Scene Log */}
      <Section title="Scene Log (last 5)" expanded={expanded} toggle={toggle}>
        {sceneLog.length === 0 ? (
          <div style={{ color: '#666' }}>(empty)</div>
        ) : (
          sceneLog.slice(-5).map((entry, i) => (
            <div key={i} style={{ marginBottom: 6, borderBottom: '1px solid #222', paddingBottom: 4 }}>
              <div style={{ color: '#666' }}>scene {entry.sceneIndex}</div>
              <div style={{ color: '#aaa' }}>ch: {entry.choice?.slice(0, 25)}...</div>
            </div>
          ))
        )}
      </Section>

      {/* Raw JSON */}
      <Section title="Raw JSON" expanded={expanded} toggle={toggle}>
        <pre style={{ fontSize: 9, overflow: 'auto', maxHeight: 300 }}>
          {JSON.stringify({ world, arc, sceneIndex }, null, 2)}
        </pre>
      </Section>
    </div>
  );
}

function Section({ title, expanded, toggle, children }) {
  const isExpanded = expanded[title] ?? true;
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={() => toggle(title)}
        style={{ cursor: 'pointer', color: '#00ff88', marginBottom: 2 }}
      >
        {isExpanded ? '▼' : '▶'} {title}
      </div>
      {isExpanded && <div style={{ marginLeft: 8 }}>{children}</div>}
    </div>
  );
}

function EvaluationView({ evaluation }) {
  if (!evaluation) {
    return (
      <div style={{ padding: 12, color: '#666' }}>
        No evaluation yet. Play scenes to generate evaluation scores.
      </div>
    );
  }

  const formatScore = (val) => {
    if (typeof val !== 'number') return '—';
    // Handle both 0-1 and 0-10 scales
    if (val <= 1) return val.toFixed(2);
    return Math.round(val);
  };

  const scoreColor = (val) => {
    if (typeof val !== 'number') return '#666';
    // 0-10: good >= 7, ok >= 4, else low
    // 0-1: good >= 0.7, ok >= 0.4
    const normalized = val <= 1 ? val : val / 10;
    if (normalized >= 0.7) return '#00ff88';
    if (normalized >= 0.4) return '#ffaa00';
    return '#ff4444';
  };

  return (
    <div style={{ padding: 12, fontSize: 11 }}>
      <div style={{ marginBottom: 12, color: '#aaa' }}>EVALUATION</div>

      <div style={{ marginBottom: 8 }}>
        <span style={{ color: '#888' }}>waveMatch: </span>
        <span style={{ color: scoreColor(evaluation.waveMatch) }}>{formatScore(evaluation.waveMatch)}</span>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span style={{ color: '#888' }}>continuity: </span>
        <span style={{ color: scoreColor(evaluation.continuity) }}>{formatScore(evaluation.continuity)}</span>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span style={{ color: '#888' }}>stakesProgression: </span>
        <span style={{ color: scoreColor(evaluation.stakesProgression) }}>{formatScore(evaluation.stakesProgression)}</span>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span style={{ color: '#888' }}>choiceFit: </span>
        <span style={{ color: scoreColor(evaluation.choiceFit) }}>{formatScore(evaluation.choiceFit)}</span>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span style={{ color: '#888' }}>mysteryControl: </span>
        <span style={{ color: scoreColor(evaluation.mysteryControl) }}>{formatScore(evaluation.mysteryControl)}</span>
      </div>

      {evaluation.notes && (
        <div style={{ marginTop: 12, padding: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4 }}>
          <div style={{ color: '#666', marginBottom: 4 }}>notes:</div>
          <div style={{ color: '#ccc' }}>{evaluation.notes}</div>
        </div>
      )}
    </div>
  );
}