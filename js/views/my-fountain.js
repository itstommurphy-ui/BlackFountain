// ══════════════════════════════════════════
// MY FOUNTAIN
// ══════════════════════════════════════════

let _mfSection = 'filmmaker';

function renderMyFountain() {
  // Update sidebar name
  const mf = store.myFountain || {};
  const nameEl = document.getElementById('mf-sidebar-name');
  if (nameEl) nameEl.textContent = mf.stageName || mf.name || '—';
  mfShowSection(_mfSection);
}

function mfShowSection(section) {
  _mfSection = section;

  // Update nav active state
  document.querySelectorAll('.mf-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  const content = document.getElementById('mf-content');
  if (!content) return;

  const mf = store.myFountain || {};
  const projects = store.projects || [];

  switch (section) {
    case 'filmmaker':   content.innerHTML = _mfFilmmaker(mf); break;
    case 'filmography': content.innerHTML = _mfFilmography(projects); break;
    case 'slate':       content.innerHTML = _mfSlate(mf); break;
    case 'collaborators': content.innerHTML = _mfCollaborators(projects); break;
    case 'stats':       content.innerHTML = _mfStats(projects, mf); break;
    case 'cv':          content.innerHTML = _mfCV(projects, mf); break;
    case 'goals':       content.innerHTML = _mfGoals(mf); break;
    case 'account':     content.innerHTML = _mfAccount(); break;
    default:            content.innerHTML = '';
  }
}

// ── Save helpers ────────────────────────────────────────────

function mfSave(key, value) {
  if (!store.myFountain) store.myFountain = {};
  store.myFountain[key] = value;
  saveStore();
  // Update sidebar name if relevant field changed
  if (key === 'name' || key === 'stageName') {
    const nameEl = document.getElementById('mf-sidebar-name');
    if (nameEl) nameEl.textContent = store.myFountain.stageName || store.myFountain.name || '—';
  }
}

function mfSaveField(key) {
  const el = document.getElementById('mf-field-' + key);
  if (!el) return;
  mfSave(key, el.value || el.textContent);
}

function mfSaveAll(keys) {
  if (!store.myFountain) store.myFountain = {};
  keys.forEach(key => {
    const el = document.getElementById('mf-field-' + key);
    if (el) store.myFountain[key] = el.value !== undefined ? el.value : el.textContent;
  });
  saveStore();
  showToast('Saved', 'success');
}

// ── Section renderers ────────────────────────────────────────

function _mfFilmmaker(mf) {
  return `
  <div class="mf-section-header">
    <div class="mf-section-title">Filmmaker</div>
    <div class="mf-section-sub">Your creative identity</div>
  </div>

  <div class="mf-card">
    <div class="mf-field-grid">
      ${_mfField('Name', 'name', mf.name || '', 'text', 'Your full name')}
      ${_mfField('Stage / screen name', 'stageName', mf.stageName || '', 'text', 'e.g. Tom Pappini')}
    </div>
  </div>

  <div class="mf-card">
    <div class="mf-card-label">Production companies</div>
    <div class="mf-field-grid">
      ${_mfField('Primary company', 'company1', mf.company1 || '', 'text', 'e.g. Grim Tidings Picture Company')}
      ${_mfField('Secondary company', 'company2', mf.company2 || '', 'text', 'e.g. Oddly Optimistic Pictures')}
    </div>
  </div>

  <div class="mf-card">
    <div class="mf-card-label">Creative identity</div>
    ${_mfField('Style / genre statement', 'style', mf.style || '', 'text', 'e.g. Dystopian Realism — ordinary people in slightly-off worlds')}
    <div style="margin-top:14px">
      <label class="mf-label">Bio</label>
      <textarea id="mf-field-bio" class="mf-textarea" placeholder="A few sentences about your work and approach…" rows="4">${mf.bio || ''}</textarea>
    </div>
    <div style="margin-top:14px">
      ${_mfField('Website', 'website', mf.website || '', 'url', 'https://yoursite.com')}
    </div>
    <div style="margin-top:14px">
      ${_mfField('Location', 'location', mf.location || '', 'text', 'e.g. Runcorn, UK')}
    </div>
  </div>

  <div class="mf-card">
    <div class="mf-card-label">Social & contact</div>
    <div class="mf-field-grid">
      ${_mfField('IMDb', 'imdb', mf.imdb || '', 'url', 'https://imdb.com/name/...')}
      ${_mfField('Instagram', 'instagram', mf.instagram || '', 'text', '@handle')}
      ${_mfField('Letterboxd', 'letterboxd', mf.letterboxd || '', 'text', 'letterboxd.com/...')}
      ${_mfField('Vimeo', 'vimeo', mf.vimeo || '', 'url', 'vimeo.com/...')}
    </div>
  </div>

  <button class="mf-save-btn" onclick="mfSaveAll(['name','stageName','company1','company2','style','bio','website','location','imdb','instagram','letterboxd','vimeo'])">Save changes</button>
  `;
}

function _mfFilmography(projects) {
  const finished = projects.filter(p => p.status === 'done' || p.status === 'released');
  const mf = store.myFountain || {};
  const extra = mf.filmographyExtra || [];

  return `
  <div class="mf-section-header">
    <div class="mf-section-title">Filmography</div>
    <div class="mf-section-sub">Your finished work</div>
  </div>

  ${finished.length === 0 && extra.length === 0 ? `
    <div class="mf-empty">
      <div class="mf-empty-title">No finished films yet</div>
      <div class="mf-empty-sub">Projects marked Complete or Released will appear here automatically.</div>
    </div>
  ` : ''}

  ${finished.map(p => {
    const directors = Array.isArray(p.directors) && p.directors.length ? p.directors.join(', ') : (p.director || '—');
    const fe = (mf.filmographyExtra || []).find(f => f.projectId === p.id) || {};
    return `
    <div class="mf-film-card">
      <div class="mf-film-top">
        <div>
          <div class="mf-film-num">#${String(p.num).padStart(3,'0')} · ${p.status === 'released' ? 'Released' : 'Complete'}</div>
          <div class="mf-film-title">${p.title}</div>
          <div class="mf-film-meta">${directors}${p.genre ? ' · ' + p.genre : ''}${p.company ? ' · ' + p.company : ''}</div>
        </div>
        <button class="mf-film-expand-btn" onclick="mfToggleFilmDetail('${p.id}')">Details ▾</button>
      </div>
      <div class="mf-film-detail" id="mf-film-${p.id}" style="display:none">
        <div class="mf-field-grid" style="margin-top:14px">
          <div>
            <label class="mf-label">Year</label>
            <input class="mf-input" id="mffe-year-${p.id}" value="${fe.year||''}" placeholder="2024" onblur="mfSaveFilmExtra('${p.id}')">
          </div>
          <div>
            <label class="mf-label">Runtime</label>
            <input class="mf-input" id="mffe-runtime-${p.id}" value="${fe.runtime||''}" placeholder="12 mins" onblur="mfSaveFilmExtra('${p.id}')">
          </div>
          <div>
            <label class="mf-label">Format</label>
            <input class="mf-input" id="mffe-format-${p.id}" value="${fe.format||''}" placeholder="Short / Feature / Doc" onblur="mfSaveFilmExtra('${p.id}')">
          </div>
        </div>
        <div style="margin-top:12px">
          <label class="mf-label">Festival submissions & results</label>
          <textarea class="mf-textarea" id="mffe-festivals-${p.id}" rows="3" placeholder="e.g. BAFTA Shorts 2024 — Longlisted" onblur="mfSaveFilmExtra('${p.id}')">${fe.festivals||''}</textarea>
        </div>
        <div style="margin-top:12px">
          <label class="mf-label">Distribution / where to watch</label>
          <input class="mf-input" id="mffe-distribution-${p.id}" value="${fe.distribution||''}" placeholder="YouTube, Vimeo, streaming service…" onblur="mfSaveFilmExtra('${p.id}')">
        </div>
        <div style="margin-top:12px">
          <label class="mf-label">Press / reviews</label>
          <textarea class="mf-textarea" id="mffe-press-${p.id}" rows="2" placeholder="Notable reviews or press coverage" onblur="mfSaveFilmExtra('${p.id}')">${fe.press||''}</textarea>
        </div>
        <div style="margin-top:12px">
          <label class="mf-label">Awards</label>
          <input class="mf-input" id="mffe-awards-${p.id}" value="${fe.awards||''}" placeholder="Any awards or nominations" onblur="mfSaveFilmExtra('${p.id}')">
        </div>
      </div>
    </div>`;
  }).join('')}

  ${extra.filter(f => !f.projectId).map((f, i) => `
    <div class="mf-film-card">
      <div class="mf-film-top">
        <div>
          <div class="mf-film-num">External</div>
          <div class="mf-film-title">${f.title || 'Untitled'}</div>
          <div class="mf-film-meta">${f.year||''} ${f.format||''}</div>
        </div>
        <button class="mf-danger-btn" onclick="mfDeleteExtraFilm(${i})">Remove</button>
      </div>
    </div>
  `).join('')}

  <div class="mf-card" style="margin-top:16px">
    <div class="mf-card-label">Add a film made outside Black Fountain</div>
    <div class="mf-field-grid">
      <div><label class="mf-label">Title</label><input class="mf-input" id="mf-extra-title" placeholder="Film title"></div>
      <div><label class="mf-label">Year</label><input class="mf-input" id="mf-extra-year" placeholder="2023"></div>
      <div><label class="mf-label">Format</label><input class="mf-input" id="mf-extra-format" placeholder="Short / Feature"></div>
      <div><label class="mf-label">Role</label><input class="mf-input" id="mf-extra-role" placeholder="Director / Producer"></div>
    </div>
    <button class="mf-save-btn" style="margin-top:12px" onclick="mfAddExtraFilm()">Add to filmography</button>
  </div>
  `;
}

function _mfSlate(mf) {
  const slate = mf.slate || [];
  return `
  <div class="mf-section-header">
    <div class="mf-section-title">Development Slate</div>
    <div class="mf-section-sub">Ideas and projects in development</div>
  </div>

  ${slate.length === 0 ? `<div class="mf-empty"><div class="mf-empty-title">Your slate is empty</div><div class="mf-empty-sub">Add films you're developing — ideas, scripts in progress, projects awaiting funding.</div></div>` : ''}

  ${slate.map((s, i) => `
    <div class="mf-film-card">
      <div class="mf-film-top">
        <div style="flex:1;min-width:0">
          <div class="mf-film-num">${s.status || 'Idea'}</div>
          <div class="mf-film-title">${s.title || 'Untitled'}</div>
          <div class="mf-film-meta">${s.format || ''}${s.logline ? ' — ' + s.logline.substring(0,80) + (s.logline.length > 80 ? '…' : '') : ''}</div>
        </div>
        <button class="mf-danger-btn" onclick="mfDeleteSlateItem(${i})">Remove</button>
      </div>
    </div>
  `).join('')}

  <div class="mf-card" style="margin-top:16px">
    <div class="mf-card-label">Add to slate</div>
    <div class="mf-field-grid">
      <div><label class="mf-label">Title</label><input class="mf-input" id="mf-slate-title" placeholder="Working title"></div>
      <div>
        <label class="mf-label">Status</label>
        <select class="mf-input" id="mf-slate-status">
          <option value="Idea">Idea</option>
          <option value="Developing">Developing</option>
          <option value="Script in progress">Script in progress</option>
          <option value="Seeking funding">Seeking funding</option>
          <option value="Funded">Funded</option>
          <option value="Greenlit">Greenlit</option>
        </select>
      </div>
      <div>
        <label class="mf-label">Format</label>
        <select class="mf-input" id="mf-slate-format">
          <option value="">—</option>
          <option value="Short">Short</option>
          <option value="Feature">Feature</option>
          <option value="Documentary">Documentary</option>
          <option value="Series">Series</option>
          <option value="Micro / experimental">Micro / experimental</option>
        </select>
      </div>
    </div>
    <div style="margin-top:12px">
      <label class="mf-label">Logline</label>
      <textarea class="mf-textarea" id="mf-slate-logline" rows="2" placeholder="One or two sentences…"></textarea>
    </div>
    <button class="mf-save-btn" style="margin-top:12px" onclick="mfAddSlateItem()">Add to slate</button>
  </div>
  `;
}

function _mfCollaborators(projects) {
  const people = {};

  projects.forEach(p => {
    const addPerson = (name, role, projTitle) => {
      if (!name || name === '—') return;
      const key = name.toLowerCase().trim();
      if (!people[key]) people[key] = { name, roles: {}, projects: new Set(), count: 0 };
      if (!people[key].roles[role]) people[key].roles[role] = 0;
      people[key].roles[role]++;
      people[key].projects.add(projTitle);
      people[key].count++;
    };

    // Directors
    const dirs = Array.isArray(p.directors) ? p.directors : (p.director ? [p.director] : []);
    dirs.forEach(d => addPerson(d, 'Director', p.title));

    // Cast
    (p.cast || []).forEach(c => addPerson(c.name, c.role || 'Cast', p.title));

    // Crew via callsheets
    (p.callsheets || []).forEach(cs => {
      (cs.crew || []).forEach(c => addPerson(c.name, c.role || 'Crew', p.title));
      (cs.cast || []).forEach(c => addPerson(c.name, c.character ? `${c.role||'Cast'} (${c.character})` : (c.role||'Cast'), p.title));
    });

    // Unit
    (p.unit || []).forEach(c => addPerson(c.name, c.role || 'Crew', p.title));
  });

  const sorted = Object.values(people).sort((a,b) => b.count - a.count);

  return `
  <div class="mf-section-header">
    <div class="mf-section-title">Collaborators</div>
    <div class="mf-section-sub">${sorted.length} people across your projects</div>
  </div>

  ${sorted.length === 0 ? `<div class="mf-empty"><div class="mf-empty-title">No collaborators found</div><div class="mf-empty-sub">Add cast and crew to your projects and they'll appear here.</div></div>` : ''}

  <div class="mf-collab-grid">
    ${sorted.map(person => {
      const roleStr = Object.entries(person.roles).map(([r,n]) => n > 1 ? `${r} (×${n})` : r).join(', ');
      const projList = [...person.projects].join(', ');
      return `
      <div class="mf-collab-card">
        <div class="mf-collab-avatar">${person.name.charAt(0).toUpperCase()}</div>
        <div class="mf-collab-info">
          <div class="mf-collab-name">${person.name}</div>
          <div class="mf-collab-role">${roleStr}</div>
          <div class="mf-collab-projects">${projList}</div>
        </div>
        <div class="mf-collab-count">${person.count}</div>
      </div>`;
    }).join('')}
  </div>
  `;
}

function _mfStats(projects, mf) {
  const total = projects.length;
  const released = projects.filter(p => p.status === 'released').length;
  const complete = projects.filter(p => p.status === 'done').length;
  const inProd = projects.filter(p => p.status === 'prod').length;

  let totalShootDays = 0;
  let totalCast = 0;
  let totalCrew = 0;
  let totalScenes = 0;
  let totalShots = 0;
  let totalBudget = 0;

  const peopleSet = new Set();

  projects.forEach(p => {
    // Shoot days from callsheets
    totalShootDays += (p.callsheets || []).length;

    // Cast
    (p.cast || []).forEach(c => { if(c.name) peopleSet.add(c.name.toLowerCase()); });
    totalCast += (p.cast || []).length;

    // Crew
    totalCrew += (p.unit || []).length;
    (p.unit || []).forEach(c => { if(c.name) peopleSet.add(c.name.toLowerCase()); });

    // Breakdown scenes
    totalScenes += (p.scenes || []).length;

    // Shot list
    totalShots += (p.shots || []).length;

    // Budget
    (p.budget || []).forEach(b => { totalBudget += parseFloat(b.est) || 0; });
    (p.budgetAbove || []).forEach(b => { totalBudget += parseFloat(b.est) || 0; });
  });

  const stat = (label, value, sub) => `
    <div class="mf-stat-card">
      <div class="mf-stat-value">${value}</div>
      <div class="mf-stat-label">${label}</div>
      ${sub ? `<div class="mf-stat-sub">${sub}</div>` : ''}
    </div>`;

  return `
  <div class="mf-section-header">
    <div class="mf-section-title">Stats</div>
    <div class="mf-section-sub">Your career at a glance</div>
  </div>

  <div class="mf-stat-grid">
    ${stat('Total projects', total)}
    ${stat('Released', released)}
    ${stat('Complete', complete)}
    ${stat('In production', inProd)}
  </div>

  <div class="mf-section-divider">Production</div>
  <div class="mf-stat-grid">
    ${stat('Shoot days logged', totalShootDays)}
    ${stat('Scenes broken down', totalScenes)}
    ${stat('Shots listed', totalShots)}
    ${stat('Budget estimated', '£' + Math.round(totalBudget).toLocaleString())}
  </div>

  <div class="mf-section-divider">People</div>
  <div class="mf-stat-grid">
    ${stat('Unique collaborators', peopleSet.size)}
    ${stat('Cast entries', totalCast)}
    ${stat('Crew entries', totalCrew)}
  </div>

  <div class="mf-section-divider">By company</div>
  ${(() => {
    const byCompany = {};
    projects.forEach(p => {
      const co = p.company || 'Unknown';
      if (!byCompany[co]) byCompany[co] = 0;
      byCompany[co]++;
    });
    return `<div class="mf-collab-grid">
      ${Object.entries(byCompany).sort((a,b)=>b[1]-a[1]).map(([co,n]) => `
        <div class="mf-collab-card" style="align-items:center">
          <div style="flex:1">
            <div class="mf-collab-name">${co}</div>
          </div>
          <div class="mf-collab-count">${n} project${n!==1?'s':''}</div>
        </div>`).join('')}
    </div>`;
  })()}
  `;
}

function _mfCV(projects, mf) {
  const finished = projects.filter(p => p.status === 'done' || p.status === 'released')
    .sort((a,b) => {
      const fe_a = ((mf.filmographyExtra||[]).find(f=>f.projectId===a.id)||{}).year || '0';
      const fe_b = ((mf.filmographyExtra||[]).find(f=>f.projectId===b.id)||{}).year || '0';
      return fe_b.localeCompare(fe_a);
    });

  const name = mf.stageName || mf.name || 'Your Name';
  const company = [mf.company1, mf.company2].filter(Boolean).join(' / ');

  return `
  <div class="mf-section-header">
    <div class="mf-section-title">CV / Press Kit</div>
    <div class="mf-section-sub">Auto-generated from your data</div>
  </div>

  <div class="mf-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div class="mf-card-label">Director's CV</div>
      <button class="mf-save-btn" onclick="mfExportCV()">⬇ Export PDF</button>
    </div>

    <div class="mf-cv-preview" id="mf-cv-preview">
      <div class="mf-cv-name">${name}</div>
      ${company ? `<div class="mf-cv-company">${company}</div>` : ''}
      ${mf.style ? `<div class="mf-cv-style">${mf.style}</div>` : ''}
      ${mf.website ? `<div class="mf-cv-meta">${mf.website}</div>` : ''}
      ${mf.location ? `<div class="mf-cv-meta">${mf.location}</div>` : ''}

      ${mf.bio ? `
        <div class="mf-cv-section-title">About</div>
        <div class="mf-cv-body">${mf.bio}</div>
      ` : ''}

      <div class="mf-cv-section-title">Filmography</div>
      ${finished.length ? finished.map(p => {
        const fe = (mf.filmographyExtra||[]).find(f=>f.projectId===p.id)||{};
        const dir = Array.isArray(p.directors)&&p.directors.length ? p.directors.join(', ') : (p.director||name);
        return `<div class="mf-cv-credit">
          <div class="mf-cv-credit-title">${p.title}</div>
          <div class="mf-cv-credit-meta">${fe.year||''} ${fe.format||p.genre||''} · Dir: ${dir}${p.company?' · '+p.company:''}</div>
          ${fe.festivals?`<div class="mf-cv-credit-note">${fe.festivals}</div>`:''}
          ${fe.awards?`<div class="mf-cv-credit-note">🏆 ${fe.awards}</div>`:''}
        </div>`;
      }).join('') : '<div class="mf-cv-body" style="opacity:0.5">Complete or release a project to add credits here.</div>'}

      ${((mf.filmographyExtra||[]).filter(f=>!f.projectId)).length ? `
        <div class="mf-cv-section-title">Earlier work</div>
        ${(mf.filmographyExtra||[]).filter(f=>!f.projectId).map(f => `
          <div class="mf-cv-credit">
            <div class="mf-cv-credit-title">${f.title||'Untitled'}</div>
            <div class="mf-cv-credit-meta">${f.year||''} ${f.format||''} ${f.role?'· '+f.role:''}</div>
          </div>`).join('')}
      ` : ''}
    </div>
  </div>
  `;
}

function _mfGoals(mf) {
  const goals = mf.goals || [];
  const statusOpts = ['Not started','In progress','Done'];

  return `
  <div class="mf-section-header">
    <div class="mf-section-title">Goals</div>
    <div class="mf-section-sub">Personal milestones — nothing to do with any specific project</div>
  </div>

  ${goals.length === 0 ? `<div class="mf-empty"><div class="mf-empty-title">No goals yet</div><div class="mf-empty-sub">What do you want to achieve as a filmmaker? Set goals here and track them quietly over time.</div></div>` : ''}

  ${goals.map((g, i) => `
    <div class="mf-goal-card">
      <div class="mf-goal-status-dot" style="background:${g.status==='Done'?'var(--green)':g.status==='In progress'?'var(--accent)':'var(--border)'}"></div>
      <div style="flex:1;min-width:0">
        <div class="mf-goal-text${g.status==='Done'?' done':''}">${g.text}</div>
        <select class="mf-goal-status-sel" onchange="mfUpdateGoalStatus(${i},this.value)">
          ${statusOpts.map(s=>`<option${g.status===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <button class="mf-danger-btn" onclick="mfDeleteGoal(${i})">✕</button>
    </div>
  `).join('')}

  <div class="mf-card" style="margin-top:16px">
    <div class="mf-card-label">Add a goal</div>
    <div style="display:flex;gap:8px;align-items:flex-end">
      <div style="flex:1">
        <label class="mf-label">Goal</label>
        <input class="mf-input" id="mf-goal-input" placeholder="e.g. Make a film over 20 minutes" onkeydown="if(event.key==='Enter')mfAddGoal()">
      </div>
      <button class="mf-save-btn" onclick="mfAddGoal()">Add</button>
    </div>
  </div>
  `;
}

function _mfAccount() {
  const user = window._supabaseUser || null;
  return `
  <div class="mf-section-header">
    <div class="mf-section-title">Account</div>
    <div class="mf-section-sub">Sign-in, sync and data</div>
  </div>

  <div class="mf-card">
    <div class="mf-card-label">Cloud sync</div>
    ${user ? `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div style="width:8px;height:8px;border-radius:50%;background:var(--green)"></div>
        <span style="font-size:13px;color:var(--text2)">Signed in as <strong>${user.email}</strong></span>
      </div>
      <button class="mf-danger-btn" onclick="sbSignOut()">Sign out</button>
    ` : `
      <p style="font-size:13px;color:var(--text3);margin-bottom:14px">Sign in to sync your data across devices.</p>
      <button class="mf-save-btn" onclick="sbGoogleSignIn ? sbGoogleSignIn() : showToast('Sign-in not available','info')">Sign in with Google</button>
    `}
  </div>

  <div class="mf-card">
    <div class="mf-card-label">Data</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="mf-save-btn" onclick="exportStore()">⬇ Export all data</button>
      <label class="mf-save-btn" style="cursor:pointer">
        ⬆ Import data
        <input type="file" accept=".json" style="display:none" onchange="importStore(this)">
      </label>
    </div>
  </div>

  <div class="mf-card" style="border-color:var(--red)">
    <div class="mf-card-label" style="color:var(--red)">Danger zone</div>
    <p style="font-size:12px;color:var(--text3);margin-bottom:12px">Permanently delete all data from this browser. Cannot be undone.</p>
    <button class="mf-danger-btn" onclick="openClearDataModal()">Clear all data</button>
  </div>
  `;
}

// ── Field helper ─────────────────────────────────────────────

function _mfField(label, key, value, type, placeholder) {
  return `<div>
    <label class="mf-label">${label}</label>
    <input class="mf-input" id="mf-field-${key}" type="${type||'text'}" value="${(value||'').replace(/"/g,'&quot;')}" placeholder="${placeholder||''}">
  </div>`;
}

// ── Filmography actions ──────────────────────────────────────

function mfToggleFilmDetail(id) {
  const el = document.getElementById('mf-film-' + id);
  if (!el) return;
  const btn = el.previousElementSibling.querySelector('.mf-film-expand-btn');
  const open = el.style.display === 'none';
  el.style.display = open ? 'block' : 'none';
  if (btn) btn.textContent = open ? 'Details ▴' : 'Details ▾';
}

function mfSaveFilmExtra(projectId) {
  if (!store.myFountain) store.myFountain = {};
  if (!store.myFountain.filmographyExtra) store.myFountain.filmographyExtra = [];
  const idx = store.myFountain.filmographyExtra.findIndex(f => f.projectId === projectId);
  const data = {
    projectId,
    year:         document.getElementById('mffe-year-'+projectId)?.value || '',
    runtime:      document.getElementById('mffe-runtime-'+projectId)?.value || '',
    format:       document.getElementById('mffe-format-'+projectId)?.value || '',
    festivals:    document.getElementById('mffe-festivals-'+projectId)?.value || '',
    distribution: document.getElementById('mffe-distribution-'+projectId)?.value || '',
    press:        document.getElementById('mffe-press-'+projectId)?.value || '',
    awards:       document.getElementById('mffe-awards-'+projectId)?.value || '',
  };
  if (idx >= 0) store.myFountain.filmographyExtra[idx] = data;
  else store.myFountain.filmographyExtra.push(data);
  saveStore();
}

function mfAddExtraFilm() {
  if (!store.myFountain) store.myFountain = {};
  if (!store.myFountain.filmographyExtra) store.myFountain.filmographyExtra = [];
  const title = document.getElementById('mf-extra-title')?.value.trim();
  if (!title) { showToast('Enter a title', 'info'); return; }
  store.myFountain.filmographyExtra.push({
    title,
    year:   document.getElementById('mf-extra-year')?.value || '',
    format: document.getElementById('mf-extra-format')?.value || '',
    role:   document.getElementById('mf-extra-role')?.value || '',
  });
  saveStore();
  mfShowSection('filmography');
}

function mfDeleteExtraFilm(i) {
  if (!store.myFountain?.filmographyExtra) return;
  const extras = store.myFountain.filmographyExtra.filter(f => !f.projectId);
  extras.splice(i, 1);
  store.myFountain.filmographyExtra = [
    ...store.myFountain.filmographyExtra.filter(f => f.projectId),
    ...extras,
  ];
  saveStore();
  mfShowSection('filmography');
}

// ── Slate actions ────────────────────────────────────────────

function mfAddSlateItem() {
  const title = document.getElementById('mf-slate-title')?.value.trim();
  if (!title) { showToast('Enter a title', 'info'); return; }
  if (!store.myFountain) store.myFountain = {};
  if (!store.myFountain.slate) store.myFountain.slate = [];
  store.myFountain.slate.push({
    title,
    status:  document.getElementById('mf-slate-status')?.value || 'Idea',
    format:  document.getElementById('mf-slate-format')?.value || '',
    logline: document.getElementById('mf-slate-logline')?.value || '',
  });
  saveStore();
  mfShowSection('slate');
}

function mfDeleteSlateItem(i) {
  if (!store.myFountain?.slate) return;
  store.myFountain.slate.splice(i, 1);
  saveStore();
  mfShowSection('slate');
}

// ── Goal actions ─────────────────────────────────────────────

function mfAddGoal() {
  const text = document.getElementById('mf-goal-input')?.value.trim();
  if (!text) return;
  if (!store.myFountain) store.myFountain = {};
  if (!store.myFountain.goals) store.myFountain.goals = [];
  store.myFountain.goals.push({ text, status: 'Not started' });
  saveStore();
  mfShowSection('goals');
}

function mfDeleteGoal(i) {
  if (!store.myFountain?.goals) return;
  store.myFountain.goals.splice(i, 1);
  saveStore();
  mfShowSection('goals');
}

function mfUpdateGoalStatus(i, status) {
  if (!store.myFountain?.goals) return;
  store.myFountain.goals[i].status = status;
  saveStore();
  mfShowSection('goals');
}

// ── CV export ────────────────────────────────────────────────

function mfExportCV() {
  const el = document.getElementById('mf-cv-preview');
  if (!el) return;
  const mf = store.myFountain || {};
  const name = mf.stageName || mf.name || 'CV';
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>${name} — CV</title>
    <style>
      body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; color: #111; font-size: 14px; line-height: 1.6; }
      h1 { font-size: 28px; margin-bottom: 4px; }
      .company { color: #555; margin-bottom: 4px; }
      .style { font-style: italic; color: #444; margin-bottom: 16px; }
      .meta { color: #777; font-size: 12px; margin-bottom: 4px; }
      hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
      h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #777; margin: 24px 0 8px; }
      .credit { margin-bottom: 12px; }
      .credit-title { font-weight: bold; }
      .credit-meta { color: #777; font-size: 12px; }
      .credit-note { color: #555; font-size: 12px; font-style: italic; }
    </style>
  </head><body>${el.innerHTML.replace(/class="[^"]*"/g,'').replace(/<div/g,'<div').replace(/mf-cv-name/g,'').replace(/mf-cv-/g,'')}</body></html>`);
  win.document.close();
  win.print();
}

// ══════════════════════════════════════════
