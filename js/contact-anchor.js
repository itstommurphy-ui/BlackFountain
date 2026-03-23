// ══════════════════════════════════════════
// CONTACT ANCHOR
// ══════════════════════════════════════════
// Provides a single source of truth for person data.
// Cast, extras, and crew rows store a `contactId` that
// references store.contacts[]. Phone/email always read
// from the contact; project rows store only project-
// specific fields (character, confirmed, call time, etc.)
//
// Additive — no existing data is removed or overwritten.
// ══════════════════════════════════════════

const ContactAnchor = (function () {

  // ── Core lookups ───────────────────────────────────────────

  /** Return the contact object for a given contactId, or null */
  function getContact(contactId) {
  if (!contactId) return null;
  // Check store.contacts first
  const global = (store.contacts || []).find(c => c.id === contactId || c.name === contactId);
  if (global) return global;
  // Fall back to searching per-project arrays
  for (const p of (store.projects || [])) {
    const allRows = [...(p.cast||[]), ...(p.extras||[]), ...(p.unit||[]), ...(p.contacts||[])];
    const found = allRows.find(r => r.contactId === contactId || r.name === contactId);
    if (found) return found;
  }
  return null;
}

  /** Get the canonical contact linked to a cast/extras/crew row */
  function getContactForRow(row) {
    if (!row) return null;
    return getContact(row.contactId) || null;
  }

  /**
   * Resolve display phone for a row.
   * Prefers the linked contact's phone, falls back to row's own phone.
   */
  function resolvePhone(row) {
    const contact = getContactForRow(row);
    return (contact && contact.phone) || row.number || row.phone || '';
  }

  /**
   * Resolve display email for a row.
   * Prefers the linked contact's email, falls back to row's own email.
   */
  function resolveEmail(row) {
    const contact = getContactForRow(row);
    return (contact && contact.email) || row.email || '';
  }

  /**
   * Resolve display name for a row.
   * Prefers row's own name (may differ from contact, e.g. stage name),
   * falls back to contact name.
   */
  function resolveName(row) {
    if (row.name && row.name.trim()) return row.name.trim();
    const contact = getContactForRow(row);
    return contact ? contact.name : '';
  }

  // ── Linking ────────────────────────────────────────────────

  /**
   * Link a cast/extras row to a contact.
   * Copies phone + email from contact into the row for offline resilience,
   * but the contactId is the canonical reference.
   * @param {object} row - the cast/extras/crew row object (mutated in place)
   * @param {string} contactId - store.contacts[].id  (or .name for legacy contacts)
   */
  function linkRowToContact(row, contactId) {
    const contact = getContact(contactId);
    if (!contact) return;
    row.contactId = contact.id || contact.name; // prefer id; fall back to name for legacy
    // Mirror contact data for offline use — these are kept in sync on save
    if (contact.phone) row.number = contact.phone;
    if (contact.email) row.email  = contact.email;
    // Don't overwrite row.name — user may have entered a character/stage name
    if (!row.name || !row.name.trim()) row.name = contact.name;
  }

  /**
   * Unlink a row from its contact (keeps mirrored data in place)
   */
  function unlinkRow(row) {
    delete row.contactId;
  }

  // ── Contact creation from row ──────────────────────────────

  /**
   * Create a new contact from a cast/crew/extras row and link the row to it.
   * Used when the user adds someone new who isn't in contacts yet.
   * @param {object} row
   * @param {'cast'|'crew'|'locations'} type
   * @returns {object} the new contact
   */
  function createContactFromRow(row, type) {
    if (!store.contacts) store.contacts = [];
    // Avoid duplicates
    const existing = store.contacts.find(
      c => c.name && row.name && c.name.toLowerCase() === row.name.toLowerCase()
    );
    if (existing) {
      linkRowToContact(row, existing.id || existing.name);
      return existing;
    }
    const contact = {
      id:       'contact_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name:     row.name  || '',
      phone:    row.number || row.phone || '',
      email:    row.email  || '',
      roles:    row.role   ? [{ type, role: row.role }] : [],
      projects: [],
      createdAt: Date.now()
    };
    store.contacts.push(contact);
    linkRowToContact(row, contact.id);
    return contact;
  }

  // ── Migration ──────────────────────────────────────────────

  /**
   * One-time migration: scan all projects' cast, extras, and crew rows.
   * For each row without a contactId, try to find a matching contact by name.
   * If found, link them. If not found, optionally create a contact.
   *
   * @param {boolean} createMissing - if true, create contacts for unmatched rows
   * @returns {{ linked: number, created: number, skipped: number }}
   */
  function migrateAllRows(createMissing = false) {
    let linked = 0, created = 0, skipped = 0;

    (store.projects || []).forEach(p => {
      // Cast
      (p.cast || []).forEach(row => {
        if (row.contactId) return;
        const match = _findContactByName(row.name);
        if (match) { linkRowToContact(row, match.id || match.name); linked++; }
        else if (createMissing && row.name?.trim()) { createContactFromRow(row, 'cast'); created++; }
        else skipped++;
      });
      // Extras
      (p.extras || []).forEach(row => {
        if (row.contactId) return;
        const match = _findContactByName(row.name);
        if (match) { linkRowToContact(row, match.id || match.name); linked++; }
        else if (createMissing && row.name?.trim()) { createContactFromRow(row, 'cast'); created++; }
        else skipped++;
      });
      // Callsheet crew (nested structure)
      (p.callsheets || []).forEach(cs => {
        (cs.crew || []).forEach(row => {
          if (row.contactId) return;
          const match = _findContactByName(row.name);
          if (match) { linkRowToContact(row, match.id || match.name); linked++; }
          else if (createMissing && row.name?.trim()) { createContactFromRow(row, 'crew'); created++; }
          else skipped++;
        });
        (cs.cast || []).forEach(row => {
          if (row.contactId) return;
          const match = _findContactByName(row.name);
          if (match) { linkRowToContact(row, match.id || match.name); linked++; }
          else if (createMissing && row.name?.trim()) { createContactFromRow(row, 'cast'); created++; }
          else skipped++;
        });
      });
    });

    if (linked + created > 0) saveStore();
    return { linked, created, skipped };
  }

  /**
   * Sync mirrored phone/email on all linked rows back from their contacts.
   * Call this after editing a contact to propagate changes everywhere.
   * @param {string} contactId
   */
  function syncContactToRows(contactId) {
    const contact = getContact(contactId);
    if (!contact) return;
    (store.projects || []).forEach(p => {
      const allRows = [
        ...(p.cast   || []),
        ...(p.extras || []),
        ...((p.callsheets || []).flatMap(cs => [...(cs.crew||[]), ...(cs.cast||[])]))
      ];
      allRows.forEach(row => {
        if ((row.contactId === contactId) ||
            (row.contactId === contact.name)) {
          if (contact.phone) row.number = contact.phone;
          if (contact.email) row.email  = contact.email;
        }
      });
    });
    saveStore();
  }

  // ── Contact search (for modal autocomplete) ────────────────

  /**
   * Search contacts by name fragment.
   * Returns up to `limit` results sorted by name.
   * @param {string} query
   * @param {number} limit
   * @returns {Array<{id, name, phone, email, roles}>}
   */
  function searchContacts(query, limit = 8) {
  const q = (query || '').trim().toLowerCase();
  
  // Gather everyone from all per-project arrays
  const seen = new Map(); // name.toLowerCase() -> best record
  
  (store.projects || []).forEach(p => {
    const addRow = (row, type) => {
      if (!row.name?.trim()) return;
      const key = row.name.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, {
          id:    row.contactId || row.name,
          name:  row.name.trim(),
          phone: row.number || row.phone || '',
          email: row.email  || '',
          roles: row.role   ? [row.role] : [],
          type
        });
      }
    };
    (p.cast     || []).forEach(r => addRow(r, 'cast'));
    (p.extras   || []).forEach(r => addRow(r, 'extras'));
    (p.unit     || []).forEach(r => addRow(r, 'crew'));
    (p.contacts || []).forEach(r => addRow(r, 'contact'));
  });

  // Also include store.contacts if any exist
  (store.contacts || []).forEach(c => {
    if (!c.name?.trim()) return;
    const key = c.name.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, {
        id:    c.id || c.name,
        name:  c.name.trim(),
        phone: c.phone || '',
        email: c.email || '',
        roles: c.roles || [],
        type:  'contact'
      });
    }
  });

  const all = [...seen.values()];
  
  // If no query, return all (useful for showing full list)
  if (!q) return all.slice(0, limit);
  
  return all
    .filter(c => c.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q);
      const bStarts = b.name.toLowerCase().startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return  1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

  /**
   * Build a contact picker dropdown for an input element.
   * Renders inline below the input; clicking a result calls onSelect(contact).
   *
   * Usage:
   *   ContactAnchor.attachPicker(inputEl, contact => {
   *     row.name = contact.name;
   *     linkRowToContact(row, contact.id);
   *   });
   *
   * @param {HTMLInputElement} inputEl
   * @param {function} onSelect
   */
  function attachPicker(inputEl, onSelect) {
    if (!inputEl) return;

    const PICKER_ID = '_ca-picker';

    function removePicker() {
      document.getElementById(PICKER_ID)?.remove();
    }

    function renderPicker(results) {
      removePicker();
      if (!results.length) return;

      const rect   = inputEl.getBoundingClientRect();
      const picker = document.createElement('div');
      picker.id    = PICKER_ID;
      picker.style.cssText = [
        'position:fixed',
        `top:${rect.bottom + 2}px`,
        `left:${rect.left}px`,
        `width:${Math.max(rect.width, 260)}px`,
        'background:var(--surface2)',
        'border:1px solid var(--border)',
        'border-radius:var(--radius)',
        'box-shadow:var(--shadow-lg)',
        'z-index:9999',
        'overflow:hidden',
        'max-height:220px',
        'overflow-y:auto'
      ].join(';');

      results.forEach(contact => {
        const item = document.createElement('div');
        item.style.cssText = 'padding:8px 12px;cursor:pointer;display:flex;flex-direction:column;gap:2px;border-bottom:1px solid var(--border2)';
        item.innerHTML = `
          <span style="font-size:13px;font-weight:500;color:var(--text)">${_esc(contact.name)}</span>
          ${contact.phone || contact.email
            ? `<span style="font-size:11px;color:var(--text3)">${[contact.phone, contact.email].filter(Boolean).join(' · ')}</span>`
            : ''}
          ${contact.roles?.length
            ? `<span style="font-size:10px;color:var(--accent2)">${contact.roles.map(r => r.role || r).filter(Boolean).slice(0,3).join(', ')}</span>`
            : ''}`;
        item.addEventListener('mouseenter', () => item.style.background = 'var(--surface3)');
        item.addEventListener('mouseleave', () => item.style.background = '');
        item.addEventListener('mousedown', e => {
          e.preventDefault(); // prevent blur firing first
          removePicker();
          onSelect(contact);
        });
        picker.appendChild(item);
      });

      document.body.appendChild(picker);
    }

    inputEl.addEventListener('input', () => {
      const results = searchContacts(inputEl.value);
      renderPicker(results);
    });

    inputEl.addEventListener('blur', () => {
      // Short delay so mousedown on picker item fires first
      setTimeout(removePicker, 180);
    });

    inputEl.addEventListener('keydown', e => {
      const picker = document.getElementById(PICKER_ID);
      if (!picker) return;
      const items = picker.querySelectorAll('div');
      const active = picker.querySelector('[data-active]');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = active ? active.nextElementSibling : items[0];
        if (next) { active?.removeAttribute('data-active'); next.setAttribute('data-active','1'); next.style.background='var(--surface3)'; if(active) active.style.background=''; }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = active?.previousElementSibling;
        if (prev) { active.removeAttribute('data-active'); prev.setAttribute('data-active','1'); prev.style.background='var(--surface3)'; active.style.background=''; }
      } else if (e.key === 'Enter' && active) {
        e.preventDefault();
        active.dispatchEvent(new MouseEvent('mousedown'));
      } else if (e.key === 'Escape') {
        removePicker();
      }
    });
  }

  // ── Run migration on init ──────────────────────────────────

  /**
   * Run a silent link-only migration on app start.
   * Won't create new contacts, won't show toasts unless something linked.
   * Call this from init.js after loadStore().
   */
  function runSilentMigration() {
    const result = migrateAllRows(false);
    if (result.linked > 0) {
      console.log(`[ContactAnchor] Auto-linked ${result.linked} cast/crew rows to existing contacts.`);
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  function _findContactByName(name) {
    if (!name || !name.trim()) return null;
    const n = name.trim().toLowerCase();
    return (store.contacts || []).find(c => c.name && c.name.toLowerCase() === n) || null;
  }

  function _esc(s) {
    return String(s || '').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
  }

  // ── Public API ─────────────────────────────────────────────

  return {
    getContact,
    getContactForRow,
    resolvePhone,
    resolveEmail,
    resolveName,
    linkRowToContact,
    unlinkRow,
    createContactFromRow,
    migrateAllRows,
    syncContactToRows,
    searchContacts,
    attachPicker,
    runSilentMigration
  };

})();

window.ContactAnchor = ContactAnchor;
