// SHOT LIST
// ══════════════════════════════════════════
function renderShotList(p) {
  const tbody = document.getElementById('shotlist-body');
  let totalMins = 0;
  if (!p.shots || !p.shots.length) {
    tbody.innerHTML = `<tr><td colspan="16"><div class="empty-state" style="padding:30px"><div class="icon">🎬</div><h4>No shots yet</h4></div></td></tr>`;
  } else {
    tbody.innerHTML = p.shots.map((s,i) => {
      const t = (parseInt(s.setuptime)||0) + (parseInt(s.shoottime)||0);
      totalMins += t;
      return `<tr data-ctx="shot:${i}" onclick="editShot(${i})" style="cursor:pointer">
        <td>${s.scene||'—'}</td><td>${s.setup||'—'}</td><td>${s.num||'—'}</td>
        <td><span class="tag">${s.type||'—'}</span></td>
        <td>${s.movement||'—'}</td><td>${s.location||'—'}</td>
        <td><span class="chip" style="font-size:10px">${s.extint||'—'}</span></td>
        <td>${s.sound||'—'}</td>
        <td style="max-width:200px">${s.desc||'—'}</td>
        <td>${s.cast||'—'}</td><td>${s.pages||'—'}</td><td>${s.length||'—'}</td>
        <td>${s.setuptime||'—'}</td><td>${s.shoottime||'—'}</td>
        <td><strong style="color:var(--accent)">${t||'—'}</strong></td>
        <td onclick="event.stopPropagation()">
          <button class="btn btn-sm btn-ghost btn-danger" onclick="removeShot(${i})">✕</button>
        </td>
      </tr>`;
    }).join('');
  }
  const h = Math.floor(totalMins/60), m = totalMins%60;
  document.getElementById('shotlist-total').textContent = h ? `${h} hr ${m} mins` : `${totalMins} mins`;
}
function addShot() {
  document.getElementById('shot-edit-idx').value='';
  ['scene','scene-key','setup','num','location','cast','pages','length','setuptime','shoottime'].forEach(f=>document.getElementById('shot-'+f).value='');
  document.getElementById('shot-total').value='';
  document.getElementById('shot-desc').value='';
  _shotPopulateScenes('');
  openModal('modal-shot');
}
function editShot(i) {
  const s=currentProject().shots[i];
  document.getElementById('shot-edit-idx').value=i;
  document.getElementById('shot-scene').value=s.scene||'';
  document.getElementById('shot-scene-key').value=s.sceneKey||'';
  _shotPopulateScenes(s.sceneKey||'');
  document.getElementById('shot-setup').value=s.setup||'';
  document.getElementById('shot-num').value=s.num||'';
  document.getElementById('shot-type').value=s.type||'CU';
  document.getElementById('shot-movement').value=s.movement||'Stationary';
  document.getElementById('shot-extint').value=s.extint||'INT DAY';
  document.getElementById('shot-location').value=s.location||'';
  document.getElementById('shot-sound').value=s.sound||'Yes';
  document.getElementById('shot-desc').value=s.desc||'';
  document.getElementById('shot-cast').value=s.cast||'';
  document.getElementById('shot-pages').value=s.pages||'';
  document.getElementById('shot-length').value=s.length||'';
  document.getElementById('shot-setuptime').value=s.setuptime||'';
  document.getElementById('shot-shoottime').value=s.shoottime||'';
  calcShotTotal();
  openModal('modal-shot');
}
function calcShotTotal() {
  const a=parseInt(document.getElementById('shot-setuptime').value)||0;
  const b=parseInt(document.getElementById('shot-shoottime').value)||0;
  document.getElementById('shot-total').value = a+b ? (a+b)+' mins' : '';
}
function saveShot() {
  const p=currentProject();
  if (!p.shots) p.shots=[];
  const s={
    scene:document.getElementById('shot-scene').value,
    sceneKey:document.getElementById('shot-scene-key').value,
    setup:document.getElementById('shot-setup').value,
    num:document.getElementById('shot-num').value,
    type:document.getElementById('shot-type').value,
    movement:document.getElementById('shot-movement').value,
    extint:document.getElementById('shot-extint').value,
    location:document.getElementById('shot-location').value,
    sound:document.getElementById('shot-sound').value,
    desc:document.getElementById('shot-desc').value,
    cast:document.getElementById('shot-cast').value,
    pages:document.getElementById('shot-pages').value,
    length:document.getElementById('shot-length').value,
    setuptime:document.getElementById('shot-setuptime').value,
    shoottime:document.getElementById('shot-shoottime').value,
  };
  const idx=document.getElementById('shot-edit-idx').value;
  if(idx!=='') p.shots[parseInt(idx)]=s; else p.shots.push(s);
  saveStore(); closeModal('modal-shot'); renderShotList(p); showToast('Shot saved','success');
}
function _shotPopulateScenes(selectedKey) {
  const sel = document.getElementById('shot-scene-sel');
  if (!sel) return;
  const p  = currentProject();
  const bd = _getActiveBd(p);
  sel.innerHTML = '<option value="">— select scene —</option>';
  if (bd?.rawText) {
    parseBreakdownScenes(bd.rawText).forEach(sc => {
      const opt = document.createElement('option');
      opt.value = sc.heading;
      opt.textContent = (sc.sceneNumber ? sc.sceneNumber + ' – ' : '') + (sc.location || sc.heading) + (sc.tod ? ' / ' + sc.tod : '');
      opt.dataset.scenenum = sc.sceneNumber || '';
      opt.dataset.loc      = sc.location    || '';
      opt.dataset.ie       = sc.intExt      || '';
      opt.dataset.tod      = sc.tod         || '';
      if (sc.heading === selectedKey) opt.selected = true;
      sel.appendChild(opt);
    });
  }
}

function _shotSceneChange() {
  const sel = document.getElementById('shot-scene-sel');
  const opt = sel.options[sel.selectedIndex];
  document.getElementById('shot-scene-key').value = opt.value;
  document.getElementById('shot-scene').value     = opt.dataset?.scenenum || opt.value;
  if (!opt.value) return;
  if (opt.dataset.loc) document.getElementById('shot-location').value = opt.dataset.loc;
  // Auto-set ext/int
  const ie = opt.dataset.ie, tod = opt.dataset.tod;
  if (ie) {
    const night  = /NIGHT|DUSK|DAWN/.test(tod||'');
    const prefix = ie.includes('EXT') && ie.includes('INT') ? 'INT' : ie.split('/')[0];
    const target = prefix + (night ? ' NIGHT' : ' DAY');
    const eiSel  = document.getElementById('shot-extint');
    for (const o of eiSel.options) { if (o.value === target) { eiSel.value = target; break; } }
  }
  // Auto-fill cast from breakdown
  const p = currentProject();
  const bd = _getActiveBd(p);
  if (bd) {
    const data = _sbBuildSceneData(p);
    const entry = data[opt.value];
    if (entry?.cast.length) document.getElementById('shot-cast').value = entry.cast.join(', ');
  }
}

// Generic autocomplete — used by shot-location and shot-cast
function _acShow(input, options) {
  _acRemove();
  const val = input.value.trim().toLowerCase();
  if (!val) return;
  const opts = options.filter(o => o && o.toLowerCase().includes(val));
  if (!opts.length) return;
  const rect = input.getBoundingClientRect();
  const list = document.createElement('div');
  list.id = '_ac-list';
  list.className = 'sb-loc-list';
  list.style.cssText = `top:${rect.bottom+4}px;left:${rect.left}px;width:${rect.width}px`;
  list._target = input;
  list.innerHTML = opts.map(o => `<div class="sb-loc-item" onmousedown="_acPick(event,this)">${o.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>`).join('');
  document.body.appendChild(list);
}
function _acPick(e, el) {
  e.preventDefault();
  const list = document.getElementById('_ac-list');
  if (list?._target) list._target.value = el.textContent;
  _acRemove();
}
function _acRemove() { document.getElementById('_ac-list')?.remove(); }

function removeShot(i) { showConfirmDialog('Remove this shot?', 'Remove', () => { const p=currentProject(); p.shots.splice(i,1); saveStore(); renderShotList(p); }); }

// ══════════════════════════════════════════
// PROPS / WARDROBE
// ══════════════════════════════════════════
function renderPropTable(type, tbodyId, p) {
  const list = p[type] || [];
  const tbody = document.getElementById(tbodyId);
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state" style="padding:20px"><h4>No items yet</h4></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((item,i) => `
    <tr data-ctx="prop:${type}:${i}" onclick="editPropItem('${type}',${i})" style="cursor:pointer">
      <td><strong>${item.name}</strong></td>
      <td>${item.qty||1}</td>
      <td>${item.chars||'—'}</td>
      <td>${item.scenes||'—'}</td>
      <td>${item.locs||'—'}</td>
      <td>${item.pgs||'—'}</td>
      <td>${item.notes||'—'}</td>
      <td>
        <button class="btn btn-sm btn-ghost" onclick="editPropItem('${type}',${i})">✎</button>
        <button class="btn btn-sm btn-ghost btn-danger" onclick="removePropItem('${type}',${i})">✕</button>
      </td>
    </tr>
  `).join('');
}
function addPropItem(type) { document.getElementById('prop-type').value=type; document.getElementById('prop-edit-idx').value=''; document.getElementById('modal-prop-title').textContent='ADD '+(type==='props'?'PROP':'WARDROBE ITEM'); ['name','chars','scenes','locs','pgs','notes'].forEach(f=>document.getElementById('prop-'+f).value=''); document.getElementById('prop-qty').value='1'; openModal('modal-prop'); }
function editPropItem(type,i) {
  const item=currentProject()[type][i];
  document.getElementById('prop-type').value=type;
  document.getElementById('prop-edit-idx').value=i;
  document.getElementById('modal-prop-title').textContent='EDIT '+(type==='props'?'PROP':'WARDROBE ITEM');
  document.getElementById('prop-name').value=item.name||'';
  document.getElementById('prop-qty').value=item.qty||1;
  document.getElementById('prop-chars').value=item.chars||'';
  document.getElementById('prop-scenes').value=item.scenes||'';
  document.getElementById('prop-locs').value=item.locs||'';
  document.getElementById('prop-pgs').value=item.pgs||'';
  document.getElementById('prop-notes').value=item.notes||'';
  openModal('modal-prop');
}
function savePropItem() {
  const p=currentProject();
  const type=document.getElementById('prop-type').value;
  const name=document.getElementById('prop-name').value.trim();
  if(!name){showToast('Name required','info');return;}
  if(!p[type]) p[type]=[];
  const item={name,qty:document.getElementById('prop-qty').value||1,chars:document.getElementById('prop-chars').value,scenes:document.getElementById('prop-scenes').value,locs:document.getElementById('prop-locs').value,pgs:document.getElementById('prop-pgs').value,notes:document.getElementById('prop-notes').value};
  const idx=document.getElementById('prop-edit-idx').value;
  if(idx!=='') p[type][parseInt(idx)]=item; else p[type].push(item);
  saveStore(); closeModal('modal-prop');
  if(type==='props') renderPropTable('props','props-body',p);
  else renderPropTable('wardrobe','wardrobe-body',p);
  showToast('Saved','success');
}
function removePropItem(type,i) {
  showConfirmDialog('Remove this item?', 'Remove', () => {
    const p=currentProject(); p[type].splice(i,1); saveStore();
    if(type==='props') renderPropTable('props','props-body',p);
    else renderPropTable('wardrobe','wardrobe-body',p);
  });
}

// WARDROBE FUNCTIONS
function renderWardrobeTable(p) {
  const list = p.wardrobe || [];
  const tbody = document.getElementById('wardrobe-body');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state" style="padding:20px"><h4>No items yet</h4></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((item,i) => `
    <tr data-ctx="wardrobe:${i}">
      <td><strong>${item.name}</strong></td>
      <td>${item.chars||'—'}</td>
      <td>${item.scenes||'—'}</td>
      <td>${item.size||'—'}</td>
      <td>${item.condition||'—'}</td>
      <td>${item.loc||'—'}</td>
      <td>${item.notes||'—'}</td>
      <td>
        <button class="btn btn-sm btn-ghost" onclick="editWardrobeItem(${i})">✎</button>
        <button class="btn btn-sm btn-ghost btn-danger" onclick="removeWardrobeItem(${i})">✕</button>
      </td>
    </tr>
  `).join('');
}
function addWardrobeItem() {
  document.getElementById('wardrobe-edit-idx').value='';
  document.getElementById('modal-wardrobe-title').textContent='ADD WARDROBE ITEM';
  ['name','chars','scenes','size','condition','loc','notes'].forEach(f=>document.getElementById('wardrobe-'+f).value='');
  openModal('modal-wardrobe');
}
function editWardrobeItem(i) {
  const item=currentProject().wardrobe[i];
  document.getElementById('wardrobe-edit-idx').value=i;
  document.getElementById('modal-wardrobe-title').textContent='EDIT WARDROBE ITEM';
  document.getElementById('wardrobe-name').value=item.name||'';
  document.getElementById('wardrobe-chars').value=item.chars||'';
  document.getElementById('wardrobe-scenes').value=item.scenes||'';
  document.getElementById('wardrobe-size').value=item.size||'';
  document.getElementById('wardrobe-condition').value=item.condition||'';
  document.getElementById('wardrobe-loc').value=item.loc||'';
  document.getElementById('wardrobe-notes').value=item.notes||'';
  openModal('modal-wardrobe');
}
function saveWardrobeItem() {
  const p=currentProject();
  const name=document.getElementById('wardrobe-name').value.trim();
  if(!name){showToast('Name required','info');return;}
  if(!p.wardrobe) p.wardrobe=[];
  const item={
    name,
    chars: document.getElementById('wardrobe-chars').value,
    scenes: document.getElementById('wardrobe-scenes').value,
    size: document.getElementById('wardrobe-size').value,
    condition: document.getElementById('wardrobe-condition').value,
    loc: document.getElementById('wardrobe-loc').value,
    notes: document.getElementById('wardrobe-notes').value
  };
  const idx=document.getElementById('wardrobe-edit-idx').value;
  if(idx!=='') p.wardrobe[parseInt(idx)]=item; else p.wardrobe.push(item);
  saveStore(); closeModal('modal-wardrobe');
  renderWardrobeTable(p);
  showToast('Saved','success');
}
function removeWardrobeItem(i) {
  showConfirmDialog('Remove this wardrobe item?', 'Remove', () => {
    const p=currentProject(); p.wardrobe.splice(i,1); saveStore();
    renderWardrobeTable(p);
  });
}

// ══════════════════════════════════════════
// SOUND LOG
// ══════════════════════════════════════════
function renderSoundLog(p) {
  const tbody=document.getElementById('soundlog-body');
  if(!p.soundlog||!p.soundlog.length){tbody.innerHTML=`<tr><td colspan="8"><div class="empty-state" style="padding:20px"><div class="icon">🎙️</div><h4>No entries yet</h4></div></td></tr>`;return;}
  tbody.innerHTML=p.soundlog.map((s,i)=>`
    <tr data-ctx="sound:${i}">
      <td>${s.scene||'—'}</td><td>${s.shot||'—'}</td><td>${s.take||'—'}</td>
      <td>${s.comments||'—'}</td><td>${s.track1||'—'}</td>
      <td>${s.lav||'—'}</td><td>${s.additional||'—'}</td>
      <td>
        <button class="btn btn-sm btn-ghost" onclick="editSoundEntry(${i})">✎</button>
        <button class="btn btn-sm btn-ghost btn-danger" onclick="removeSoundEntry(${i})">✕</button>
      </td>
    </tr>
  `).join('');
}
function addSoundEntry(){document.getElementById('sound-edit-idx').value='';['scene','shot','take','comments','track1','lav','additional'].forEach(f=>document.getElementById('sound-'+f).value='');openModal('modal-sound');}
function editSoundEntry(i){const s=currentProject().soundlog[i];document.getElementById('sound-edit-idx').value=i;document.getElementById('sound-scene').value=s.scene||'';document.getElementById('sound-shot').value=s.shot||'';document.getElementById('sound-take').value=s.take||'';document.getElementById('sound-comments').value=s.comments||'';document.getElementById('sound-track1').value=s.track1||'';document.getElementById('sound-lav').value=s.lav||'';document.getElementById('sound-additional').value=s.additional||'';openModal('modal-sound');}
function saveSoundEntry(){
  const p=currentProject();if(!p.soundlog)p.soundlog=[];
  const s={scene:document.getElementById('sound-scene').value,shot:document.getElementById('sound-shot').value,take:document.getElementById('sound-take').value,comments:document.getElementById('sound-comments').value,track1:document.getElementById('sound-track1').value,lav:document.getElementById('sound-lav').value,additional:document.getElementById('sound-additional').value};
  const idx=document.getElementById('sound-edit-idx').value;
  if(idx!=='')p.soundlog[parseInt(idx)]=s;else p.soundlog.push(s);
  saveStore();closeModal('modal-sound');renderSoundLog(p);showToast('Saved','success');
}
function removeSoundEntry(i){showConfirmDialog('Remove this sound log entry?','Remove',()=>{const p=currentProject();p.soundlog.splice(i,1);saveStore();renderSoundLog(p);});}

// ══════════════════════════════════════════
