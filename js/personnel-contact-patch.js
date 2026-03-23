// ══════════════════════════════════════════
// PERSONNEL MODAL — CONTACT-AWARE ADDITIONS
// ══════════════════════════════════════════
// Patches the existing addPersonnel / savePersonnel flow to:
//   1. Attach a contact picker to the name input
//   2. Auto-fill phone/email when a contact is selected
//   3. Store contactId on the saved row
//   4. Show a "linked" badge when editing a row that has a contactId
//
// Drop this file after personnel.js / the existing modal logic.
// It wraps the existing openModal('modal-personnel') call.
// ══════════════════════════════════════════

(function () {

  // Track the contactId chosen in the current modal session
  let _pendingContactId = null;

  /**
   * Called after the personnel modal HTML is ready in the DOM.
   * Attaches the contact picker to #pers-name.
   */
  function _initPersonnelPicker() {
    _pendingContactId = null;

    const nameInput = document.getElementById('pers-name');
    if (!nameInput) return;

    // Remove any old picker instance
    document.getElementById('_ca-picker')?.remove();

    ContactAnchor.attachPicker(nameInput, contact => {
      // Fill name input
      nameInput.value = contact.name;
      _pendingContactId = contact.id;

      // Auto-fill phone and email if fields are empty
      const phoneEl = document.getElementById('pers-number');
      const emailEl = document.getElementById('pers-email');
      if (phoneEl && !phoneEl.value && contact.phone) phoneEl.value = contact.phone;
      if (emailEl && !emailEl.value && contact.email) emailEl.value = contact.email;

      // Show a linked badge next to the name input
      _showLinkedBadge(contact.name);

      // Move focus to role
      document.getElementById('pers-role')?.focus();
    });
  }

  function _showLinkedBadge(contactName) {
    document.getElementById('_pers-linked-badge')?.remove();
    const nameInput = document.getElementById('pers-name');
    if (!nameInput) return;
    const badge = document.createElement('div');
    badge.id = '_pers-linked-badge';
    badge.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:4px;font-size:11px;color:var(--accent2)';
    badge.innerHTML = `<span>⚭</span> <span>Linked to contact: <strong>${_esc(contactName)}</strong></span>
      <button onclick="document.getElementById('_pers-linked-badge').remove();window._persUnlinkContact && _persUnlinkContact()"
        style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px;padding:0;margin-left:4px">Unlink</button>`;
    nameInput.parentElement.appendChild(badge);
  }

  window._persUnlinkContact = function () {
    _pendingContactId = null;
    document.getElementById('_pers-linked-badge')?.remove();
  };

  // ── Patch addPersonnel ────────────────────────────────────

  // Store reference to original if it exists
  const _origAddPersonnel = window.addPersonnel;

  window.addPersonnel = function (type) {
    if (_origAddPersonnel) _origAddPersonnel(type);
    // Attach picker after modal opens (DOM needs a tick)
    setTimeout(_initPersonnelPicker, 0);
  };

  // ── Patch savePersonnel ───────────────────────────────────

  const _origSavePersonnel = window.savePersonnel;

  window.savePersonnel = function () {
    // Stamp the contactId before handing off to the original save
    if (_pendingContactId) {
      // We'll retrieve the row after save by reading the last item added
      // Instead, we inject into the form so the original save can pick it up.
      // The cleanest approach: save normally, then patch the last-added row.
      const type     = document.getElementById('personnel-type')?.value;
      const editIdx  = document.getElementById('personnel-edit-idx')?.value;
      const isEdit   = editIdx !== '' && editIdx !== undefined;

      if (_origSavePersonnel) _origSavePersonnel();

      // Now find and patch the row
      const p = currentProject();
      if (p && type) {
        const array = type === 'cast' ? p.cast : type === 'extras' ? p.extras : null;
        if (array) {
          const targetIdx = isEdit ? parseInt(editIdx) : array.length - 1;
          const row = array[targetIdx];
          if (row) {
            ContactAnchor.linkRowToContact(row, _pendingContactId);
            saveStore();
          }
        }
      }
      _pendingContactId = null;
    } else {
      if (_origSavePersonnel) _origSavePersonnel();
    }
  };

  // ── Patch editShot's cast autofill to use contact data ──

  // When editing a cast row that already has a contactId, show the badge
  const _origEditPersonnel = window.editPersonnel;
  if (_origEditPersonnel) {
    window.editPersonnel = function (type, i) {
      _origEditPersonnel(type, i);
      setTimeout(() => {
        const p = currentProject();
        const array = type === 'cast' ? p?.cast : type === 'extras' ? p?.extras : null;
        const row = array?.[i];
        if (row?.contactId) {
          const contact = ContactAnchor.getContact(row.contactId);
          if (contact) {
            _pendingContactId = row.contactId;
            _initPersonnelPicker();
            _showLinkedBadge(contact.name);
          }
        } else {
          _initPersonnelPicker();
        }
      }, 0);
    };
  }

  // ── Contact indicator in cast/extras table rows ───────────

  /**
   * Renders a small linked-contact indicator for a cast/extras table row.
   * Call this from renderCastTable / renderExtrasTable where rows are built.
   * @param {object} row
   * @returns {string} HTML string (empty if no link)
   */
  window.castContactBadge = function (row) {
    if (!row?.contactId) return '';
    const contact = ContactAnchor.getContact(row.contactId);
    if (!contact) return '';
    return `<span title="Linked to contact: ${_esc(contact.name)}" style="font-size:10px;color:var(--accent2);opacity:0.8;margin-left:4px">⚭</span>`;
  };

  /**
   * Resolve the best phone/email for a row, preferring the linked contact.
   * Use this in table renders instead of row.number / row.email directly.
   */
  window.castPhone = row => ContactAnchor.resolvePhone(row);
  window.castEmail = row => ContactAnchor.resolveEmail(row);

  function _esc(s) {
    return String(s || '').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>');
  }

})();
