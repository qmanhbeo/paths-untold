// src/state/applyDeltas.js

/**
 * Applies world/arc/objective/companion updates coming back from the model.
 * Mutates the provided `mem` object (simple, predictable flow).
 */
export function applyDeltas(mem, out) {
    if (!mem || !out) return;
  
    // Location
    if (out.locationDelta?.name) mem.world.location.name = out.locationDelta.name;
    if (out.locationDelta?.addTags) {
      const set = new Set(mem.world.location.tags.concat(out.locationDelta.addTags));
      mem.world.location.tags = Array.from(set);
    }
    if (out.locationDelta?.removeTags) {
      const rm = new Set(out.locationDelta.removeTags);
      mem.world.location.tags = mem.world.location.tags.filter(t => !rm.has(t));
    }
  
    // Scene tags
    if (Array.isArray(out.sceneTags)) {
      mem.world.sceneTags = normalizeTags(out.sceneTags);
    }
  
    // Objectives
    for (const d of out.objectivesDelta || []) {
      if (d.add) mem.world.objectives.push({ id: slug(d.add), text: d.add, status: "active" });
      if (d.complete) setStatus(mem.world.objectives, d.complete, "done");
      if (d.fail) setStatus(mem.world.objectives, d.fail, "failed");
    }
  
    // Companions lifecycle/log hooks
    for (const cd of out.companionsDelta || []) {
      const c = findCompanion(mem.companions, cd.idOrName);
      if (!c) continue;
      if (cd.say) c.lastSpoken = cd.say;
      if (Array.isArray(cd.history)) {
        for (const h of cd.history) {
          if (!h || typeof h.event !== "string") continue;
          const impact = Number.isFinite(h.impact) ? h.impact : 0;
          c.relationshipHistory = (c.relationshipHistory || []).concat({
            event: h.event,
            impact,
            scene: mem.sceneIndex
          });
        }
      }
      if (cd.status) c.status = cd.status; // "active" | "phased_out" | "rejoined" | "gone"
    }
  
    // Arc / pacing
    const dArc = out.arcDelta || {};
    mem.arc.tension = clamp((mem.arc.tension ?? 3) + (dArc.tension ?? 0), 0, 10);
    mem.arc.beat = (mem.arc.beat ?? 0) + (dArc.beat ?? 0);
    if ((dArc.chapter ?? 0) > 0) {
      mem.arc.chapter = (mem.arc.chapter ?? 1) + 1;
      mem.arc.beat = 0;
      mem.arc.chapterPlan = null; // null signals GameScreen to re-plan on next turn
    }

    // Arc direction — core question and active threads
    if (dArc.coreQuestion) mem.arc.coreQuestion = dArc.coreQuestion;
    if (Array.isArray(dArc.addThreads) && dArc.addThreads.length) {
      const existing = new Set(mem.arc.activeThreads ?? []);
      for (const t of dArc.addThreads) existing.add(t);
      mem.arc.activeThreads = Array.from(existing).slice(0, 5);
    }
    if (Array.isArray(dArc.removeThreads) && dArc.removeThreads.length) {
      const dropping = new Set(dArc.removeThreads.map(s => s.toLowerCase()));
      mem.arc.activeThreads = (mem.arc.activeThreads ?? []).filter(
        t => !dropping.has(t.toLowerCase())
      );
    }

    // Chapter plan progression
    const plan = mem.arc.chapterPlan;
    if (plan) {
      if (dArc.completedBeat) {
        plan.completedBeats = [...(plan.completedBeats ?? []), dArc.completedBeat];
      }
      // Legacy: advance within old arcs[] structure
      if (dArc.advanceArc === true && Array.isArray(plan.arcs) && plan.currentArcIndex < plan.arcs.length - 1) {
        plan.currentArcIndex += 1;
      }
      // New: advance chapter stage (open → build → resolve → cooldown)
      if (dArc.advanceChapterStage === true && Array.isArray(plan.chapterStageSequence)) {
        if (plan.currentStageIndex < plan.chapterStageSequence.length - 1) {
          plan.currentStageIndex += 1;
        }
      }
    }

    // Arc plan stage progression (open → build → peak → resolve)
    const arcPlan = mem.arc.arcPlan;
    if (arcPlan && dArc.advanceArcStage === true && Array.isArray(arcPlan.arcStageSequence)) {
      if (arcPlan.currentStageIndex < arcPlan.arcStageSequence.length - 1) {
        arcPlan.currentStageIndex += 1;
      }
    }
  }
  
  /* ----------------- helpers ----------------- */
  function setStatus(list, textOrId, status) {
    const id = slug(textOrId);
    const found = list.find(o => o.id === id || slug(o.text) === id);
    if (found) found.status = status;
  }
  
  function findCompanion(cs = [], idOrName = "") {
    const s = slug(idOrName);
    return cs.find(c => c.id === s || slug(c.name) === s);
  }
  
  function normalizeTags(arr) {
    return Array.from(new Set(arr.map(s => String(s).toLowerCase().trim()))).slice(0, 8);
  }
  
  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
  
  function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  }
  