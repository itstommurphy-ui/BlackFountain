// EMAIL FUNCTIONS - for future backend integration
// ══════════════════════════════════════════
function emailAllCast() {
  const p = currentProject();
  if (!p) return;
  
  // Collect all emails from cast and extras
  const emails = [];
  (p.cast || []).forEach(c => { if (c.email) emails.push(c.email); });
  (p.extras || []).forEach(c => { if (c.email) emails.push(c.email); });

  if (!emails.length) {
    showToast('No email addresses found. Add cast members with email addresses.', 'info');
    return;
  }
  
  const to = emails.join(',');
  const subject = encodeURIComponent(p.title + ' - Communication');
  const body = encodeURIComponent('Hi,\n\nI wanted to reach out regarding ' + p.title + '.\n\nBest regards');
  
  window.location.href = 'mailto:' + to + '?subject=' + subject + '&body=' + body;
}

function emailAllExtras() {
  const p = currentProject();
  if (!p) return;
  
  const emails = (p.extras || []).map(c => c.email).filter(Boolean);
  if (!emails.length) {
    showToast('No email addresses found for extras.', 'info');
    return;
  }
  
  const to = emails.join(',');
  const subject = encodeURIComponent(p.title + ' - Extras Communication');
  const body = encodeURIComponent('Hi,\n\nI wanted to reach out regarding ' + p.title + '.\n\nBest regards');
  
  window.location.href = 'mailto:' + to + '?subject=' + subject + '&body=' + body;
}

function emailSelectedExtras() {
  const p = currentProject();
  if (!p) return;
  
  const emails = [...document.querySelectorAll('.extras-cb:checked')]
    .map(cb => p.extras[parseInt(cb.dataset.idx)]?.email).filter(Boolean);
  if (!emails.length) {
    showToast('No email addresses in selection', 'info');
    return;
  }
  
  const subject = encodeURIComponent(p.title + ' - Extras Communication');
  const body = encodeURIComponent('Hi,\n\nI wanted to reach out regarding ' + p.title + '.\n\nBest regards');
  
  window.location.href = 'mailto:' + emails.join(',') + '?subject=' + subject + '&body=' + body;
}

function showEmailDeptModal() {
  const p = currentProject();
  if (!p) return;
  
  // Get unique departments from crew
  const depts = [...new Set((p.unit || []).map(m => m.dept || 'Other'))].sort();
  if (!depts.length) {
    showToast('No crew departments found', 'info');
    return;
  }
  
  const overlay = document.createElement('div');
  overlay.id = 'email-dept-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:10000;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:22px 18px 18px;width:290px;box-shadow:0 24px 64px rgba(0,0,0,0.5)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:13px;font-weight:700">Email Department</span>
        <button onclick="document.getElementById('email-dept-modal').remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;line-height:1;padding:0">✕</button>
      </div>
      <p style="font-size:11px;color:var(--text3);margin:0 0 12px">Select a department to email:</p>
      <div style="display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto">
        ${depts.map(d => `<button class="btn btn-sm" style="justify-content:flex-start;text-align:left" onclick="emailCrewDept('${d}');document.getElementById('email-dept-modal').remove()">📧 ${d}</button>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}

function emailCallsheet(callsheetId) {
  const p = currentProject();
  if (!p) return;
  
  const cs = (p.callsheets || []).find(c => c.id === callsheetId);
  if (!cs) return;
  
  // Collect emails from callsheet cast rows
  const emails = [];
  (cs.castRows || []).forEach(r => { 
    if (r.email) emails.push(r.email); 
    // Also check contact field for backwards compatibility
    if (r.contact) {
      const emailMatch = r.contact.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) emails.push(emailMatch[0]);
    }
  });
  
  if (!emails.length) {
    showToast('No email addresses found in callsheet. Add cast members with email addresses.', 'info');
    return;
  }
  
  const to = emails.join(',');
  const date = cs.date || 'Shoot Day';
  const subject = encodeURIComponent(p.title + ' - Callsheet for ' + date);
  const body = encodeURIComponent('Hi,\n\nPlease find the callsheet attached for ' + p.title + '.\n\nCall time and details are in the attached document.\n\nBest regards');
  
  window.location.href = 'mailto:' + to + '?subject=' + subject + '&body=' + body;
}

async function shareCustomSectionFile(csId, fileId) {
  const p = currentProject();
  if (!p || !p.customSections) return;
  const cs = p.customSections.find(x => x.id === csId);
  if (!cs || !cs.files) return;
  const f = cs.files.find(x => x.id === fileId);
  if (!f) return;

  if (navigator.canShare) {
    try {
      const res = await fetch(f.dataUrl);
      const blob = await res.blob();
      const file = new File([blob], f.name, { type: f.type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: f.name });
        return;
      }
    } catch(e) { /* fall through */ }
  }

  const ovId = '_share-csf-' + fileId;
  const fname = f.name;
  const projTitle = p ? p.title : '';
  const emailSubject = encodeURIComponent(projTitle + ' - ' + fname);
  const emailBody = encodeURIComponent('Hi,\n\nI wanted to share ' + fname + ' with you from ' + projTitle + '.\n\nPlease find the document attached.\n\nBest regards');
  const textMsg   = encodeURIComponent(fname + (projTitle ? ' — ' + projTitle : ''));

  const overlay = document.createElement('div');
  overlay.id = ovId;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:10000;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:22px 18px 18px;width:290px;box-shadow:0 24px 64px rgba(0,0,0,0.5)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:13px;font-weight:700">Share Document</span>
        <button onclick="document.getElementById('${ovId}').remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;line-height:1;padding:0">✕</button>
      </div>
      <p style="font-size:11px;color:var(--text3);margin:0 0 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fname.replace(/</g,'&lt;')}</p>
      <div style="display:flex;flex-direction:column;gap:5px">
        <div style="font-size:10px;color:var(--text3);padding:2px 2px 4px">Click Email, download file, then attach:</div>
        <a href="mailto:?subject=${emailSubject}&body=${emailBody}" target="_blank" class="btn btn-sm" style="justify-content:flex-start;gap:10px;text-decoration:none">✉️ Email (pre-filled)</a>
        <a href="#" onclick="downloadCustomSectionFile('${csId}','${fileId}');return false" class="btn btn-sm" style="justify-content:flex-start;gap:10px;text-decoration:none">⬇ Download File</a>
        <a href="https://wa.me/?text=${textMsg}" target="_blank" class="btn btn-sm" style="justify-content:flex-start;gap:10px;text-decoration:none">💬 WhatsApp</a>
        <a href="https://t.me/share/url?text=${textMsg}" target="_blank" class="btn btn-sm" style="justify-content:flex-start;gap:10px;text-decoration:none">✈️ Telegram</a>
        <a href="sms:?body=${textMsg}" class="btn btn-sm" style="justify-content:flex-start;gap:10px;text-decoration:none">💬 iMessage / SMS</a>
        <a href="https://www.messenger.com/t/" target="_blank" class="btn btn-sm" style="justify-content:flex-start;gap:10px;text-decoration:none">💙 Facebook Messenger</a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fblackfountain.app" target="_blank" class="btn btn-sm" style="justify-content:flex-start;gap:10px;text-decoration:none">🔗 LinkedIn</a>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}
function removeCustomSectionFile(csId, fileId) {
  showConfirmDialog('Remove this file?', 'Remove', () => {
    const p = currentProject();
    if (!p || !p.customSections) return;
    const cs = p.customSections.find(x => x.id === csId);
    if (!cs || !cs.files) return;
    cs.files = cs.files.filter(x => x.id !== fileId);
    saveStore();
    renderCustomSection('custom_' + csId);
  });
}
function openCustomSectionFileRename(csId, fileId) {
  const p = currentProject();
  if (!p || !p.customSections) return;
  const cs = p.customSections.find(x => x.id === csId);
  if (!cs || !cs.files) return;
  const f = cs.files.find(x => x.id === fileId);
  if (!f) return;
  const ovId = '_csrename-' + fileId;
  const overlay = document.createElement('div');
  overlay.id = ovId;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:10000;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:22px 20px 18px;width:340px;box-shadow:0 24px 64px rgba(0,0,0,0.5)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:13px;font-weight:700">Rename File</span>
        <button onclick="document.getElementById('${ovId}').remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;line-height:1;padding:0">✕</button>
      </div>
      <input id="_csri-${fileId}" class="form-input" style="width:100%;margin-bottom:14px" value="${f.name.replace(/"/g,'&quot;')}">
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-sm" onclick="document.getElementById('${ovId}').remove()">Cancel</button>
        <button class="btn btn-sm btn-primary" onclick="applyCustomSectionFileRename('${csId}','${fileId}','${ovId}')">Rename</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  const inp = document.getElementById('_csri-' + fileId);
  if (inp) { inp.focus(); inp.select(); inp.onkeydown = e => { if (e.key === 'Enter') applyCustomSectionFileRename(csId, fileId, ovId); }; }
}
function applyCustomSectionFileRename(csId, fileId, ovId) {
  const p = currentProject();
  if (!p || !p.customSections) return;
  const cs = p.customSections.find(x => x.id === csId);
  if (!cs || !cs.files) return;
  const f = cs.files.find(x => x.id === fileId);
  const inp = document.getElementById('_csri-' + fileId);
  const newName = inp?.value.trim();
  if (f && newName) { f.name = newName; saveStore(); renderCustomSection('custom_' + csId); }
  document.getElementById(ovId)?.remove();
}
function openCustomSectionFilePreview(csId, fileId) {
  const p = currentProject();
  if (!p || !p.customSections) return;
  const cs = p.customSections.find(x => x.id === csId);
  if (!cs || !cs.files) return;
  const f = cs.files.find(x => x.id === fileId);
  if (!f) return;
  // Reuse script preview logic by temporarily mapping to script format
  const pseudo = { id: fileId, name: f.name, type: f.type, dataUrl: f.dataUrl };
  const p2 = currentProject();
  if (!p2.scripts) p2.scripts = [];
  const tmp = { ...pseudo };
  // Build a one-off preview overlay directly
  const ovId = '_csp_' + fileId;
  const isPdf = f.type.includes('pdf'), isImg = f.type.startsWith('image/');
  const isText = f.type.includes('text') || f.name.endsWith('.txt') || f.name.endsWith('.fountain');
  let previewHtml = '';
  if (isPdf) previewHtml = `<embed src="${f.dataUrl}" type="application/pdf" style="width:min(820px,90vw);height:80vh;border-radius:8px;border:none">`;
  else if (isImg) previewHtml = `<img src="${f.dataUrl}" alt="${f.altText || f.name}" style="max-width:min(820px,90vw);max-height:80vh;border-radius:8px;object-fit:contain">`;
  else if (isText) {
    let text = ''; try { text = decodeURIComponent(escape(atob(f.dataUrl.split(',')[1]))); } catch(e) { try { text = atob(f.dataUrl.split(',')[1]); } catch(e2) { text='(Cannot decode)'; } }
    previewHtml = `<pre style="background:var(--surface);color:var(--text);padding:20px;border-radius:8px;overflow:auto;width:min(820px,90vw);max-height:80vh;font-size:12px;line-height:1.7;white-space:pre-wrap">${text.replace(/</g,'&lt;')}</pre>`;
  } else previewHtml = `<div style="background:var(--surface2);padding:40px;border-radius:12px;text-align:center;color:var(--text3)"><div style="font-size:48px;margin-bottom:12px">${scriptFileIcon(f.type)}</div><p>Preview not available</p></div>`;
  const overlay = document.createElement('div');
  overlay.id = ovId;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;width:min(820px,90vw);margin-bottom:10px"><span style="color:#fff;font-size:13px;font-weight:600">${f.name.replace(/</g,'&lt;')}</span><button onclick="document.getElementById('${ovId}').remove()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;cursor:pointer;font-size:18px;border-radius:6px;padding:2px 8px;line-height:1.4">✕</button></div>${previewHtml}`;
  document.body.appendChild(overlay);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}
function deleteCustomSection(id) {
  const p = currentProject();
  if (!p) return;
  showConfirmDialog('Delete this custom section? This cannot be undone.', 'Delete', () => {
    const tab = 'custom_' + id;
    p.customSections = (p.customSections || []).filter(x => x.id !== id);
    if (p.overviewLayout) p.overviewLayout = p.overviewLayout.filter(x => x.tab !== tab);
    saveStore();
    showSection('overview');
    renderOverview(p);
    showToast('Section deleted', 'success');
  });
}

