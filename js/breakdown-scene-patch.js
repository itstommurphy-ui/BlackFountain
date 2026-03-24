// ══════════════════════════════════════════
// BREAKDOWN → SCENE ENTITY INTEGRATION
// ══════════════════════════════════════════
// Patches _createBreakdown so p.scenes[] is always
// built/updated whenever a script is imported.
// Also patches clearBreakdownScript to clean up scenes.
//
// Drop AFTER breakdown.js in index.html.
// ══════════════════════════════════════════

(function () {

  // Store reference to original _createBreakdown
  const _origCreateBreakdown = window._createBreakdown;

  /**
   * Patched _createBreakdown — calls SceneEntity.buildScenesFromBreakdown
   * immediately after the breakdown object is created and pushed.
   */
  window._createBreakdown = function (p, name, version, rawText, scriptId) {
    // Call original to create and push the breakdown object
    const bd = _origCreateBreakdown(p, name, version, rawText, scriptId);
    if (!bd || !rawText) return bd;

    // Build stable scene entities from the new breakdown
    const scenes = SceneEntity.buildScenesFromBreakdown(p, bd);
    if (scenes.length) {
      console.log(`[SceneEntity] Built ${scenes.length} scene entities for "${name}"`);
      // saveStore is called by the caller after _createBreakdown returns,
      // so scenes will be persisted automatically.
    }
    return bd;
  };

  // ── Re-import: rebuild scenes when switching active breakdown ──

  const _origSelectBreakdown = window._selectBreakdown;
  window._selectBreakdown = function (id) {
    _origSelectBreakdown(id);
    const p = currentProject();
    if (!p) return;
    const bd = _getActiveBd(p);
    if (bd?.rawText) {
      SceneEntity.buildScenesFromBreakdown(p, bd);
      // Don't save here — user hasn't changed anything, just switched view
    }
  };

  // ── Clear: remove scenes when breakdown is deleted ─────────

  const _origClearScript = window.clearBreakdownScript;
  window.clearBreakdownScript = function () {
    // We need to intercept after the breakdown is removed
    // Wrap the confirm dialog callback
    const p = currentProject();
    const bd = _getActiveBd(p);
    const bdId = bd?.id;

    showConfirmDialog('Delete this breakdown and all tags? This cannot be undone.', 'Delete', () => {
      if (!p || !bdId) return;
      p.scriptBreakdowns = (p.scriptBreakdowns || []).filter(b => b.id !== bdId);
      // Remove scene entities that belonged to this breakdown
      p.scenes = (p.scenes || []).filter(s => s.breakdownId !== bdId);
      // Clear sceneId from shots that referenced this breakdown's scenes
      // (leave sceneKey as fallback display)
      (p.shots || []).forEach(shot => {
        if (shot.sceneId) {
          const stillExists = (p.scenes || []).some(s => s.id === shot.sceneId);
          if (!stillExists) delete shot.sceneId;
        }
      });
      _activeBreakdownId = null;
      saveStore();
      renderBreakdown(p);
    });
  };

})();
