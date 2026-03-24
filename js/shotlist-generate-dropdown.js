// ══════════════════════════════════════════
// SHOT LIST — SMART GENERATE DROPDOWN
// ══════════════════════════════════════════
// Replaces the single "⚡ Generate" button with a
// dropdown offering multiple generation strategies.
//
// Drop AFTER shotlist.js in index.html.
// Patches renderShotList to inject the dropdown button.
// ══════════════════════════════════════════

(function () {

  // ── Sort strategies ────────────────────────────────────────

  const STRATEGIES = [
    {
      id:    'scene',
      label: 'Scene Order',
      icon:  '📄',
      desc:  'Follow script order — good for continuity-heavy drama',
      sort:  (scenes) => scenes, // no reorder
    },
    {
      id:    'optimised',
      label: 'Optimised',
      icon:  '⚡',
      desc:  'Group by location + lighting — minimises company moves',
      sort:  (scenes) => {
        const todScores = _buildTodScores(scenes);
        return [...scenes].sort((a, b) => {
          const locA = (a.location || '').toLowerCase();
          const locB = (b.location || '').toLowerCase();
          if (locA !== locB) return locA.localeCompare(locB);
          const ieA = _ieScore(a.intExt);
          const ieB = _ieScore(b.intExt);
          if (ieA !== ieB) return ieA - ieB;
          const todA = todScores.get(a.id);
          const todB = todScores.get(b.id);
          if (todA !== todB) return todA - todB;
          // Keep relative scenes adjacent to their predecessor
          return a.order - b.order;
        });
      },
    },
    {
      id:    'location',
      label: 'Location First',
      icon:  '📍',
      desc:  'Strict location grouping — good when locations are time-limited',
      sort:  (scenes) => [...scenes].sort((a, b) => {
        const locA = (a.location || '').toLowerCase();
        const locB = (b.location || '').toLowerCase();
        if (locA !== locB) return locA.localeCompare(locB);
        return a.order - b.order;
      }),
    },
    {
      id:    'cast',
      label: 'Cast First',
      icon:  '🎭',
      desc:  'Group by cast members needed — minimises individual actor days',
      sort:  (scenes, p) => {
        // Score each scene by its cast fingerprint
        // Scenes sharing the most cast members cluster together
        const castMap = {};
        scenes.forEach(s => {
          const cast = SceneEntity.getCastForScene(p, s.id);
          castMap[s.id] = cast.sort().join(',');
        });
        return [...scenes].sort((a, b) => {
          const ca = castMap[a.id] || '';
          const cb = castMap[b.id] || '';
          if (ca !== cb) return ca.localeCompare(cb);
          return a.order - b.order;
        });
      },
    },
    {
      id:    'lighting',
      label: 'Lighting Order',
      icon:  '☀️',
      desc:  'DAY → DUSK → NIGHT within each location — good for natural light shoots',
      sort:  (scenes) => {
        const todScores = _buildTodScores(scenes);
        return [...scenes].sort((a, b) => {
          // Location first
          const locA = (a.location || '').toLowerCase();
          const locB = (b.location || '').toLowerCase();
          if (locA !== locB) return locA.localeCompare(locB);
          // Then TOD within location (relative scenes inherit predecessor's score)
          const todA = todScores.get(a.id);
          const todB = todScores.get(b.id);
          if (todA !== todB) return todA - todB;
          // Then original script order to keep relative scenes adjacent
          return a.order - b.order;
        });
      },
    },
  ];

  // ── Score helpers ──────────────────────────────────────────

  function _ieScore(ie) {
    if (!ie) return 2;
    if (ie.startsWith('INT')) return 0;
    if (ie.startsWith('EXT')) return 1;
    return 2;
  }

  function _todScore(tod) {
    if (!tod) return 1;
    const t = tod.toUpperCase();
    if (/MORNING|DAWN|SUNRISE|EARLY/.test(t))        return 0;
    if (/DAY|NOON|MIDDAY|AFTERNOON/.test(t))          return 1;
    if (/DUSK|SUNSET|GOLDEN|MAGIC|TWILIGHT/.test(t)) return 2;
    if (/EVENING/.test(t))                            return 3;
    if (/NIGHT|MIDNIGHT/.test(t))                     return 4;
    return 1; // unknown/relative — handled by _buildTodScores
  }

  const RELATIVE_TOD = /^(CONTINUOUS|LATER|MOMENTS LATER|SAME TIME|SAME|INTERCUT)$/i;

  function _isRelativeTod(tod) {
    return !tod || RELATIVE_TOD.test(tod.trim());
  }

  function _buildTodScores(scenes) {
    const inOrder  = [...scenes].sort((a, b) => a.order - b.order);
    const scores   = new Map();
    let lastScore  = 1;
    inOrder.forEach(s => {
      if (_isRelativeTod(s.tod)) {
        scores.set(s.id, lastScore);
      } else {
        const sc = _todScore(s.tod);
        scores.set(s.id, sc);
        lastScore = sc;
      }
    });
    return scores;
  }

  // ── Core generation ────────────────────────────────────────

  function _generateWithStrategy(strategyId) {
    const p = currentProject();
    if (!p) return;

    const scenes = SceneEntity.getScenesForProject(p);
    if (!scenes.length) {
      showToast('No script breakdown found. Import a script first.', 'info');
      return;
    }

    const strategy = STRATEGIES.find(s => s.id === strategyId) || STRATEGIES[0];
    const sorted   = strategy.sort(scenes, p);

    if (!p.shots) p.shots = [];

    const existingSceneIds  = new Set((p.shots || []).map(s => s.sceneId).filter(Boolean));
    const existingSceneKeys = new Set((p.shots || []).map(s => s.sceneKey).filter(Boolean));

    let added = 0;

    sorted.forEach((scene) => {
      if (existingSceneIds.has(scene.id))       return;
      if (existingSceneKeys.has(scene.heading)) return;

      const cast     = SceneEntity.getCastForScene(p, scene.id);
      const tags     = SceneEntity.getTagsForScene(p, scene.id);
      const castList = cast.join(', ');
      const intExt   = scene.intExt || 'INT';
      const tod      = scene.tod    || 'DAY';
      const extint   = `${intExt} ${tod}`.trim();

      // Smart shot suggestions based on scene complexity
      const shots = _suggestShots(scene, cast, tags);

      shots.forEach((shot, shotIdx) => {
        const tempShot = { type: shot.type, movement: shot.movement, sound: 'Yes', cast: castList };
        const times    = typeof _calcSmartTime === 'function'
          ? _calcSmartTime(tempShot)
          : { setuptime: 15, shoottime: 20 };

        p.shots.push({
          scene:     scene.sceneNumber || scene.heading,
          sceneId:   scene.id,
          sceneKey:  scene.heading,
          setup:     String(shotIdx + 1),
          num:       '1',
          type:      shot.type,
          movement:  shot.movement,
          extint,
          location:  scene.location || '',
          sound:     shot.mos ? 'MOS' : 'Yes',
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

    const strategyLabel = strategy.label.toLowerCase();
    showToast(
      `Generated ${added} shots across ${sorted.length} scenes (${strategyLabel})`,
      'success'
    );
  }

  // ── Smart shot suggestions ────────────────────────────────

  function _suggestShots(scene, cast, tags) {
    const shots = [];
    const hasStunts  = !!(tags.stunts?.length);
    const hasSFX     = !!(tags.sfx?.length);
    const hasVehicle = !!(tags.vehicles?.length);
    const castCount  = cast.length;
    const isShort    = (scene.lineCount || 0) < 10;
    const isLong     = (scene.lineCount || 0) > 40;

    // Every scene gets a wide/establishing
    shots.push({
      type:     isShort ? 'Wide' : 'Establishing',
      movement: 'Stationary',
      desc:     `Establish ${scene.location || 'scene'}`,
    });

    // Medium/master — skip for very short scenes
    if (!isShort) {
      shots.push({
        type:     'Mid/Medium',
        movement: 'Stationary',
        desc:     'Master shot',
      });
    }

    // Coverage — one close-up per cast member for longer scenes
    if (castCount >= 2) {
      shots.push({
        type:     'Close-Up',
        movement: 'Stationary',
        desc:     'Coverage / reactions',
      });
    }

    // OTS for dialogue scenes with 2+ cast
    if (castCount >= 2 && !isShort) {
      shots.push({
        type:     'Over-the-Shoulder',
        movement: 'Stationary',
        desc:     'Dialogue coverage',
      });
    }

    // Extra setup shot for stunts/SFX
    if (hasStunts || hasSFX) {
      shots.push({
        type:     'Wide',
        movement: 'Stationary',
        desc:     hasStunts ? 'Stunt coverage — safety wide' : 'SFX coverage',
      });
    }

    // Insert for vehicle scenes
    if (hasVehicle) {
      shots.push({
        type:     'Insert',
        movement: 'Stationary',
        desc:     'Vehicle insert',
        mos:      true,
      });
    }

    // B-roll for long scenes
    if (isLong) {
      shots.push({
        type:     'B-Roll',
        movement: 'Handheld',
        desc:     'B-roll / cutaways',
      });
    }

    return shots;
  }

  // ── Inject dropdown button ────────────────────────────────
  // Replaces the existing ⚡ Generate button in the shot list
  // toolbar with a dropdown version.

  function _injectGenerateDropdown() {
    // Find the existing generate button
    const existing = document.querySelector('#section-shotlist button[onclick="generateShotsFromBreakdown()"]');
    if (!existing || existing.dataset.patched) return;

    existing.dataset.patched = '1';
    existing.removeAttribute('onclick');
    existing.title = 'Generate shots from breakdown';

    // Add dropdown arrow
    existing.innerHTML = '⚡ Generate ▾';

    existing.addEventListener('click', (e) => {
      e.stopPropagation();
      _toggleGenerateMenu(existing);
    });
  }

  let _menuOpen = false;

  function _toggleGenerateMenu(anchor) {
    _closeGenerateMenu();
    if (_menuOpen) { _menuOpen = false; return; }
    _menuOpen = true;

    const menu = document.createElement('div');
    menu.id = '_gen-menu';
    menu.style.cssText = [
      'position:fixed',
      'background:var(--surface)',
      'border:1px solid var(--border)',
      'border-radius:var(--radius)',
      'box-shadow:var(--shadow-lg)',
      'z-index:9000',
      'min-width:260px',
      'overflow:hidden',
      'font-size:12px',
    ].join(';');

    STRATEGIES.forEach(s => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:10px 14px;cursor:pointer;display:flex;flex-direction:column;gap:2px;border-bottom:1px solid var(--border2)';
      item.innerHTML = `
        <div style="display:flex;align-items:center;gap:7px;font-weight:600;color:var(--text)">
          <span>${s.icon}</span><span>${_esc(s.label)}</span>
        </div>
        <div style="font-size:10px;color:var(--text3);padding-left:21px">${_esc(s.desc)}</div>`;
      item.onmouseenter = () => item.style.background = 'var(--surface2)';
      item.onmouseleave = () => item.style.background = '';
      item.onclick = (e) => {
        e.stopPropagation();
        _closeGenerateMenu();
        _generateWithStrategy(s.id);
      };
      menu.appendChild(item);
    });

    document.body.appendChild(menu);

    // Position below the anchor button
    const rect = anchor.getBoundingClientRect();
    menu.style.top  = (rect.bottom + 4) + 'px';
    menu.style.left = rect.left + 'px';
    // Clamp to viewport
    const mw = menu.offsetWidth;
    if (rect.left + mw > window.innerWidth - 8) {
      menu.style.left = Math.max(8, window.innerWidth - mw - 8) + 'px';
    }
  }

  function _closeGenerateMenu() {
    document.getElementById('_gen-menu')?.remove();
    _menuOpen = false;
  }

  document.addEventListener('click', _closeGenerateMenu);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') _closeGenerateMenu(); });

  // ── Patch renderShotList to inject button after render ─────

  const _origRenderShotList = window.renderShotList;
  if (_origRenderShotList) {
    window.renderShotList = function (p) {
      _origRenderShotList(p);
      setTimeout(_injectGenerateDropdown, 0);
    };
  }

  // Also try on showSection
  const _origShowSection2 = window.showSection;
  if (_origShowSection2) {
    window.showSection = function (name) {
      _origShowSection2(name);
      if (name === 'shotlist') setTimeout(_injectGenerateDropdown, 100);
    };
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
  }

})();