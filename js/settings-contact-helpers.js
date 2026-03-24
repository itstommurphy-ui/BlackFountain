// ══════════════════════════════════════════
// SETTINGS — CONTACT LINKING HELPERS
// ══════════════════════════════════════════

/** Render stats into the settings contact card */
function renderContactLinkStats() {
  const el = document.getElementById('contact-link-stats');
  if (!el) return;

  let total = 0, linked = 0;
  (store.projects || []).forEach(p => {
    (p.cast   || []).forEach(r => { total++; if (r.contactId) linked++; });
    (p.extras || []).forEach(r => { total++; if (r.contactId) linked++; });
    (p.callsheets || []).forEach(cs => {
      (cs.crew  || []).forEach(r => { total++; if (r.contactId) linked++; });
      (cs.cast  || []).forEach(r => { total++; if (r.contactId) linked++; });
    });
  });

  const pct = total ? Math.round((linked / total) * 100) : 0;
  el.innerHTML = total
    ? `<p>When you add cast or crew to a project, Black Fountain can link them to your Contacts so phone numbers and emails stay in sync everywhere.</p><p><strong>${linked} of ${total} people</strong> across your projects are currently linked (${pct}%).</p>`
    : '<p>No cast or crew entries found across projects.</p>';
}

/** Sync all contact data to linked rows */
function _syncAllContacts() {
  let synced = 0;
  (store.contacts || []).forEach(c => {
    const id = c.id || c.name;
    (store.projects || []).forEach(p => {
      const allRows = [
        ...(p.cast   || []),
        ...(p.extras || []),
        ...((p.callsheets || []).flatMap(cs => [...(cs.crew||[]), ...(cs.cast||[])]))
      ];
      allRows.forEach(row => {
        if (row.contactId === id) {
          if (c.phone) row.number = c.phone;
          if (c.email) row.email  = c.email;
          synced++;
        }
      });
    });
  });
  if (synced > 0) {
    saveStore();
    showToast(`Synced contact data to ${synced} row${synced !== 1 ? 's' : ''}`, 'success');
  } else {
    showToast('Nothing to sync — no linked rows found', 'info');
  }
  renderContactLinkStats();
}

// Re-render stats whenever settings view is shown
const _origShowSettings = window.showView;
if (_origShowSettings) {
  window.showView = function(view) {
    _origShowSettings(view);
    if (view === 'settings') renderContactLinkStats();
  };
} else {
  // Fallback: render on DOM ready
  document.addEventListener('DOMContentLoaded', renderContactLinkStats);
}

window.renderContactLinkStats = renderContactLinkStats;
window._syncAllContacts = _syncAllContacts;
