// ══════════════════════════════════════════
// MY FOUNTAIN — v2
// ══════════════════════════════════════════

let _mfSection = 'filmmaker';

function renderMyFountain() {
  _mfUpdateHero();
  mfShowSection(_mfSection);
}

function mfShowSection(section) {
  _mfSection = section;
  document.querySelectorAll('.mf-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });
  const content = document.getElementById('mf-body');
  if (!content) return;
  const mf = store.myFountain || {};
  const projects = store.projects || [];
  switch (section) {
    case 'filmmaker':     content.innerHTML = _mfFilmmaker(mf); break;
    case 'filmography':   content.innerHTML = _mfFilmography(projects, mf); break;
    case 'slate':         content.innerHTML = _mfSlate(mf); break;
    case 'collaborators': content.innerHTML = _mfCollaborators(projects); break;
    case 'stats':         content.innerHTML = _mfStats(projects, mf); break;
    case 'cv':            content.innerHTML = _mfCV(projects, mf); break;
    case 'goals':         content.innerHTML = _mfGoals(mf); break;
    case 'account':       content.innerHTML = _mfAccount(); break;
    default:              content.innerHTML = '';
  }
}

// ── Hero (always visible) ────────────────────────────────────

function _mfUpdateHero() {
  const mf = store.myFountain || {};
  const projects = store.projects || [];

  const el = id => document.getElementById(id);
  if (el('mf-hero-name'))      el('mf-hero-name').textContent      = mf.name || 'Your Name';
  if (el('mf-hero-stagename')) el('mf-hero-stagename').textContent  = mf.stageName ? `${mf.stageName} (screen)` : '';
  if (el('mf-hero-style'))     el('mf-hero-style').textContent      = mf.style ? `"${mf.style}"` : '';
  if (el('mf-hero-roles'))     el('mf-hero-roles').textContent      = 'Director · Producer · Writer';
  if (el('mf-hero-companies')) el('mf-hero-companies').innerHTML    =
    [mf.company1, mf.company2].filter(Boolean).map(c => `<div class="mf-hero-company">${c}</div>`).join('');

  const people = new Set();
  let shootDays = 0, released = 0, complete = 0;
  projects.forEach(p => {
    shootDays += (p.callsheets||[]).length;
    if (p.status === 'released') released++;
    if (p.status === 'done') complete++;
    (p.cast||[]).forEach(c=>{if(c.name)people.add(c.name.toLowerCase())});
    (p.unit||[]).forEach(c=>{if(c.name)people.add(c.name.toLowerCase())});
    (p.callsheets||[]).forEach(cs=>{
      (cs.crew||[]).forEach(c=>{if(c.name)people.add(c.name.toLowerCase())});
    });
  });
  const _s = (id,v) => { if(el(id)) el(id).textContent = v; };
  _s('mf-stat-projects',      projects.length);
  _s('mf-stat-released',      released + complete);
  _s('mf-stat-shootdays',     shootDays);
  _s('mf-stat-collaborators', people.size);

  _mfRenderPhoto();
}

function _mfRenderPhoto() {
  const mf = store.myFountain || {};
  const el = document.getElementById('mf-photo-inner');
  if (!el) return;
  if (mf.photo) {
    el.innerHTML = `<img src="${mf.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:3px;">`;
  } else {
    el.innerHTML = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="12" r="6" stroke="#f0f0f5" stroke-width="1.5"/><path d="M4 28c0-6.6 5.4-12 12-12s12 5.4 12 12" stroke="#f0f0f5" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }
}

function _mfUpdateHeroOnInput(key) {
  const el = id => document.getElementById(id);
  const name = el('mf-field-name')?.value || store.myFountain?.name || 'Your Name';
  const stageName = el('mf-field-stageName')?.value || store.myFountain?.stageName || '';
  const style = el('mf-field-style')?.value || store.myFountain?.style || '';
  const company1 = el('mf-field-company1')?.value || store.myFountain?.company1 || '';
  const company2 = el('mf-field-company2')?.value || store.myFountain?.company2 || '';

  if (el('mf-hero-name')) el('mf-hero-name').textContent = name;
  if (el('mf-hero-stagename')) el('mf-hero-stagename').textContent = stageName ? `${stageName} (screen)` : '';
  if (el('mf-hero-style')) el('mf-hero-style').textContent = style ? `"${style}"` : '';
  if (el('mf-hero-companies')) el('mf-hero-companies').innerHTML = [company1, company2].filter(Boolean).map(c => `<div class="mf-hero-company">${c}</div>`).join('');
}

function mfPhotoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    if (!store.myFountain) store.myFountain = {};
    store.myFountain.photo = e.target.result;
    saveStore(); _mfRenderPhoto();
  };
  reader.readAsDataURL(file);
}

// ── Save helpers ─────────────────────────────────────────────

function mfSaveAll(keys) {
  if (!store.myFountain) store.myFountain = {};
  keys.forEach(key => {
    const el = document.getElementById('mf-field-' + key);
    if (!el) return;
    store.myFountain[key] = el.tagName === 'TEXTAREA' ? el.value : el.value;
  });
  saveStore(); _mfUpdateHero();
  showToast('Saved', 'success');
}

// ── Field helpers ────────────────────────────────────────────

function _f(label, key, value, type, placeholder) {
  return `<div>
    <div class="mf-field-label">${label}</div>
    <input class="mf-input" id="mf-field-${key}" type="${type||'text'}" value="${(value||'').replace(/"/g,'&quot;')}" placeholder="${placeholder||''}" oninput="_mfUpdateHeroOnInput('${key}')">
  </div>`;
}

// ── FILMMAKER ────────────────────────────────────────────────

function _mfFilmmaker(mf) {
  return `
  <div class="mf-body-section">
    <div class="mf-body-heading"><div class="mf-body-title">Filmmaker</div><div class="mf-body-sub">Your identity — powers the hero profile above</div></div>

    <div class="mf-role-label">Identity</div>
    <div class="mf-field-row">${_f('Full name','name',mf.name||'','text','Your full name')}${_f('Screen name','stageName',mf.stageName||'','text','e.g. Tom Pappini')}</div>

    <div class="mf-role-label" style="margin-top:20px">Companies</div>
    <div class="mf-field-row">${_f('Primary company','company1',mf.company1||'','text','e.g. Grim Tidings Picture Company')}${_f('Secondary company','company2',mf.company2||'','text','e.g. Oddly Optimistic Pictures')}</div>

    <div class="mf-role-label" style="margin-top:20px">Creative voice</div>
    ${_f('Style / genre statement','style',mf.style||'','text','e.g. Dystopian Realism — ordinary people in slightly-off worlds')}
    <div style="margin-top:14px"><div class="mf-field-label">Bio</div><textarea id="mf-field-bio" class="mf-textarea" rows="4" placeholder="A few sentences about your work and approach…" oninput="_mfUpdateHeroOnInput('bio')">${mf.bio||''}</textarea></div>

    <div class="mf-role-label" style="margin-top:20px">Online</div>
    <div class="mf-field-row">
      ${_f('Website','website',mf.website||'','url','https://yoursite.com')}
      ${_f('Location','location',mf.location||'','text','e.g. Runcorn, UK')}
      ${_f('IMDb','imdb',mf.imdb||'','url','https://imdb.com/name/...')}
      ${_f('Instagram','instagram',mf.instagram||'','text','@handle')}
      ${_f('Letterboxd','letterboxd',mf.letterboxd||'','text','letterboxd.com/...')}
      ${_f('Vimeo','vimeo',mf.vimeo||'','url','vimeo.com/...')}
    </div>
    <button class="mf-btn" style="margin-top:24px" onclick="mfSaveAll(['name','stageName','company1','company2','style','bio','website','location','imdb','instagram','letterboxd','vimeo'])">Save changes</button>
  </div>`;
}

// ── FILMOGRAPHY ──────────────────────────────────────────────

function _mfFilmography(projects, mf) {
  const feMap = {};
  (mf.filmographyExtra||[]).forEach(f => { if(f.projectId) feMap[f.projectId] = f; });
  const extra = (mf.filmographyExtra||[]).filter(f => !f.projectId);
  const statusLabel = {pre:'Pre-prod',prod:'Production',post:'Post-prod',done:'Complete',released:'Released'};
  const statusClass = {pre:'badge-pre',prod:'badge-prod',post:'badge-post',done:'badge-done',released:'badge-released'};

  const _row = (p) => {
    const fe = feMap[p.id] || {};
    const abbr = p.title.split(' ').map(w=>w[0]).join('').toUpperCase().substring(0,5);
    return `
    <div class="mf-credit-row" onclick="mfToggleFilmDetail('${p.id}')">
      <div class="mf-credit-thumb">${p.poster?`<img src="${p.poster}" style="width:100%;height:100%;object-fit:cover">`:`<div class="mf-thumb-abbr">${abbr}</div>`}</div>
      <div class="mf-credit-info">
        <div class="mf-credit-title">${p.title}</div>
        <div class="mf-credit-role">Director${p.company?' · '+p.company:''}</div>
        ${fe.festivals?`<div class="mf-credit-note">${fe.festivals.split('\n')[0]}</div>`:''}
      </div>
      <div class="mf-credit-year">${fe.year||'—'}</div>
      <div class="mf-credit-badge ${statusClass[p.status]||'badge-pre'}">${statusLabel[p.status]||p.status}</div>
    </div>
    <div class="mf-film-detail" id="mf-film-${p.id}" style="display:none">
      <div class="mf-field-row" style="margin-bottom:10px">
        <div><div class="mf-field-label">Year</div><input class="mf-input" id="mffe-year-${p.id}" value="${fe.year||''}" placeholder="2024" onblur="mfSaveFilmExtra('${p.id}')"></div>
        <div><div class="mf-field-label">Runtime</div><input class="mf-input" id="mffe-runtime-${p.id}" value="${fe.runtime||''}" placeholder="12 mins" onblur="mfSaveFilmExtra('${p.id}')"></div>
        <div><div class="mf-field-label">Format</div><input class="mf-input" id="mffe-format-${p.id}" value="${fe.format||''}" placeholder="Short / Feature" onblur="mfSaveFilmExtra('${p.id}')"></div>
      </div>
      <div style="margin-bottom:10px"><div class="mf-field-label">Festivals &amp; results</div><textarea class="mf-textarea" id="mffe-festivals-${p.id}" rows="2" placeholder="e.g. BAFTA Shorts 2024 — Longlisted" onblur="mfSaveFilmExtra('${p.id}')">${fe.festivals||''}</textarea></div>
      <div style="margin-bottom:10px"><div class="mf-field-label">Distribution</div><input class="mf-input" id="mffe-distribution-${p.id}" value="${fe.distribution||''}" placeholder="YouTube, Vimeo, streaming…" onblur="mfSaveFilmExtra('${p.id}')"></div>
      <div style="margin-bottom:10px"><div class="mf-field-label">Press / reviews</div><textarea class="mf-textarea" id="mffe-press-${p.id}" rows="2" placeholder="Notable reviews or coverage" onblur="mfSaveFilmExtra('${p.id}')">${fe.press||''}</textarea></div>
      <div><div class="mf-field-label">Awards</div><input class="mf-input" id="mffe-awards-${p.id}" value="${fe.awards||''}" placeholder="Any awards or nominations" onblur="mfSaveFilmExtra('${p.id}')"></div>
    </div>`;
  };

  return `
  <div class="mf-body-section">
    <div class="mf-body-heading"><div class="mf-body-title">Filmography</div><div class="mf-body-sub">Click any row to expand · Auto-populated from your projects</div></div>

    <div class="mf-role-label">Director</div>
    <div class="mf-credit-list">${projects.length ? projects.map(_row).join('') : '<div class="mf-empty-state">No projects yet.</div>'}</div>

    ${extra.length ? `
      <div class="mf-divider"></div>
      <div class="mf-role-label">Earlier work</div>
      <div class="mf-credit-list">${extra.map((f,i) => `
        <div class="mf-credit-row">
          <div class="mf-credit-thumb"><div class="mf-thumb-abbr">${(f.title||'?').substring(0,4).toUpperCase()}</div></div>
          <div class="mf-credit-info"><div class="mf-credit-title">${f.title||'Untitled'}</div><div class="mf-credit-role">${f.role||'Director'}</div></div>
          <div class="mf-credit-year">${f.year||'—'}</div>
          <button class="mf-ghost-btn" onclick="event.stopPropagation();mfDeleteExtraFilm(${i})">Remove</button>
        </div>`).join('')}
      </div>
    ` : ''}

    <div class="mf-divider"></div>
    <div class="mf-role-label">Add a film made outside Black Fountain</div>
    <div class="mf-field-row" style="margin-bottom:10px">
      <div><div class="mf-field-label">Title</div><input class="mf-input" id="mf-extra-title" placeholder="Film title"></div>
      <div><div class="mf-field-label">Year</div><input class="mf-input" id="mf-extra-year" placeholder="2023"></div>
      <div><div class="mf-field-label">Format</div><input class="mf-input" id="mf-extra-format" placeholder="Short / Feature"></div>
      <div><div class="mf-field-label">Your role</div><input class="mf-input" id="mf-extra-role" placeholder="Director / Producer"></div>
    </div>
    <button class="mf-btn" onclick="mfAddExtraFilm()">Add to filmography</button>
  </div>`;
}

// ── SLATE ────────────────────────────────────────────────────

function _mfSlate(mf) {
  const slate = mf.slate || [];
  const statusColor = {'Idea':'#3a3a52','Developing':'#7dd0f5','Script in progress':'#e6bc3c','Seeking funding':'#d4883a','Funded':'#2ea864','Greenlit':'#b88af0'};
  return `
  <div class="mf-body-section">
    <div class="mf-body-heading"><div class="mf-body-title">Development Slate</div><div class="mf-body-sub">Ideas and projects you're developing</div></div>
    ${!slate.length ? `<div class="mf-empty-state">Your slate is empty.</div>` : ''}
    <div class="mf-credit-list">
      ${slate.map((s,i) => `
      <div class="mf-credit-row">
        <div class="mf-credit-thumb"><div class="mf-thumb-abbr">${(s.title||'?').split(' ').map(w=>w[0]).join('').substring(0,4).toUpperCase()}</div></div>
        <div class="mf-credit-info">
          <div class="mf-credit-title">${s.title||'Untitled'}</div>
          <div class="mf-credit-role">${s.format||''}${s.logline?' — '+s.logline.substring(0,70)+(s.logline.length>70?'…':''):''}</div>
        </div>
        <div class="mf-credit-badge" style="background:${statusColor[s.status]||'#3a3a52'}22;color:${statusColor[s.status]||'#9090a8'}">${s.status||'Idea'}</div>
        <button class="mf-ghost-btn" onclick="event.stopPropagation();mfDeleteSlateItem(${i})">Remove</button>
      </div>`).join('')}
    </div>
    <div class="mf-divider"></div>
    <div class="mf-role-label">Add to slate</div>
    <div class="mf-field-row" style="margin-bottom:10px">
      <div><div class="mf-field-label">Title</div><input class="mf-input" id="mf-slate-title" placeholder="Working title"></div>
      <div><div class="mf-field-label">Status</div><select class="mf-input" id="mf-slate-status"><option>Idea</option><option>Developing</option><option>Script in progress</option><option>Seeking funding</option><option>Funded</option><option>Greenlit</option></select></div>
      <div><div class="mf-field-label">Format</div><select class="mf-input" id="mf-slate-format"><option value="">—</option><option>Short</option><option>Feature</option><option>Documentary</option><option>Series</option><option>Micro / experimental</option></select></div>
    </div>
    <div style="margin-bottom:14px"><div class="mf-field-label">Logline</div><textarea class="mf-textarea" id="mf-slate-logline" rows="2" placeholder="One or two sentences…"></textarea></div>
    <button class="mf-btn" onclick="mfAddSlateItem()">Add to slate</button>
  </div>`;
}

// ── COLLABORATORS ────────────────────────────────────────────

function _mfCollaborators(projects) {
  const mf = store.myFountain || {};
  const myNames = [mf.name, mf.stageName].filter(Boolean).map(n=>n.toLowerCase());
  const people = {};
  projects.forEach(p => {
    const add = (name, role) => {
      if (!name) return;
      if (myNames.some(n => name.toLowerCase().includes(n.split(' ')[0]))) return;
      const key = name.toLowerCase().trim();
      if (!people[key]) people[key] = { name, roles:new Set(), projects:new Set(), count:0 };
      people[key].roles.add(role); people[key].projects.add(p.title); people[key].count++;
    };
    (Array.isArray(p.directors)?p.directors:[p.director]).filter(Boolean).forEach(d=>add(d,'Director'));
    (p.cast||[]).forEach(c=>add(c.name,c.role||'Cast'));
    (p.unit||[]).forEach(c=>add(c.name,c.role||'Crew'));
    (p.callsheets||[]).forEach(cs=>{
      (cs.crew||[]).forEach(c=>add(c.name,c.role||'Crew'));
      (cs.cast||[]).forEach(c=>add(c.name,c.role||'Cast'));
    });
  });
  const sorted = Object.values(people).sort((a,b)=>b.count-a.count);
  const frequent = sorted.filter(p=>p.count>1);
  const oneOff   = sorted.filter(p=>p.count===1);
  const _row = person => `
    <div class="mf-credit-row" style="cursor:default">
      <div class="mf-collab-avatar">${person.name.charAt(0).toUpperCase()}</div>
      <div class="mf-credit-info">
        <div class="mf-credit-title">${person.name}</div>
        <div class="mf-credit-role">${[...person.roles].join(', ')}</div>
        <div class="mf-credit-note">${[...person.projects].join(', ')}</div>
      </div>
      <div class="mf-credit-badge badge-pre">${person.count} credit${person.count!==1?'s':''}</div>
    </div>`;
  return `
  <div class="mf-body-section">
    <div class="mf-body-heading"><div class="mf-body-title">Collaborators</div><div class="mf-body-sub">${sorted.length} people across your projects</div></div>
    ${!sorted.length?`<div class="mf-empty-state">Add cast and crew to your projects and they'll appear here.</div>`:''}
    ${frequent.length?`<div class="mf-role-label">Recurring</div><div class="mf-credit-list">${frequent.map(_row).join('')}</div>`:''}
    ${oneOff.length?`<div class="mf-divider"></div><div class="mf-role-label">One-time</div><div class="mf-credit-list">${oneOff.map(_row).join('')}</div>`:''}
  </div>`;
}

// ── STATS ────────────────────────────────────────────────────

function _mfStats(projects, mf) {
  let shootDays=0,scenes=0,shots=0,budget=0,cast=0,crew=0;
  const people=new Set();
  projects.forEach(p=>{
    shootDays+=(p.callsheets||[]).length; scenes+=(p.scenes||[]).length; shots+=(p.shots||[]).length;
    cast+=(p.cast||[]).length; crew+=(p.unit||[]).length;
    (p.cast||[]).forEach(c=>{if(c.name)people.add(c.name.toLowerCase())});
    (p.unit||[]).forEach(c=>{if(c.name)people.add(c.name.toLowerCase())});
    (p.budget||[]).forEach(b=>{budget+=parseFloat(b.est)||0});
    (p.budgetAbove||[]).forEach(b=>{budget+=parseFloat(b.est)||0});
  });
  const _s = (n,l) => `<div class="mf-stat-block"><div class="mf-stat-big">${n}</div><div class="mf-stat-lbl">${l}</div></div>`;
  const statusLabel={pre:'Pre-prod',prod:'Production',post:'Post-prod',done:'Complete',released:'Released'};
  return `
  <div class="mf-body-section">
    <div class="mf-body-heading"><div class="mf-body-title">Stats</div><div class="mf-body-sub">Your career by the numbers</div></div>
    <div class="mf-role-label">Projects</div>
    <div class="mf-stat-grid">
      ${_s(projects.length,'Total')}
      ${['pre','prod','post','done','released'].map(s=>_s(projects.filter(p=>p.status===s).length,statusLabel[s])).join('')}
    </div>
    <div class="mf-divider"></div>
    <div class="mf-role-label">Production</div>
    <div class="mf-stat-grid">
      ${_s(shootDays,'Shoot days')}${_s(scenes,'Scenes broken down')}${_s(shots,'Shots listed')}${_s('£'+Math.round(budget).toLocaleString(),'Budget estimated')}
    </div>
    <div class="mf-divider"></div>
    <div class="mf-role-label">People</div>
    <div class="mf-stat-grid">${_s(people.size,'Unique collaborators')}${_s(cast,'Cast entries')}${_s(crew,'Crew entries')}</div>
    ${(() => {
      const byCompany={};
      projects.forEach(p=>{const co=p.company||'Unknown';if(!byCompany[co])byCompany[co]=0;byCompany[co]++;});
      const entries=Object.entries(byCompany).sort((a,b)=>b[1]-a[1]);
      if(!entries.length)return '';
      return `<div class="mf-divider"></div><div class="mf-role-label">By company</div>
      <div class="mf-credit-list">${entries.map(([co,n])=>`
        <div class="mf-credit-row" style="cursor:default">
          <div class="mf-credit-info"><div class="mf-credit-title">${co}</div></div>
          <div class="mf-credit-year">${n} project${n!==1?'s':''}</div>
        </div>`).join('')}</div>`;
    })()}
  </div>`;
}

// ── CV ───────────────────────────────────────────────────────

function _mfCV(projects, mf) {
  const feMap={};
  (mf.filmographyExtra||[]).forEach(f=>{if(f.projectId)feMap[f.projectId]=f;});
  const finished=projects.filter(p=>p.status==='done'||p.status==='released')
    .sort((a,b)=>((feMap[b.id]||{}).year||'0').localeCompare((feMap[a.id]||{}).year||'0'));
  const name=mf.stageName||mf.name||'Your Name';
  return `
  <div class="mf-body-section">
    <div class="mf-body-heading">
      <div class="mf-body-title">CV / Press Kit</div>
      <div class="mf-body-sub">Auto-generated from your data &nbsp;·&nbsp; <button class="mf-inline-btn" onclick="mfExportCV()">⬇ Export PDF</button></div>
    </div>
    <div class="mf-cv-preview" id="mf-cv-preview">
      <div class="mf-cv-name">${name}</div>
      ${[mf.company1,mf.company2].filter(Boolean).map(c=>`<div class="mf-cv-company">${c}</div>`).join('')}
      ${mf.style?`<div class="mf-cv-style">"${mf.style}"</div>`:''}
      ${[mf.website,mf.location,mf.imdb].filter(Boolean).map(v=>`<div class="mf-cv-meta">${v}</div>`).join('')}
      ${mf.bio?`<div class="mf-cv-section-title">About</div><div class="mf-cv-body">${mf.bio}</div>`:''}
      <div class="mf-cv-section-title">Director</div>
      ${finished.length?finished.map(p=>{
        const fe=feMap[p.id]||{};
        return `<div class="mf-cv-credit">
          <div class="mf-cv-credit-title">${p.title}</div>
          <div class="mf-cv-credit-meta">${[fe.year,fe.format||p.genre,p.company].filter(Boolean).join(' · ')}</div>
          ${fe.festivals?`<div class="mf-cv-credit-note">${fe.festivals.split('\n')[0]}</div>`:''}
          ${fe.awards?`<div class="mf-cv-credit-note">🏆 ${fe.awards}</div>`:''}
        </div>`;}).join(''):`<div class="mf-cv-body" style="opacity:0.4">No completed films yet.</div>`}
      ${(mf.filmographyExtra||[]).filter(f=>!f.projectId).length?`
        <div class="mf-cv-section-title">Earlier work</div>
        ${(mf.filmographyExtra||[]).filter(f=>!f.projectId).map(f=>`<div class="mf-cv-credit">
          <div class="mf-cv-credit-title">${f.title||'Untitled'}</div>
          <div class="mf-cv-credit-meta">${[f.year,f.format,f.role].filter(Boolean).join(' · ')}</div>
        </div>`).join('')}`:''}
    </div>
  </div>`;
}

// ── GOALS ────────────────────────────────────────────────────

function _mfGoals(mf) {
  const goals=mf.goals||[];
  const sc={'Not started':'var(--border)','In progress':'var(--accent)','Done':'var(--green)'};
  return `
  <div class="mf-body-section">
    <div class="mf-body-heading"><div class="mf-body-title">Goals</div><div class="mf-body-sub">Personal milestones — nothing to do with any specific project</div></div>
    ${!goals.length?`<div class="mf-empty-state">What do you want to achieve as a filmmaker?</div>`:''}
    <div class="mf-credit-list">
      ${goals.map((g,i)=>`
      <div class="mf-credit-row" style="cursor:default">
        <div style="width:8px;height:8px;border-radius:50%;background:${sc[g.status]||'var(--border)'};flex-shrink:0;margin-top:2px"></div>
        <div class="mf-credit-info">
          <div class="mf-credit-title${g.status==='Done'?' mf-strikethrough':''}">${g.text}</div>
          <select class="mf-goal-sel" onchange="mfUpdateGoalStatus(${i},this.value)">
            ${['Not started','In progress','Done'].map(s=>`<option${g.status===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <button class="mf-ghost-btn" onclick="mfDeleteGoal(${i})">✕</button>
      </div>`).join('')}
    </div>
    <div class="mf-divider"></div>
    <div class="mf-field-row" style="align-items:flex-end">
      <div style="flex:1"><div class="mf-field-label">New goal</div><input class="mf-input" id="mf-goal-input" placeholder="e.g. Make a film over 20 minutes" onkeydown="if(event.key==='Enter')mfAddGoal()"></div>
      <button class="mf-btn" onclick="mfAddGoal()">Add</button>
    </div>
  </div>`;
}

// ── ACCOUNT ──────────────────────────────────────────────────

function _mfAccount() {
  const user=window._supabaseUser||null;
  return `
  <div class="mf-body-section">
    <div class="mf-body-heading"><div class="mf-body-title">Account</div><div class="mf-body-sub">Sign-in, sync and data management</div></div>
    <div class="mf-role-label">Cloud sync</div>
    <div class="mf-credit-list">
      <div class="mf-credit-row" style="cursor:default">
        <div style="width:8px;height:8px;border-radius:50%;background:${user?'var(--green)':'var(--border)'};flex-shrink:0"></div>
        <div class="mf-credit-info">
          <div class="mf-credit-title">${user?`Signed in as ${user.email}`:'Not signed in'}</div>
          <div class="mf-credit-role">${user?'Data syncs across devices':'Sign in to sync across devices'}</div>
        </div>
        ${user?`<button class="mf-ghost-btn" onclick="sbSignOut&&sbSignOut()">Sign out</button>`:`<button class="mf-btn" onclick="sbGoogleSignIn&&sbGoogleSignIn()">Sign in</button>`}
      </div>
    </div>
    <div class="mf-divider"></div>
    <div class="mf-role-label">Data</div>
    <div class="mf-credit-list">
      <div class="mf-credit-row" style="cursor:default">
        <div class="mf-credit-info"><div class="mf-credit-title">Export all data</div><div class="mf-credit-role">Download a full JSON backup</div></div>
        <button class="mf-btn" onclick="exportStore()">⬇ Export</button>
      </div>
      <div class="mf-credit-row" style="cursor:default">
        <div class="mf-credit-info"><div class="mf-credit-title">Import data</div><div class="mf-credit-role">Restore from a previous backup</div></div>
        <label class="mf-btn" style="cursor:pointer">⬆ Import<input type="file" accept=".json" style="display:none" onchange="importStore(this)"></label>
      </div>
    </div>
    <div class="mf-divider"></div>
    <div class="mf-role-label" style="color:var(--red)">Danger zone</div>
    <div class="mf-credit-list">
      <div class="mf-credit-row" style="cursor:default;border:1px solid rgba(196,68,68,0.2);border-radius:var(--radius)">
        <div class="mf-credit-info"><div class="mf-credit-title">Clear all data</div><div class="mf-credit-role">Permanently delete everything from this browser. Cannot be undone.</div></div>
        <button class="mf-ghost-btn" style="border-color:rgba(196,68,68,0.3);color:var(--red)" onclick="openClearDataModal()">Delete</button>
      </div>
    </div>
  </div>`;
}

// ── Filmography actions ──────────────────────────────────────

function mfToggleFilmDetail(id) {
  const el=document.getElementById('mf-film-'+id); if(!el)return;
  el.style.display=el.style.display==='none'?'block':'none';
}

function mfSaveFilmExtra(projectId) {
  if(!store.myFountain)store.myFountain={};
  if(!store.myFountain.filmographyExtra)store.myFountain.filmographyExtra=[];
  const idx=store.myFountain.filmographyExtra.findIndex(f=>f.projectId===projectId);
  const g=id=>document.getElementById(id)?.value||'';
  const data={projectId,year:g(`mffe-year-${projectId}`),runtime:g(`mffe-runtime-${projectId}`),
    format:g(`mffe-format-${projectId}`),festivals:g(`mffe-festivals-${projectId}`),
    distribution:g(`mffe-distribution-${projectId}`),press:g(`mffe-press-${projectId}`),awards:g(`mffe-awards-${projectId}`)};
  if(idx>=0)store.myFountain.filmographyExtra[idx]=data;
  else store.myFountain.filmographyExtra.push(data);
  saveStore();
}

function mfAddExtraFilm() {
  const title=document.getElementById('mf-extra-title')?.value.trim();
  if(!title){showToast('Enter a title','info');return;}
  if(!store.myFountain)store.myFountain={};
  if(!store.myFountain.filmographyExtra)store.myFountain.filmographyExtra=[];
  store.myFountain.filmographyExtra.push({title,year:document.getElementById('mf-extra-year')?.value||'',
    format:document.getElementById('mf-extra-format')?.value||'',role:document.getElementById('mf-extra-role')?.value||''});
  saveStore();mfShowSection('filmography');
}

function mfDeleteExtraFilm(i) {
  const extras=(store.myFountain?.filmographyExtra||[]).filter(f=>!f.projectId);
  extras.splice(i,1);
  store.myFountain.filmographyExtra=[(store.myFountain.filmographyExtra||[]).filter(f=>f.projectId),...extras].flat();
  saveStore();mfShowSection('filmography');
}

function mfAddSlateItem() {
  const title=document.getElementById('mf-slate-title')?.value.trim();
  if(!title){showToast('Enter a title','info');return;}
  if(!store.myFountain)store.myFountain={};
  if(!store.myFountain.slate)store.myFountain.slate=[];
  store.myFountain.slate.push({title,status:document.getElementById('mf-slate-status')?.value||'Idea',
    format:document.getElementById('mf-slate-format')?.value||'',logline:document.getElementById('mf-slate-logline')?.value||''});
  saveStore();mfShowSection('slate');
}

function mfDeleteSlateItem(i) {
  store.myFountain.slate.splice(i,1);saveStore();mfShowSection('slate');
}

function mfAddGoal() {
  const text=document.getElementById('mf-goal-input')?.value.trim();if(!text)return;
  if(!store.myFountain)store.myFountain={};
  if(!store.myFountain.goals)store.myFountain.goals=[];
  store.myFountain.goals.push({text,status:'Not started'});
  saveStore();mfShowSection('goals');
}

function mfDeleteGoal(i) { store.myFountain.goals.splice(i,1);saveStore();mfShowSection('goals'); }
function mfUpdateGoalStatus(i,status) { store.myFountain.goals[i].status=status;saveStore();mfShowSection('goals'); }

function mfExportCV() {
  const el=document.getElementById('mf-cv-preview');if(!el)return;
  const mf=store.myFountain||{};const name=mf.stageName||mf.name||'CV';
  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>${name} — CV</title>
  <style>body{font-family:Georgia,serif;max-width:680px;margin:48px auto;color:#111;font-size:14px;line-height:1.65}
  h1{font-size:32px;margin:0 0 4px}.sub,.meta{color:#666;font-size:13px;margin-bottom:3px}
  .style{font-style:italic;color:#444;margin:8px 0 16px;font-size:13px}
  hr{border:none;border-top:1px solid #ddd;margin:20px 0}
  h2{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#999;margin:24px 0 8px}
  .credit{margin-bottom:12px}.credit-title{font-weight:bold;font-size:14px}
  .credit-meta{color:#666;font-size:12px}.credit-note{color:#555;font-size:12px;font-style:italic}
  </style></head><body>
  <h1>${name}</h1>
  ${[mf.company1,mf.company2].filter(Boolean).map(c=>`<div class="sub">${c}</div>`).join('')}
  ${mf.style?`<div class="style">"${mf.style}"</div>`:''}
  ${[mf.website,mf.location].filter(Boolean).map(v=>`<div class="meta">${v}</div>`).join('')}
  ${mf.bio?`<hr><h2>About</h2><p>${mf.bio}</p>`:''}
  <hr><h2>Director</h2>
  ${[...el.querySelectorAll('.mf-cv-credit')].map(c=>`<div class="credit">
    <div class="credit-title">${c.querySelector('.mf-cv-credit-title')?.textContent||''}</div>
    <div class="credit-meta">${c.querySelector('.mf-cv-credit-meta')?.textContent||''}</div>
    ${[...c.querySelectorAll('.mf-cv-credit-note')].map(n=>`<div class="credit-note">${n.textContent}</div>`).join('')}
  </div>`).join('')||'<p style="color:#999">No completed films yet.</p>'}
  </body></html>`);
  win.document.close();win.print();
}
// ══════════════════════════════════════════