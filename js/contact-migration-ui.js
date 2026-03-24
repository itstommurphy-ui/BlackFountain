// ══════════════════════════════════════════
// CONTACT ANCHOR — MIGRATION UI
// ══════════════════════════════════════════
// Triggered manually from Settings or on first run.
// Shows unlinked cast/crew rows, lets the user review
// auto-matched suggestions and confirm in bulk.
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

  // For each unlinked row, find the best contact match
  const rows = unlinked.map(entry => {
    const suggestions = ContactAnchor.searchContacts(entry.row.name, 3);
    const bestMatch   = suggestions[0] || null;
    return { ...entry, suggestions, bestMatch, action: bestMatch ? 'link' : 'create', chosenId: bestMatch?.id || null };
  });

  // Track choices in a flat array indexed by row position
  const choices = rows.map(r => ({
    action:    r.action,     // 'link' | 'create' | 'skip'
    chosenId:  r.chosenId,
  }));

  function esc(s) { return String(s||'').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>'); }

  function buildRowHtml(r, i) {
    const c = choices[i];
    const typeLabel = r.arrayKey === 'crew' || r.arrayKey === 'cs-cast' ? 'Crew' : (r.arrayKey === 'extras' ? 'Extra' : 'Cast');
    const actionBtns = `
      <button onclick="_cmSetAction(${i},'link')"   class="btn btn-sm${c.action==='link'   ? ' btn-primary':''}" ${!r.suggestions.length?'disabled':''} title="Link to an existing contact">Link</button>
      <button onclick="_cmSetAction(${i},'create')" class="btn btn-sm${c.action==='create' ? ' btn-primary':''}" title="Create a new contact from this row">Create New</button>
      <button onclick="_cmSetAction(${i},'skip')"   class="btn btn-sm${c.action==='skip'   ? '':' btn-ghost'}"   title="Leave unlinked for now">Skip</button>`;

    const matchHtml = c.action === 'link' && r.suggestions.length
      ? `<select class="form-select" style="font-size:11px;margin-top:4px" onchange="_cmChoose(${i},this.value)">
          ${r.suggestions.map(s => `<option value="${esc(s.id)}" ${s.id===c.chosenId?'selected':''}>${esc(s.name)}${s.phone?' · '+esc(s.phone):''}${s.email?' · '+esc(s.email):''}</option>`).join('')}
         </select>`
      : c.action === 'create'
      ? `<span style="font-size:11px;color:var(--text3)">Will create a new contact: <strong>${esc(r.row.name)}</strong></span>`
      : `<span style="font-size:11px;color:var(--text3)">Will be left unlinked</span>`;

    return `<div id="cmrow_${i}" style="padding:10px 14px;border-bottom:1px solid var(--border2);display:flex;flex-direction:column;gap:5px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <span style="font-weight:600;font-size:13px">${esc(r.row.name)}</span>
          ${r.row.role ? `<span style="font-size:11px;color:var(--text3);margin-left:6px">${esc(r.row.role)}</span>` : ''}
          <span style="font-size:10px;background:var(--surface3);border-radius:3px;padding:1px 6px;margin-left:6px;color:var(--text3)">${esc(typeLabel)} · ${esc(r.project.title)}</span>
        </div>
        <div style="display:flex;gap:4px">${actionBtns}</div>
      </div>
      <div id="cmrow_detail_${i}">${matchHtml}</div>
    </div>`;
  }

  const totalToLink   = choices.filter(c => c.action !== 'skip').length;
  const totalSkip     = choices.filter(c => c.action === 'skip').length;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:640px;display:flex;flex-direction:column;max-height:85vh">
      <div class="modal-header" style="flex-shrink:0">
        <div>
          <h3>LINK CAST & CREW TO CONTACTS</h3>
          <p style="font-size:12px;color:var(--text3);margin:4px 0 0">${rows.length} unlinked ${rows.length===1?'person':'people'} found across your projects</p>
        </div>
        <button class="modal-close" onclick="document.getElementById('${MODAL_ID}').remove()">✕</button>
      </div>
      <div style="padding:10px 14px;background:var(--surface2);border-bottom:1px solid var(--border);font-size:11px;color:var(--text3);flex-shrink:0;display:flex;gap:12px;flex-wrap:wrap">
        <span>Linking connects people across sections so phone/email stays in sync.</span>
        <button onclick="_cmSetAllActions('link')"   class="btn btn-sm" style="margin-left:auto">All: Link</button>
        <button onclick="_cmSetAllActions('create')" class="btn btn-sm">All: Create</button>
        <button onclick="_cmSetAllActions('skip')"   class="btn btn-sm">All: Skip</button>
      </div>
      <div id="cm-rows" style="overflow-y:auto;flex:1">
        ${rows.map((r, i) => buildRowHtml(r, i)).join('')}
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

  // ── Internal helpers (scoped to this modal instance) ──────

  window._cmRows    = rows;
  window._cmChoices = choices;

  window._cmSetAction = function(i, action) {
    choices[i].action = action;
    if (action === 'link' && rows[i].suggestions.length) {
      choices[i].chosenId = rows[i].suggestions[0].id;
    }
    // Re-render just this row's detail + buttons
    const rowEl = document.getElementById(`cmrow_${i}`);
    if (rowEl) rowEl.outerHTML = buildRowHtml(rows[i], i);
    window._cmUpdateSummary();
  };

  window._cmChoose = function(i, contactId) {
    choices[i].chosenId = contactId;
  };

  window._cmSetAllActions = function(action) {
    choices.forEach((c, i) => {
      c.action = action;
      if (action === 'link' && rows[i].suggestions.length) {
        c.chosenId = rows[i].suggestions[0].id;
      }
    });
    // Re-render all rows
    const container = document.getElementById('cm-rows');
    if (container) container.innerHTML = rows.map((r, i) => buildRowHtml(r, i)).join('');
    window._cmUpdateSummary();
  };

  window._cmUpdateSummary = function() {
    const toLink   = choices.filter(c => c.action === 'link').length;
    const toCreate = choices.filter(c => c.action === 'create').length;
    const toSkip   = choices.filter(c => c.action === 'skip').length;
    const el = document.getElementById('cm-summary');
    if (el) el.textContent = `${toLink} to link · ${toCreate} to create · ${toSkip} to skip`;
  };

  window._cmApply = function() {
    let linked = 0, created = 0;
    rows.forEach((r, i) => {
      const c = choices[i];
      if (c.action === 'link' && c.chosenId) {
        ContactAnchor.linkRowToContact(r.row, c.chosenId);
        linked++;
      } else if (c.action === 'create') {
        ContactAnchor.createContactFromRow(r.row, r.arrayKey === 'crew' ? 'crew' : 'cast');
        created++;
      }
      // skip: do nothing
    });
    saveStore();
    document.getElementById(MODAL_ID)?.remove();
    const parts = [];
    if (linked)  parts.push(`${linked} linked`);
    if (created) parts.push(`${created} contacts created`);
    if (parts.length) showToast(parts.join(' · '), 'success');
    else showToast('No changes made', 'info');
  };

  window._cmUpdateSummary(); // call after all window assignments are done
}

window.openContactMigrationModal = openContactMigrationModal;

// Legacy function name for compatibility
function runContactMigration(createMissing) {
  openContactMigrationModal();
}

window.runContactMigration = runContactMigration;
