// CALLSHEET HTML BUILDING
// ══════════════════════════════════════════


function exportData() {
  const blob=new Blob([JSON.stringify(store,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`blackfountain_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  setTimeout(() => showToast('Backup saved to your downloads folder.', 'success'), 600);
}

// ══════════════════════════════════════════
// MODAL HELPERS
// ══════════════════════════════════════════
function openModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) { console.log('overlay NOT FOUND'); return; }
  // WCAG: inject ARIA roles and labels
  const modal = overlay.querySelector('.modal');
  if (modal) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const heading = modal.querySelector('h2, h3, [class*="modal-title"]');
    if (heading) {
      if (!heading.id) heading.id = id + '-title';
      modal.setAttribute('aria-labelledby', heading.id);
    }
    modal.querySelectorAll('.modal-close').forEach(btn => {
      if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', 'Close');
    });
  }
  overlay.classList.add('open');
  overlay.dataset.justOpened = Date.now();
  // focus first focusable element inside the modal
  setTimeout(() => {
    const first = overlay.querySelector('input:not([type=hidden]), textarea, select, button:not(.modal-close)');
    if (first) first.focus();
    else { const close = overlay.querySelector('.modal-close'); if (close) close.focus(); }
  }, 60);
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
  }
}

// ── KEYBOARD SHORTCUTS ──
// Map modal id → save function
const MODAL_SAVE = {
  'modal-project':      () => saveProject(),
  'modal-personnel':    () => savePersonnel(),
  'modal-budget':       () => saveBudgetLine(),
  'modal-location':     () => saveLocation(),
  'modal-schedule':     () => saveScheduleRow(),
  'modal-equip':        () => saveEquipItem(),
  'modal-invite':       () => saveInvite(),
  'modal-shot':         () => saveShot(),
  'modal-prop':         () => savePropItem(),
  'modal-wardrobe':     () => saveWardrobeItem(),
  'modal-sound':        () => saveSoundEntry(),
  'modal-risk':         () => saveRiskRow(),
  'modal-add-cast':     () => saveAddCast(),
  'modal-customfield':  () => saveCSCustomField(),
  'modal-story':                 () => saveStory(),
  'modal-contact-columns':       () => saveContactColumns(),
  'modal-location-columns':      () => saveLocationColumns(),
  'modal-edit-contact':          () => saveEditedContact(),
  'modal-edit-location-global': () => saveLocationGlobal(),
  'modal-manage-file':          () => confirmManageFile(),
  'modal-move-file':          () => confirmMoveFile(),
  'modal-remove-file':        () => confirmRemoveFiles(),
  'modal-script-upload':      () => confirmScriptUpload(),
  'modal-new-moodboard':      () => saveNewMoodboard(),
  'modal-mb-video':           () => saveMbVideo(),
  'modal-mb-color':           () => saveMbColor(),
  'modal-loc-contact':  () => saveLocationContact(),
};

// Shot modal — delegated autocomplete for location and cast fields
document.addEventListener('input', function(e) {
  const id = e.target?.id;
  if (id === 'shot-location') {
    const p = currentProject();
    const locs = [...new Set([...(p?.locations||[]).map(l=>l.name), ...(store?.locations||[]).map(l=>l.name)])].filter(Boolean);
    _acShow(e.target, locs);
  } else if (id === 'shot-cast') {
    const p  = currentProject();
    const bd = _getActiveBd(p);
    const sceneKey = document.getElementById('shot-scene-key')?.value || '';
    let opts = [];
    if (bd && sceneKey) {
      const data = _sbBuildSceneData(p);
      opts = data[sceneKey]?.cast || [];
    }
    const projectCast = (p?.cast||[]).map(c => c.name||c.character).filter(Boolean);
    opts = [...new Set([...opts, ...projectCast])];
    _acShow(e.target, opts);
  } else if ('castAuto' in (e.target?.dataset || {})) {
    // Schedule cast field — suggest character names from breakdown
    const p = currentProject();
    const projectCast = (p?.cast||[]).map(c => c.name).filter(Boolean);
    const sceneData = _sbBuildSceneData(p);
    const bdCast = Object.values(sceneData).flatMap(e => e.cast || []);
    const opts = [...new Set([...bdCast, ...projectCast])].filter(Boolean);
    _acShow(e.target, opts);
  } else if ('actorAuto' in (e.target?.dataset || {})) {
    // Actor name field — suggest real actor names and cast-tagged contacts
    const p = currentProject();
    const projectCast = (p?.cast||[]).map(c => c.name).filter(Boolean);
    const castContacts = [
      ...(p?.contacts||[]).filter(c => (c.type||'').includes('cast')).map(c => c.name),
      ...(store?.contacts||[]).filter(c => (c.type||'').includes('cast')).map(c => c.name),
    ];
    const opts = [...new Set([...projectCast, ...castContacts])].filter(Boolean);
    _acShow(e.target, opts);
  } else if ('charAuto' in (e.target?.dataset || {})) {
    // Character name field — suggest character names from breakdown + existing castRows
    const p = currentProject();
    const sceneData = _sbBuildSceneData(p);
    const bdChars = Object.values(sceneData).flatMap(e => e.cast || []);
    const rowChars = (p?.callsheets||[]).flatMap(cs => (cs.castRows||[]).map(r => r.character)).filter(Boolean);
    _acShow(e.target, [...new Set([...bdChars, ...rowChars])]);
  } else if ('crewAuto' in (e.target?.dataset || {})) {
    const p = currentProject();
    const unitNames = (p?.unit||[]).map(u => u.name).filter(Boolean);
    const crewContacts = [
      ...(p?.contacts||[]).filter(c => (c.type||'').includes('crew')).map(c => c.name),
      ...(store?.contacts||[]).filter(c => (c.type||'').includes('crew')).map(c => c.name),
    ];
    const opts = [...new Set([...unitNames, ...crewContacts])].filter(Boolean);
    _acShow(e.target, opts);
  }
});
document.addEventListener('blur', function(e) {
  const id = e.target?.id;
  if (id === 'shot-location' || id === 'shot-cast') setTimeout(_acRemove, 150);
  else if ('castAuto' in (e.target?.dataset || {})) setTimeout(_acRemove, 150);
  else if ('actorAuto' in (e.target?.dataset || {})) setTimeout(_acRemove, 150);
  else if ('charAuto' in (e.target?.dataset || {})) setTimeout(_acRemove, 150);
  else if ('crewAuto' in (e.target?.dataset || {})) setTimeout(_acRemove, 150);
}, true);

document.addEventListener('keydown', e => {
  // Cmd/Ctrl+A: only allow select-all inside actual form fields
  if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
    const tag = document.activeElement?.tagName;
    const isField = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
    if (!isField) { e.preventDefault(); return; }
  }

  // Escape → close any open modal
  if (e.key === 'Escape') {
    const open = document.querySelector('.modal-overlay.open');
    if (open) { open.classList.remove('open'); return; }
  }

  // Enter → save the open modal (unless focus is in a textarea or select)
  if (e.key === 'Enter' && !e.shiftKey) {
    const open = document.querySelector('.modal-overlay.open');
    if (!open) return;
    // Don't intercept Enter in textareas (allow newlines) or selects (allow option picking)
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return;
    const saveFn = MODAL_SAVE[open.id];
    if (saveFn) { e.preventDefault(); saveFn(); }
  }
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { 
    // Removed overlay click close to prevent accidental closes
    // if(e.target === overlay) overlay.classList.remove('open'); 
  });
});

function showToast(msg, type='info') {
  const el=document.getElementById('toast');
  el.className='toast '+type;
  el.innerHTML=(type==='success'?'✓ ':'ℹ ')+msg;
  el.style.display='flex';
  clearTimeout(window._toastTimer);
  window._toastTimer=setTimeout(()=>el.style.display='none',2800);
}

// ══════════════════════════════════════════
