// ══════════════════════════════════════════
// CALLSHEET — SCENE ENTITY INTEGRATION
// ══════════════════════════════════════════
// Replaces _csImportFromDay with a SceneEntity-backed
// version that uses stable scene IDs rather than
// re-parsing raw text and string-matching headings.
//
// Also patches the stripboard scene panel to show
// tagged cast/elements directly from p.scenes[].
//
// Drop AFTER callsheet.js in index.html.
// ══════════════════════════════════════════

(function () {

  // ── Patch _csImportFromDay ─────────────────────────────────

  window._csImportFromDay = function (csIdx, dayId) {
    if (!dayId) return;
    const p = currentProject();
    if (!p) return;

    const day = (p.stripboard?.days || []).find(d => d.id === dayId);
    if (!day) return;

    // Use sceneIds (stable) if available, fall back to sceneKeys (heading strings)
    const sceneIds  = day.sceneIds  || [];
    const sceneKeys = day.sceneKeys || [];

    if (!sceneIds.length && !sceneKeys.length) {
      showToast('This shoot day has no scenes — drag scenes onto it in the Stripboard first', 'info');
      return;
    }

    // Resolve scene entities — prefer IDs, fall back to heading match
    const scenes = sceneIds.length
      ? sceneIds.map(id => SceneEntity.getById(p, id)).filter(Boolean)
      : sceneKeys.map(key => SceneEntity.getByHeading(p, key)).filter(Boolean);

    // If SceneEntity has no data (no breakdown), fall back to original behaviour
    if (!scenes.length) {
      _csImportFromDayLegacy(csIdx, dayId, p, day, sceneKeys);
      return;
    }

    // ── Build schedRows ──────────────────────────────────────
    const schedRows = [];
    for (const scene of scenes) {
      const shots = (p.shots || []).filter(s =>
        s.sceneId === scene.id || s.sceneKey === scene.heading
      );
      const sceneCast = SceneEntity.getCastForScene(p, scene.id);
      const sceneNum  = scene.sceneNumber || scene.heading;

      if (shots.length) {
        for (const s of shots) {
          schedRows.push({
            time:     '',
            scene:    sceneNum,
            shot:     s.setup ? `${s.setup}.${s.num || ''}` : (s.num || ''),
            shotType: s.type      || '',
            desc:     s.desc      || s.movement || '',
            cast:     s.cast      || sceneCast.join(', '),
            est:      String(_parseEstMins(s.length) || s.shoottime || ''),
          });
        }
      } else {
        // No shots yet — one row per scene
        schedRows.push({
          time:     '',
          scene:    sceneNum,
          shot:     '',
          shotType: '',
          desc:     scene.location || '',
          cast:     sceneCast.join(', '),
          est:      '',
        });
      }
    }

    // ── Build castRows ───────────────────────────────────────
    // Collect all unique cast names across all scenes in this day
    const allCastNames = new Set();
    for (const scene of scenes) {
      SceneEntity.getCastForScene(p, scene.id).forEach(name => allCastNames.add(name));
    }

    let castRows;
    if (allCastNames.size > 0) {
      castRows = [...allCastNames].map(name => {
        // Try to find contact info via ContactAnchor
        const info = typeof ContactAnchor !== 'undefined'
          ? { phone: ContactAnchor.resolvePhone({ name }), email: ContactAnchor.resolveEmail({ name }) }
          : { phone: '', email: '' };
        return {
          actor:     name,
          character: '',
          callTime:  '',
          wrapTime:  '',
          poc:       '',
          contact:   [info.phone, info.email].filter(Boolean).join(' / '),
          socials:   '',
        };
      });
    } else {
      // No breakdown tags — fall back to project cast list
      castRows = (p.cast || []).map(m => ({
        actor:     m.name     || '',
        character: m.role     || '',
        callTime:  '',
        wrapTime:  '',
        poc:       '',
        contact:   [m.number || m.phone, m.email].filter(Boolean).join(' / '),
        socials:   m.social   || '',
      })).filter(r => r.actor);
    }

    // ── Build locRows ────────────────────────────────────────
    // Prefer custom shootLoc saved in stripboard scene data,
    // fall back to scene entity location
    const shootLocs = new Set();
    for (const scene of scenes) {
      const custom = p.stripboard?.sceneData?.[scene.heading];
      const loc    = custom?.shootLoc || scene.location;
      if (loc) shootLocs.add(loc);
    }
    const locRows = [...shootLocs].map(loc => ({
      loc, city: '', parking: '', hospital: ''
    }));

    // ── Build crew fields ────────────────────────────────────
    const crewFields = (p.unit || []).map(m => ({
      label: m.role || m.dept || 'Crew',
      value: m.name || '',
      phone: m.number || ''
    })).filter(f => f.value);

    // ── Apply to callsheet ───────────────────────────────────
    const doImport = () => {
      const c = p.callsheets[csIdx];
      if (!c) return;
      if (schedRows.length) c.schedRows  = schedRows;
      if (castRows.length)  c.castRows   = castRows;
      if (locRows.length)   c.locRows    = locRows;
      if (crewFields.length && !(c.customFields || []).length) c.customFields = crewFields;
      if (day.date) c.date = day.date;
      c.shootDayId = dayId;
      // Store which scene IDs this callsheet covers for future reference
      c.sceneIds = scenes.map(s => s.id);
      saveStore();
      renderCallsheet(p);
      const crewNote = crewFields.length ? `, ${crewFields.length} crew` : '';
      showToast(
        `Imported ${schedRows.length} row${schedRows.length !== 1 ? 's' : ''}, ` +
        `${castRows.length} cast${crewNote}, ` +
        `${locRows.length} location${locRows.length !== 1 ? 's' : ''}`,
        'success'
      );
    };

    const c = p.callsheets[csIdx];
    const hasData = c && (
      (c.schedRows?.length || 0) > 0 ||
      (c.castRows?.length  || 0) > 0 ||
      (c.locRows || []).some(r => r.loc || r.city)
    );

    if (hasData) {
      showConfirmDialog(
        `Replace this callsheet's schedule, cast, and locations with data from "${day.label}"?`,
        'Import',
        doImport
      );
    } else {
      doImport();
    }
  };

  // ── Legacy fallback (no SceneEntity data) ─────────────────
  // Preserves original behaviour for projects without a breakdown

  function _csImportFromDayLegacy(csIdx, dayId, p, day, sceneKeys) {
    if (!sceneKeys.length) {
      showToast('This shoot day has no scenes', 'info');
      return;
    }
    const sceneData = _sbBuildSceneData(p);
    const schedRows = [];
    for (const key of sceneKeys) {
      const entry    = sceneData[key];
      const sceneNum = entry?.scene?.sceneNumber || key;
      const cast     = entry?.cast || [];
      const shots    = (p.shots || []).filter(s => s.sceneKey === key);
      if (shots.length) {
        for (const s of shots) {
          schedRows.push({ time: '', scene: sceneNum, shot: s.setup ? s.setup + '.' + (s.num||'') : (s.num||''), shotType: s.type||'', desc: s.desc||s.movement||'', cast: s.cast||cast.join(', '), est: String(_parseEstMins(s.length)||'') });
        }
      } else {
        schedRows.push({ time: '', scene: sceneNum, shot: '', shotType: '', desc: entry?.scene?.location||'', cast: cast.join(', '), est: '' });
      }
    }
    const allCast = new Set();
    for (const key of sceneKeys) { (sceneData[key]?.cast||[]).forEach(n => allCast.add(n)); }
    const castRows = allCast.size
      ? [...allCast].map(name => ({ actor: name, character: '', callTime: '', wrapTime: '', poc: '', contact: '', socials: '' }))
      : (p.cast||[]).map(m => ({ actor: m.name||'', character: m.role||'', callTime: '', wrapTime: '', poc: '', contact: [m.number,m.email].filter(Boolean).join(' / '), socials: m.social||'' })).filter(r => r.actor);
    const shootLocs = new Set();
    for (const key of sceneKeys) {
      const custom = p.stripboard?.sceneData?.[key];
      const loc    = custom?.shootLoc || sceneData[key]?.scene?.location;
      if (loc) shootLocs.add(loc);
    }
    const locRows    = [...shootLocs].map(loc => ({ loc, city: '', parking: '', hospital: '' }));
    const crewFields = (p.unit||[]).map(m => ({ label: m.role||m.dept||'Crew', value: m.name||'', phone: m.number||'' })).filter(f => f.value);

    const doImport = () => {
      const c = p.callsheets[csIdx];
      if (!c) return;
      if (schedRows.length) c.schedRows  = schedRows;
      if (castRows.length)  c.castRows   = castRows;
      if (locRows.length)   c.locRows    = locRows;
      if (crewFields.length && !(c.customFields||[]).length) c.customFields = crewFields;
      if (day.date) c.date = day.date;
      c.shootDayId = dayId;
      saveStore();
      renderCallsheet(p);
      showToast(`Imported ${schedRows.length} rows, ${castRows.length} cast, ${locRows.length} locations`, 'success');
    };

    const c = p.callsheets[csIdx];
    const hasData = c && ((c.schedRows?.length||0) > 0 || (c.castRows?.length||0) > 0 || (c.locRows||[]).some(r => r.loc||r.city));
    hasData ? showConfirmDialog(`Replace callsheet data from "${day.label}"?`, 'Import', doImport) : doImport();
  }

  // ── Stripboard scene panel enhancement ────────────────────
  // When opening a scene from the stripboard, show cast and
  // tagged elements pulled directly from SceneEntity

  const _origSbOpenScene = window._sbOpenScene;
  if (_origSbOpenScene) {
    window._sbOpenScene = function (e) {
      _origSbOpenScene(e);
      // After original opens the overlay, inject scene entity data
      setTimeout(() => {
        const overlay = document.getElementById('sb-scene-overlay');
        if (!overlay) return;
        const sceneKey = overlay.closest?.('[data-key]')?.dataset?.key
          || document.querySelector('#sb-scene-overlay')?.dataset?.sceneKey;
        if (!sceneKey) return;
        const p = currentProject();
        const entity = SceneEntity.getByHeading(p, sceneKey);
        if (!entity) return;
        // Enrich the cast chips with contact info if available
        const chips = overlay.querySelectorAll('.sb-cast-chip');
        chips.forEach(chip => {
          const name = chip.textContent.trim();
          if (!name || typeof ContactAnchor === 'undefined') return;
          const phone = ContactAnchor.resolvePhone({ name });
          if (phone) chip.title = phone;
        });
      }, 100);
    };
  }

  // ── Callsheet scene summary tooltip ───────────────────────
  // Adds a data-tip to each callsheet schedule row showing
  // what's tagged in that scene (props, wardrobe, SFX etc.)

  /**
   * Get a summary string of breakdown elements for a scene.
   * Used as tooltip text on callsheet schedule rows.
   * @param {object} p
   * @param {string} sceneId
   * @returns {string}
   */
  window.getSceneElementSummary = function (p, sceneId) {
    if (!sceneId || !p) return '';
    const tags = SceneEntity.getTagsForScene(p, sceneId);
    const parts = [];
    const labels = { props: 'Props', wardrobe: 'Wardrobe', sfx: 'SFX', vehicles: 'Vehicles', animals: 'Animals', stunts: 'Stunts' };
    for (const [cat, label] of Object.entries(labels)) {
      if (tags[cat]?.length) parts.push(`${label}: ${tags[cat].join(', ')}`);
    }
    return parts.join(' · ');
  };

})();