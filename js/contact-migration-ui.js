// ══════════════════════════════════════════
// CONTACT ANCHOR — MIGRATION UI (v2 — grouped by name)
// ══════════════════════════════════════════

function openContactMigrationModal() {
  const MODAL_ID = 'modal-contact-migration';
  document.getElementById(MODAL_ID)?.remove();

  // Gather all unlinked rows with project context
  const unlinked = [];
  (store.projects || []).forEach(p => {
    (p.cast || []).forEach((row, i) => {
      if (!row.contactId && row.name?.trim())
        unlinked.push({ row, project: p, arrayKey: 'cast', idx: i });
    });
    (p.extras || []).forEach((row, i) => {
      if (!row.contactId && row.name?.trim())
        unlinked.push({ row, project: p, arrayKey: 'extras', idx: i });
    });
    (p.callsheets || []).forEach((cs, ci) => {
      (cs.crew || []).forEach((row, i) => {
        if (!row.contactId && row.name?.trim())
          unlinked.push({ row, project: p, csIdx: ci, arrayKey: 'crew', idx: i });
      });
      (cs.cast || []).forEach((row, i) => {
        if (!row.contactId && row.name?.trim())
          unlinked.push({ row, project: p, csIdx: ci, arrayKey: 'cs-cast', idx: i });
      });
    });
  });

  if (!unlinked.length) {
    showToast('All cast & crew are already linked to contacts ✓', 'success');
    return;
  }

  // Group by name — multiple rows with the same name = one UI entry
  const groupMap = new Map();
  unlinked.forEach(entry => {
    const key = entry.row.name.trim().toLowerCase();
    if (!groupMap.has(key)) {
      const suggestions = ContactAnchor.searchContacts(entry.row.name, 3);
      const bestMatch   = suggestions[0] || null;
      groupMap.set(key, {
        name:        entry.row.name.trim(),
        entries:     [],
        suggestions,
        bestMatch,
        action:      bestMatch ? 'link' : 'create',
        chosenId:    bestMatch?.id || null,
      });
    }
    groupMap.get(key).entries.push(entry);
  });

  const groups  = [...groupMap.values()];
  const choices = groups.map(g => ({ action: g.action, chosenId: g.chosenId }));

  function esc(s) { return String(s||'').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>'); }

  function buildGroupHtml(g, i) {
    const c = choices[i];

    const projectTitles = [...new Set(g.entries.map(e => e.project.title))];
    const typeCounts    = { cast: 0, extras: 0, crew: 0 };
    g.entries.forEach(e => {
      if      (e.arrayKey === 'cast')   typeCounts.cast++;
      else if (e.arrayKey === 'extras') typeCounts.extras++;
      else                              typeCounts.crew++;
    });
    const typeStr = [
      typeCounts.cast   && `${typeCounts.cast} cast`,
      typeCounts.extras && `${typeCounts.extras} extra${typeCounts.extras>1?'s':''}`,
      typeCounts.crew   && `${typeCounts.crew} crew`,
    ].filter(Boolean).join(', ');

    const projectBadges = projectTitles.map(t =>
      `<span style="font-size:10px;background:var(--surface3);border-radius:3px;padding:1px 6px;color:var(--text3)">${esc(t)}</span>`
    ).join(' ');

    const countBadge = g.entries.length > 1
      ? `<span style="font-size:10px;background:var(--accent);color:var(--bg);border-radius:3px;padding:1px 6px;font-weight:600">${g.entries.length} rows</span>`
      : '';

    const actionBtns = `
      <button onclick="_cmSetAction(${i},'link')"   class="btn btn-sm${c.action==='link'   ?' btn-primary':''}" ${!g.suggestions.length?'disabled':''}>Link</button>
      <button onclick="_cmSetAction(${i},'create')" class="btn btn-sm${c.action==='create' ?' btn-primary':''}">Create New</button>
      <button onclick="_cmSetAction(${i},'skip')"   class="btn btn-sm${c.action==='skip'   ?'':' btn-ghost'}">Skip</button>`;

    const matchHtml = c.action === 'link' && g.suggestions.length
      ? `<select class="form-select" style="font-size:11px;margin-top:4px" onchange="_cmChoose(${i},this.value)">
          ${g.suggestions.map(s => `<option value="${esc(s.id)}" ${s.id===c.chosenId?'selected':''}>${esc(s.name)}${s.phone?' · '+esc(s.phone):''}${s.email?' · '+esc(s.email):''}</option>`).join('')}
         </select>`
      : c.action === 'create'
      ? `<span style="font-size:11px;color:var(--text3)">Will create a new contact: <strong>${esc(g.name)}</strong>${g.entries.length>1?' (applied to all '+g.entries.length+' rows)':''}</span>`
      : `<span style="font-size:11px;color:var(--text3)">Will be left unlinked</span>`;

    return `<div id="cmrow_${i}" style="padding:10px 14px;border-bottom:1px solid var(--border2);display:flex;flex-direction:column;gap:5px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-weight:600;font-size:13px">${esc(g.name)}</span>
          ${countBadge}
          <span style="font-size:11px;color:var(--text3)">${esc(typeStr)}</span>
          ${projectBadges}
        </div>
        <div style="display:flex;gap:4px">${actionBtns}</div>
      </div>
      <div id="cmrow_detail_${i}">${matchHtml}</div>
    </div>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:640px;display:flex;flex-direction:column;max-height:85vh">
      <div class="modal-header" style="flex-shrink:0">
        <div>
          <h3>LINK CAST & CREW TO CONTACTS</h3>
          <p style="font-size:12px;color:var(--text3);margin:4px 0 0">${groups.length} ${groups.length===1?'person':'people'} across your projects (${unlinked.length} rows total)</p>
        </div>
        <button class="modal-close" onclick="document.getElementById('${MODAL_ID}').remove()">✕</button>
      </div>
      <div style="padding:10px 14px;background:var(--surface2);border-bottom:1px solid var(--border);font-size:11px;color:var(--text3);flex-shrink:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span style="flex:1">Linking connects people across sections so phone/email stays in sync.</span>
        <button onclick="_cmSetAllActions('link')"   class="btn btn-sm">All: Link</button>
        <button onclick="_cmSetAllActions('create')" class="btn btn-sm">All: Create</button>
        <button onclick="_cmSetAllActions('skip')"   class="btn btn-sm">All: Skip</button>
      </div>
      <div id="cm-rows" style="overflow-y:auto;flex:1">
        ${groups.map((g, i) => buildGroupHtml(g, i)).join('')}
      </div>
      <div style="padding:12px 14px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
        <span id="cm-summary" style="font-size:11px;color:var(--text3)"></span>
        <div style="display:flex;gap:8px">
          <button class="btn" onclick="document.getElementById('${MODAL_ID}').remove()">Cancel</button>
          <button class="btn btn-primary" onclick="_cmApply()">Apply</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // ── Internal helpers ──────────────────────────────────────

  window._cmRows    = groups;
  window._cmChoices = choices;

  window._cmUpdateSummary = function() {
    const toLink   = choices.filter(c => c.action === 'link').length;
    const toCreate = choices.filter(c => c.action === 'create').length;
    const toSkip   = choices.filter(c => c.action === 'skip').length;
    const el = document.getElementById('cm-summary');
    if (el) el.textContent = `${toLink} to link · ${toCreate} to create · ${toSkip} to skip`;
  };

  window._cmSetAction = function(i, action) {
    choices[i].action = action;
    if (action === 'link' && groups[i].suggestions.length) {
      choices[i].chosenId = groups[i].suggestions[0].id;
    }
    const rowEl = document.getElementById(`cmrow_${i}`);
    if (rowEl) rowEl.outerHTML = buildGroupHtml(groups[i], i);
    window._cmUpdateSummary();
  };

  window._cmChoose = function(i, contactId) {
    choices[i].chosenId = contactId;
  };

  window._cmSetAllActions = function(action) {
    choices.forEach((c, i) => {
      c.action = action;
      if (action === 'link' && groups[i].suggestions.length) {
        c.chosenId = groups[i].suggestions[0].id;
      }
    });
    const container = document.getElementById('cm-rows');
    if (container) container.innerHTML = groups.map((g, i) => buildGroupHtml(g, i)).join('');
    window._cmUpdateSummary();
  };

  window._cmApply = function() {
    let linked = 0, created = 0;
    groups.forEach((g, i) => {
      const c = choices[i];
      if (c.action === 'link' && c.chosenId) {
        // Link ALL rows in this group to the same contact
        g.entries.forEach(entry => ContactAnchor.linkRowToContact(entry.row, c.chosenId));
        linked += g.entries.length;
      } else if (c.action === 'create') {
        // Create one contact from the first row, link all rows to it
        const contact = ContactAnchor.createContactFromRow(
          g.entries[0].row,
          g.entries[0].arrayKey === 'crew' ? 'crew' : 'cast'
        );
        if (contact && g.entries.length > 1) {
          const cid = contact.id || contact.name;
          g.entries.slice(1).forEach(entry => ContactAnchor.linkRowToContact(entry.row, cid));
        }
        created++;
      }
      // skip: do nothing
    });
    saveStore();
    document.getElementById(MODAL_ID)?.remove();
    const parts = [];
    if (linked)  parts.push(`${linked} row${linked!==1?'s':''} linked`);
    if (created) parts.push(`${created} contact${created!==1?'s':''} created`);
    if (parts.length) showToast(parts.join(' · '), 'success');
    else showToast('No changes made', 'info');
    renderContactLinkStats();
  };

  window._cmUpdateSummary();
}

window.openContactMigrationModal = openContactMigrationModal;
