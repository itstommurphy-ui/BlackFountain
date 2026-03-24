// ══════════════════════════════════════════
// SCENE ENTITY SYSTEM
// ══════════════════════════════════════════
// Promotes parsed breakdown scenes into first-class
// objects with stable IDs stored in p.scenes[].
//
// Every shot, stripboard entry, and schedule row
// references sceneId rather than the raw heading string.
// The heading is still displayed everywhere — the link
// is just by ID so editing the script doesn't break
// downstream references.
//
// Drop this file BEFORE breakdown.js in index.html.
// ══════════════════════════════════════════

const SceneEntity = (function () {

  // ── Core: build p.scenes[] from a breakdown ───────────────

  /**
   * Generate a stable scene entity array from a breakdown object.
   * Called at breakdown-import time and whenever the script changes.
   * Returns the new scenes array (also writes it to p.scenes).
   *
   * @param {object} p       - project object
   * @param {object} bd      - breakdown object (with rawText)
   * @returns {Array}        - array of scene entity objects
   */
  function buildScenesFromBreakdown(p, bd) {
    if (!bd?.rawText) return [];

    const parsed = parseBreakdownScenes(bd.rawText);

    // Preserve existing scene IDs where heading matches (case-insensitive)
    // so re-importing the same script doesn't break downstream references
    const existing = (p.scenes || []);
    const existingByNorm = new Map(
      existing.map(s => [_normaliseHeading(s.heading), s])
    );

    const scenes = parsed.map((s, idx) => {
      const norm   = _normaliseHeading(s.heading);
      const prev   = existingByNorm.get(norm);
      return {
        id:           prev?.id || _sceneId(),
        breakdownId:  bd.id,
        heading:      s.heading,
        normHeading:  norm,
        sceneNumber:  s.sceneNumber,
        intExt:       s.intExt,
        location:     s.location,
        tod:          s.tod,
        start:        s.start,
        end:          s.end,
        lineCount:    s.lineCount,
        order:        idx,
      };
    });

    p.scenes = scenes;
    return scenes;
  }

  /**
   * Find a scene entity by its stable ID.
   * @param {object} p        - project
   * @param {string} sceneId  - scene entity ID
   * @returns {object|null}
   */
  function getById(p, sceneId) {
    return (p.scenes || []).find(s => s.id === sceneId) || null;
  }

  /**
   * Find a scene entity by heading string (normalised match).
   * Used to migrate old sceneKey string references to sceneId.
   * @param {object} p       - project
   * @param {string} heading - raw heading string
   * @returns {object|null}
   */
  function getByHeading(p, heading) {
    if (!heading) return null;
    const norm = _normaliseHeading(heading);
    return (p.scenes || []).find(s => s.normHeading === norm) || null;
  }

  /**
   * Get all scene entities for the active breakdown.
   * Falls back to re-parsing if p.scenes is empty.
   * @param {object} p - project
   * @returns {Array}
   */
  function getScenesForProject(p) {
    if (!p) return [];
    if (p.scenes?.length) return p.scenes;
    // Fallback: build from active breakdown without saving
    const bd = typeof _getActiveBd === 'function' ? _getActiveBd(p) : null;
    if (!bd?.rawText) return [];
    return parseBreakdownScenes(bd.rawText).map((s, idx) => ({
      id:          _sceneId(),
      breakdownId: bd.id,
      heading:     s.heading,
      normHeading: _normaliseHeading(s.heading),
      sceneNumber: s.sceneNumber,
      intExt:      s.intExt,
      location:    s.location,
      tod:         s.tod,
      start:       s.start,
      end:         s.end,
      lineCount:   s.lineCount,
      order:       idx,
    }));
  }

  /**
   * Get a display label for a scene entity.
   * e.g. "1 — INT. BAR / DAY" or "INT. BAR / DAY"
   * @param {object} scene
   * @returns {string}
   */
  function getLabel(scene) {
    if (!scene) return '—';
    const num  = scene.sceneNumber ? `${scene.sceneNumber} — ` : '';
    const loc  = scene.location || scene.heading;
    const tod  = scene.tod ? ` / ${scene.tod}` : '';
    const ie   = scene.intExt ? `${scene.intExt}. ` : '';
    return `${num}${ie}${loc}${tod}`;
  }

  // ── Migration ──────────────────────────────────────────────

  /**
   * One-time migration: for every project with a breakdown,
   * generate p.scenes[] and update shot sceneKey → sceneId.
   * Also migrates stripboard day.sceneKeys (heading strings)
   * to day.sceneIds (stable IDs) while keeping sceneKeys as
   * a display fallback.
   *
   * Safe to run multiple times — skips projects already migrated.
   * Call from init.js after loadStore().
   *
   * @returns {{ projects: number, scenes: number, shots: number, strips: number }}
   */
  function migrateAll() {
    let projects = 0, scenesTotal = 0, shotsTotal = 0, stripsTotal = 0;

    (store.projects || []).forEach(p => {
      // Only migrate projects that have a breakdown but no scenes yet
      if (!p.scriptBreakdowns?.length) return;
      if (p.scenes?.length) return; // already migrated

      const bd = p.scriptBreakdowns[p.scriptBreakdowns.length - 1];
      if (!bd?.rawText) return;

      const scenes = buildScenesFromBreakdown(p, bd);
      if (!scenes.length) return;

      projects++;
      scenesTotal += scenes.length;

      // Migrate shots: sceneKey (heading string) → sceneId
      (p.shots || []).forEach(shot => {
        if (shot.sceneId) return; // already migrated
        if (!shot.sceneKey) return;
        const entity = getByHeading(p, shot.sceneKey);
        if (entity) {
          shot.sceneId = entity.id;
          shotsTotal++;
        }
      });

      // Migrate stripboard: day.sceneKeys[] → day.sceneIds[]
      (p.stripboard?.days || []).forEach(day => {
        if (day.sceneIds) return; // already migrated
        day.sceneIds = [];
        (day.sceneKeys || []).forEach(key => {
          const entity = getByHeading(p, key);
          if (entity) {
            day.sceneIds.push(entity.id);
            stripsTotal++;
          } else {
            // Keep unknown keys as-is — heading string remains in sceneKeys
          }
        });
      });

      // Migrate schedule rows
      (p.schedule || []).forEach(row => {
        if (row.isDayHeader || row.sceneId) return;
        if (!row.sceneKey) return;
        const entity = getByHeading(p, row.sceneKey);
        if (entity) row.sceneId = entity.id;
      });
    });

    if (projects > 0) {
      saveStore();
      console.log(`[SceneEntity] Migrated ${projects} projects — ${scenesTotal} scenes, ${shotsTotal} shots, ${stripsTotal} stripboard entries`);
    }

    return { projects, scenes: scenesTotal, shots: shotsTotal, strips: stripsTotal };
  }

  // ── Scene dropdown HTML ────────────────────────────────────

  /**
   * Build an <option> list for a scene picker select element.
   * Uses p.scenes[] if available, falls back to parsing raw text.
   *
   * @param {object} p            - project
   * @param {string} selectedId   - currently selected sceneId
   * @returns {string}            - HTML option string
   */
  function buildSceneOptions(p, selectedId) {
    const scenes = getScenesForProject(p);
    if (!scenes.length) return '<option value="">— no scenes in breakdown —</option>';
    return '<option value="">— select scene —</option>' +
      scenes.map(s => {
        const label = getLabel(s);
        const sel   = s.id === selectedId ? ' selected' : '';
        return `<option value="${_esc(s.id)}"${sel} data-heading="${_esc(s.heading)}" data-scenenum="${_esc(s.sceneNumber||'')}" data-loc="${_esc(s.location||'')}" data-ie="${_esc(s.intExt||'')}" data-tod="${_esc(s.tod||'')}">${_esc(label)}</option>`;
      }).join('');
  }

  /**
   * Populate a <select> element with scene options.
   * Attaches data attributes so callers can auto-fill location/extint.
   *
   * @param {HTMLSelectElement} selectEl
   * @param {object} p
   * @param {string} selectedId
   */
  function populateSceneSelect(selectEl, p, selectedId) {
    if (!selectEl) return;
    selectEl.innerHTML = buildSceneOptions(p, selectedId);
  }

  /**
   * Get scene data from a selected <option> element's data attributes.
   * Use this in onchange handlers to auto-fill downstream fields.
   *
   * @param {HTMLSelectElement} selectEl
   * @returns {{ sceneId, heading, sceneNumber, location, intExt, tod } | null}
   */
  function readSelectedOption(selectEl) {
    const opt = selectEl?.options[selectEl.selectedIndex];
    if (!opt?.value) return null;
    return {
      sceneId:     opt.value,
      heading:     opt.dataset.heading     || '',
      sceneNumber: opt.dataset.scenenum    || '',
      location:    opt.dataset.loc         || '',
      intExt:      opt.dataset.ie          || '',
      tod:         opt.dataset.tod         || '',
    };
  }

  // ── Cast extraction ────────────────────────────────────────

  /**
   * Get cast names tagged in a specific scene from the breakdown.
   * @param {object} p
   * @param {string} sceneId
   * @returns {string[]}
   */
  function getCastForScene(p, sceneId) {
    const scene = getById(p, sceneId);
    if (!scene) return [];
    const bd = (p.scriptBreakdowns || []).find(b => b.id === scene.breakdownId);
    if (!bd?.rawText || !bd?.tags) return [];
    const text = bd.rawText;
    const castTags = bd.tags.filter(t =>
      t.category === 'cast' &&
      t.start >= scene.start &&
      t.start < scene.end
    );
    return [...new Set(castTags.map(t => text.slice(t.start, t.end).trim()).filter(Boolean))];
  }

  /**
   * Get all tagged elements for a scene, grouped by category.
   * @param {object} p
   * @param {string} sceneId
   * @returns {object} { cast: [], props: [], wardrobe: [], ... }
   */
  function getTagsForScene(p, sceneId) {
    const scene = getById(p, sceneId);
    if (!scene) return {};
    const bd = (p.scriptBreakdowns || []).find(b => b.id === scene.breakdownId);
    if (!bd?.rawText || !bd?.tags) return {};
    const text = bd.rawText;
    const sceneTags = bd.tags.filter(t =>
      t.start >= scene.start &&
      t.start < scene.end
    );
    const grouped = {};
    sceneTags.forEach(t => {
      if (!grouped[t.category]) grouped[t.category] = [];
      const val = text.slice(t.start, t.end).trim();
      if (val && !grouped[t.category].includes(val)) {
        grouped[t.category].push(val);
      }
    });
    return grouped;
  }

  // ── Helpers ────────────────────────────────────────────────

  function _sceneId() {
    return 'scene_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /**
   * Normalise a heading string for matching:
   * lowercase, collapse whitespace, strip trailing punctuation.
   */
  function _normaliseHeading(h) {
    return (h || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.,:;]+$/, '')
      .trim();
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&').replace(/"/g, '"').replace(/</g, '<').replace(/>/g, '>');
  }

  // ── Public API ─────────────────────────────────────────────

  return {
    buildScenesFromBreakdown,
    getById,
    getByHeading,
    getScenesForProject,
    getLabel,
    migrateAll,
    buildSceneOptions,
    populateSceneSelect,
    readSelectedOption,
    getCastForScene,
    getTagsForScene,
  };

})();

window.SceneEntity = SceneEntity;
