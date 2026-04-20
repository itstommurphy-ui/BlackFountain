// ══════════════════════════════════════════
// SETTINGS — CONTACT LINKING HELPERS
// ══════════════════════════════════════════

/** Render stats into the settings contact card */
function renderContactLinkStats() {
  const totalEl = document.getElementById('total-contacts');
  const linkedEl = document.getElementById('linked-rows');
  const unlinkedEl = document.getElementById('unlinked-rows');
  if (!totalEl || !linkedEl || !unlinkedEl) return;

  let total = 0, linked = 0;
  (store.projects || []).forEach(p => {
    (p.cast   || []).forEach(r => { total++; if (r.contactId) linked++; });
    (p.extras || []).forEach(r => { total++; if (r.contactId) linked++; });
    (p.callsheets || []).forEach(cs => {
      (cs.crew  || []).forEach(r => { total++; if (r.contactId) linked++; });
      (cs.cast  || []).forEach(r => { total++; if (r.contactId) linked++; });
    });
  });

  totalEl.textContent = total;
  linkedEl.textContent = linked;
  unlinkedEl.textContent = total - linked;
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
window.openContactsView = function() { showView('contacts'); };
window.runContactMigration = function(createMissing) { openContactMigrationModal(); };

// ══════════════════════════════════════════
// SOCIAL MEDIA FIELD HANDLERS
// ══════════════════════════════════════════

const SOCIAL_PLATFORMS = [
  { id: 'instagram', name: 'Instagram', icon: '', baseUrl: 'https://instagram.com/' },
  { id: 'twitter', name: 'X (Twitter)', icon: '', baseUrl: 'https://x.com/' },
  { id: 'facebook', name: 'Facebook', icon: '', baseUrl: 'https://facebook.com/' },
  { id: 'tiktok', name: 'TikTok', icon: '', baseUrl: 'https://tiktok.com/@' },
  { id: 'youtube', name: 'YouTube', icon: '', baseUrl: 'https://youtube.com/@' },
  { id: 'linkedin', name: 'LinkedIn', icon: '', baseUrl: 'https://linkedin.com/in/' },
  { id: 'threads', name: 'Threads', icon: '', baseUrl: 'https://threads.net/@' },
  { id: 'bluesky', name: 'Bluesky', icon: '', baseUrl: 'https://bsky.app/profile/' },
  { id: 'Website', name: 'Website', icon: '', baseUrl: '' }
];

function _buildPlatformSelect(selectedPlatform, fieldId) {
  const platforms = SOCIAL_PLATFORMS.map(p =>
    `<option value="${p.id}"${p.id === selectedPlatform ? ' selected' : ''}>${p.name}</option>`
  ).join('');
  return `<select class="form-select" style="width:140px" data-field="platform" data-field-id="${fieldId}">${platforms}</select>`;
}

function addSocialField(containerId, platform, handle) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const fieldId = 'social-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  const row = document.createElement('div');
  row.className = 'social-field-row';
  row.dataset.fieldId = fieldId;
  row.style.cssText = 'display:flex;gap:8px;align-items:center';
  row.innerHTML = `
    ${_buildPlatformSelect(platform || 'instagram', fieldId)}
    <input type="text" class="form-input" style="flex:1" data-field="handle" data-field-id="${fieldId}" value="${handle || ''}" placeholder="@handle" oninput="_updateSocialRemoveBtn('${fieldId}')">
    <button type="button" class="btn btn-sm" style="padding:4px 8px;opacity:0.7" onclick="removeSocialField('${containerId}', '${fieldId}')" title="Remove">✕</button>
  `;
  container.appendChild(row);
}

function removeSocialField(containerId, fieldId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const row = container.querySelector(`[data-field-id="${fieldId}"]`);
  if (row) row.remove();
}

function _updateSocialRemoveBtn(fieldId) {
}

function collectSocials(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return '';
  const rows = container.querySelectorAll('.social-field-row');
  const socials = [];
  rows.forEach(row => {
    const platform = row.querySelector('[data-field="platform"]')?.value;
    const handle = row.querySelector('[data-field="handle"]')?.value?.trim();
    if (platform && handle) {
      socials.push(platform + '||' + handle.replace(/^@/, ''));
    }
  });
  return socials.join(',');
}

function getSocialLink(platform, handle) {
  const plat = SOCIAL_PLATFORMS.find(p => p.id === platform);
  if (!plat || !handle) return '';
  let url;
  if (plat.id === 'Website') {
    url = handle.startsWith('http') ? handle : 'https://' + handle;
  } else if (plat.id === 'tiktok') {
    url = plat.baseUrl + handle.replace(/^@/, '');
  } else {
    url = plat.baseUrl + handle.replace(/^@/, '');
  }
  return url;
}

function renderSocialLinks(socialsStr, options) {
  if (!socialsStr) return options?.empty || '';
  const socials = socialsStr.split(',').filter(Boolean);
  if (!socials.length) return options?.empty || '';
  const links = socials.map(s => {
    const [platform, handle] = s.split('||');
    const plat = SOCIAL_PLATFORMS.find(p => p.id === platform);
    if (!plat || !handle) return '';
    const url = getSocialLink(platform, handle);
    if (!url) return '';
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="social-link" title="${plat.name}: @${handle}">${plat.name}</a>`;
  }).filter(Boolean);
  if (!links.length) return options?.empty || '';
  return links.join('<span style="margin:0 6px;color:var(--text3)">|</span>');
}

window.addSocialField = addSocialField;
window.removeSocialField = removeSocialField;
window.collectSocials = collectSocials;
window.getSocialLink = getSocialLink;
window.renderSocialLinks = renderSocialLinks;
window.SOCIAL_PLATFORMS = SOCIAL_PLATFORMS;
