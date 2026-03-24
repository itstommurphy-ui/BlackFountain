// ══════════════════════════════════════════
// SHOT LIST — SCENE ENTITY INTEGRATION
// ══════════════════════════════════════════
// Replaces _shotPopulateScenes (which re-parsed rawText
// on every modal open) with SceneEntity-backed version.
// Also stores sceneId on saved shots and auto-fills
// location/extint/cast from scene entity data.
//
// Drop AFTER shotlist.js in index.html.
// ══════════════════════════════════════════

(function () {

  // ── Patch _shotPopulateScenes ──────────────────────────────

  window._shotPopulateScenes = function (selectedId) {
    const sel = document.getElementById('shot-scene-sel');
    if (!sel) return;
    const p  = currentProject();
    SceneEntity.populateSceneSelect(sel, p, selectedId);
  };

  // ── Patch _shotSceneChange ─────────────────────────────────

  window._shotSceneChange = function () {
    const sel  = document.getElementById('shot-scene-sel');
    const data = SceneEntity.readSelectedOption(sel);
    if (!data) return;

    // Store both sceneId (stable) and scene display value
    const hiddenId  = document.getElementById('shot-scene-key');
    const hiddenNum = document.getElementById('shot-scene');
    if (hiddenId)  hiddenId.value  = data.sceneId;
    if (hiddenNum) hiddenNum.value = data.sceneNumber || data.heading;

    // Auto-fill location
    const locEl = document.getElementById('shot-location');
    if (locEl && !locEl.value && data.location) locEl.value = data.location;

    // Auto-fill ext/int
    if (data.intExt) {
      const night  = /NIGHT|DUSK|DAWN/.test(data.tod || '');
      const prefix = data.intExt.includes('EXT') && data.intExt.includes('INT') ? 'INT' : data.intExt.split('/')[0];
      const target = prefix + (night ? ' NIGHT' : ' DAY');
      const eiSel  = document.getElementById('shot-extint');
      if (eiSel) {
        for (const o of eiSel.options) {
          if (o.value === target) { eiSel.value = target; break; }
        }
      }
    }

    // Auto-fill cast from scene entity tags
    const p = currentProject();
    const cast = SceneEntity.getCastForScene(p, data.sceneId);
    const castEl = document.getElementById('shot-cast');
    if (castEl && !castEl.value && cast.length) {
      castEl.value = cast.join(', ');
    }
  };

  // ── Patch saveShot to store sceneId ───────────────────────

  const _origSaveShot = window.saveShot;
  window.saveShot = function () {
    const p   = currentProject();
    if (!p.shots) p.shots = [];

    const sceneIdEl = document.getElementById('shot-scene-key');
    const sceneId   = sceneIdEl?.value || '';

    // Build the shot object manually so we can inject sceneId
    const s = {
      scene:     document.getElementById('shot-scene').value,
      sceneId:   sceneId,
      // Keep sceneKey as heading fallback for legacy compatibility
      sceneKey:  sceneId
        ? (SceneEntity.getById(p, sceneId)?.heading || sceneId)
        : document.getElementById('shot-scene-key').value,
      setup:     document.getElementById('shot-setup').value,
      num:       document.getElementById('shot-num').value,
      type:      document.getElementById('shot-type').value,
      movement:  document.getElementById('shot-movement').value,
      extint:    document.getElementById('shot-extint').value,
      location:  document.getElementById('shot-location').value,
      sound:     document.getElementById('shot-sound').value,
      desc:      document.getElementById('shot-desc').value,
      cast:      document.getElementById('shot-cast').value,
      pages:     document.getElementById('shot-pages').value,
      length:    document.getElementById('shot-length').value,
      setuptime: document.getElementById('shot-setuptime').value,
      shoottime: document.getElementById('shot-shoottime').value,
    };

    const idx = document.getElementById('shot-edit-idx').value;
    if (idx !== '') p.shots[parseInt(idx)] = s;
    else p.shots.push(s);

    saveStore();
    closeModal('modal-shot');
    renderShotList(p);
    showToast('Shot saved', 'success');
  };

  // ── Patch addShot / editShot to use SceneEntity picker ────

  const _origAddShot = window.addShot;
  window.addShot = function () {
    document.getElementById('shot-edit-idx').value = '';
    ['scene', 'scene-key', 'setup', 'num', 'location', 'cast', 'pages', 'length', 'setuptime', 'shoottime'].forEach(f => {
      const el = document.getElementById('shot-' + f);
      if (el) el.value = '';
    });
    document.getElementById('shot-total').value = '';
    document.getElementById('shot-desc').value = '';
    _shotPopulateScenes('');
    openModal('modal-shot');
  };

  const _origEditShot = window.editShot;
  window.editShot = function (i) {
    const s = currentProject().shots[i];
    document.getElementById('shot-edit-idx').value = i;
    document.getElementById('shot-scene').value     = s.scene   || '';
    document.getElementById('shot-scene-key').value = s.sceneId || s.sceneKey || '';
    // Populate with sceneId as selectedId — falls back to heading match
    const selectedId = s.sceneId || (() => {
      const p = currentProject();
      const entity = s.sceneKey ? SceneEntity.getByHeading(p, s.sceneKey) : null;
      return entity?.id || '';
    })();
    _shotPopulateScenes(selectedId);
    document.getElementById('shot-setup').value     = s.setup    || '';
    document.getElementById('shot-num').value       = s.num      || '';
    document.getElementById('shot-type').value      = s.type     || 'CU';
    document.getElementById('shot-movement').value  = s.movement || 'Stationary';
    document.getElementById('shot-extint').value    = s.extint   || 'INT DAY';
    document.getElementById('shot-location').value  = s.location || '';
    document.getElementById('shot-sound').value     = s.sound    || 'Yes';
    document.getElementById('shot-desc').value      = s.desc     || '';
    document.getElementById('shot-cast').value      = s.cast     || '';
    document.getElementById('shot-pages').value     = s.pages    || '';
    document.getElementById('shot-length').value    = s.length   || '';
    document.getElementById('shot-setuptime').value = s.setuptime|| '';
    document.getElementById('shot-shoottime').value = s.shoottime|| '';
    calcShotTotal();
    openModal('modal-shot');
  };

  // ── Patch generateShotsFromBreakdown ──────────────────────

  const _origGenerate = window.generateShotsFromBreakdown;
  window.generateShotsFromBreakdown = function () {
    const p = currentProject();
    if (!p) return;

    const scenes = SceneEntity.getScenesForProject(p);
    if (!scenes.length) {
      showToast('No script breakdown found. Import a script first.', 'info');
      return;
    }

    if (!p.shots) p.shots = [];

    // Only add shots for scenes not already covered
    const existingSceneIds = new Set((p.shots || []).map(s => s.sceneId).filter(Boolean));
    const existingSceneKeys = new Set((p.shots || []).map(s => s.sceneKey).filter(Boolean));

    let added = 0;

    scenes.forEach((scene, idx) => {
      // Skip if already have shots for this scene (by ID or heading)
      if (existingSceneIds.has(scene.id)) return;
      if (existingSceneKeys.has(scene.heading)) return;

      const cast = SceneEntity.getCastForScene(p, scene.id);
      const castList = cast.join(', ');
      const intExt = scene.intExt || 'INT';
      const tod    = scene.tod    || 'DAY';
      const extint = `${intExt} ${tod}`.trim();

      const suggestedShots = [
        { type: 'Wide',      movement: 'Stationary', desc: `Establish scene${scene.sceneNumber ? ' ' + scene.sceneNumber : ''}` },
        { type: 'Mid/Medium',movement: 'Stationary', desc: 'Master shot — cover dialogue' },
        { type: 'Close-Up',  movement: 'Stationary', desc: 'Reaction shot' },
      ];

      suggestedShots.forEach((shot, shotIdx) => {
        const tempShot = { type: shot.type, movement: shot.movement, sound: 'Yes', cast: castList };
        const times = typeof _calcSmartTime === 'function' ? _calcSmartTime(tempShot) : { setuptime: 15, shoottime: 20 };
        p.shots.push({
          scene:     scene.sceneNumber || scene.heading,
          sceneId:   scene.id,
          sceneKey:  scene.heading, // keep for legacy display
          setup:     '1',
          num:       String(shotIdx + 1),
          type:      shot.type,
          movement:  shot.movement,
          extint,
          location:  scene.location || '',
          sound:     'Yes',
          desc:      shot.desc,
          cast:      castList,
          pages:     '',
          length:    '',
          setuptime: String(times.setuptime),
          shoottime: String(times.shoottime),
        });
        added++;
      });
    });

    saveStore();
    renderShotList(p);
    showToast(`Added ${added} suggested shots from ${scenes.length} scenes`, 'success');
  };

})();
