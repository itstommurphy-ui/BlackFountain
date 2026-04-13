// ══════════════════════════════════════════
// SUPABASE SYNC
// ══════════════════════════════════════════
const _SB_URL = 'https://zeojevfruuqjhwycnnan.supabase.co';
const _SB_KEY = 'sb_publishable__Q-8dJNUZ_As-krVwGop0w_yZDBNEYO';

let _sb = null;
let _sbUser = null;
let _cachedToken = null;
let _sbAppReadyCallback = null;
let _sbAppStarted = false;

async function sbInit(onReady) {
  _sbAppReadyCallback = onReady;
  if (typeof supabase === 'undefined') {
    console.warn('[sbInit] Supabase client not loaded — running offline only');
    onReady();
    return;
  }
  // Guard: only ever create one client
  if (_sb) {
    console.warn('[sbInit] Client already exists — skipping re-init');
    onReady();
    return;
  }
  try {
    console.log('[sbInit] Creating Supabase client...');
    _sb = supabase.createClient(_SB_URL, _SB_KEY, {
      auth: {
        persistSession: true,
        storageKey: 'bf-supabase-auth',
        autoRefreshToken: true,
        detectSessionInUrl: true,
        lock: false
      }
    });
    console.log('[sbInit] Supabase client created successfully');
  } catch(e) {
    console.warn('[sbInit] Supabase init failed — running offline only', e);
    onReady();
    return;
  }

  _sb.auth.onAuthStateChange(async (event, session) => {
    _sbUser = session?.user ?? null;
    _cachedToken = session?.access_token ?? null;
    _updateAuthIndicator();
    if (event === 'SIGNED_IN' && _sbUser) {
      _sbKeepAlive(); // Start keepalive when signed in
      if (!_sbAppStarted) {
        _sbAppStarted = true;
        document.getElementById('modal-login').style.display = 'none';
        await _sbAppReadyCallback();
      }
    }
    if (event === 'SIGNED_OUT') {
      // Clear local store from memory
      Object.keys(store).forEach(k => delete store[k]);
      Object.assign(store, { projects: [], teamMembers: [], currentProjectId: null, files: [], contacts: [], locations: [], contactColumns: [], contactCustomData: {}, contactHiddenCols: [], locationHiddenCols: [], locationColumns: [], locationCustomData: {}, moodboards: [] });
      // Clear IndexedDB so data doesn't persist on this device after logout
      openDB().then(db => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').clear();
      }).catch(() => {});
      // Clear localStorage backups
      Object.keys(localStorage).filter(k => k.startsWith('bf_')).forEach(k => localStorage.removeItem(k));
      // Show login modal and block the app
      _showLoginModal();
    }
  });

  // Wait for initial auth state before starting app
  // This ensures _sbUser is populated when loadStore() runs
  try {
    console.log('[sbInit] Getting session...');
    const { data: { session } } = await _sb.auth.getSession();
    console.log('[sbInit] Session result:', session ? 'user found: ' + session.user.email : 'no session');
    _sbUser = session?.user ?? null;
    _updateAuthIndicator();
  } catch(e) {
    console.warn('[sbInit] getSession failed:', e);
  }
  
  console.log('[sbInit] _sbUser after getSession:', _sbUser ? _sbUser.email : 'null');
  
  if (_sbUser) {
    _sbKeepAlive(); // Start keepalive if already signed in
  }
  
  if (!_sbAppStarted) {
    _sbAppStarted = true;
    if (_sbUser) {
      // User is already logged in, start app and it will pull from cloud
      console.log('[sbInit] Starting app with user, will pull from cloud');
      await _sbAppReadyCallback();
    } else {
      // No session, block app and show login
      console.log('[sbInit] No user — showing login');
      _showLoginModal();
    }
  }
}

function _updateAuthIndicator() {
  const el = document.getElementById('sb-auth-indicator');
  if (!el) return;
  if (_sbUser) {
    el.innerHTML = `<span style="cursor:default" title="Signed in">${_sbUser.email}</span>`;
    el.onclick = null;
    el.title = 'Signed in';
    el.style.cursor = 'pointer';
  } else {
    el.innerHTML = `<button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="_showLoginModal()">Sign in</button>`;
    el.onclick = null;
    el.title = '';
    el.style.cursor = '';
  }
}

function _showLoginModal() {
  const modal = document.getElementById('modal-login');
  if (!modal) return;
  // Reset to step 1
  document.getElementById('login-step-email').style.display = '';
  document.getElementById('login-step-otp').style.display = 'none';
  document.getElementById('login-error').textContent = '';
  document.getElementById('login-send-btn').textContent = 'Send sign-in code';
  document.getElementById('login-send-btn').disabled = false;
  document.getElementById('login-email').value = '';
  // Show modal using flex (like user's request)
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('login-email')?.focus(), 50);
}

async function sbSendOtp(email) {
  const { error } = await _sb.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true }
  });
  if (error) throw error;
}

async function sbVerifyOtp(email, token) {
  const { data, error } = await _sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  return data;
}

async function sbGoogleSignIn() {
  const { error } = await _sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) console.warn('[sbGoogleSignIn] Error:', error.message);
}

async function sbSignOut() {
  try {
    if (_sb) {
      // scope: 'local' only clears this tab's session, avoids lock contention
      await _sb.auth.signOut({ scope: 'local' });
    }
  } catch (e) {
    console.warn('[sbSignOut] ignored:', e.message);
  } finally {
    _cachedToken = null;
    // Belt and braces: clear the auth key directly
    localStorage.removeItem('bf-supabase-auth');
    showToast('Signed out', 'success');
    setTimeout(() => window.location.reload(), 800);
  }
}

// Keep session alive by pinging periodically
function _sbKeepAlive() {
  if (!_sb || !_sbUser) return;
  setInterval(async () => {
    try {
      const { data: { session } } = await _sb.auth.getSession();
      if (!session) return;
      await fetch(`${_SB_URL}/rest/v1/stores?select=updated_at&limit=1`, {
        headers: { 
          'apikey': _SB_KEY, 
          'Authorization': `Bearer ${session.access_token}` 
        }
      });
      console.log('[sbKeepAlive] pinged');
    } catch(e) {}
  }, 4 * 60 * 1000); // every 4 minutes
}

// Pull store from Supabase (returns null if not logged in or empty)
async function sbPullStore() {
  console.log('[sbPullStore] Starting pull for user:', _sbUser?.email);
  if (!_sb || !_sbUser) return null;
  
  try {
    // Get user's session token for authorization
    if (!_cachedToken) {
      const { data: { session } } = await _sb.auth.getSession();
      _cachedToken = session?.access_token || null;
    }
    const token = _cachedToken;
    if (!token) { console.warn('[sbPullStore] No access token'); return null; }

    console.log('[sbPullStore] Using REST API for user_id:', _sbUser.id);
    const url = `${_SB_URL}/rest/v1/stores?user_id=eq.${_sbUser.id}&select=data`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      headers: {
        'apikey': _SB_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errText = await response.text();
      console.warn('[sbPullStore] REST API error:', response.status, errText);
      return null;
    }
    
    const data = await response.json();
    console.log('[sbPullStore] REST API result:', data?.length > 0 ? 'found' : 'null');
    
    if (data && data.length > 0) {
      return data[0].data;
    }
    return null;
  } catch(e) {
    console.warn('[sbPullStore] Exception:', e.name === 'AbortError' ? 'Timeout' : e.message);
    return null;
  }
}

// Push store to Supabase (strips file blobs to stay under size limits)
async function sbPushStore() {
  if (!_sb || !_sbUser) return;
  
  try {
    // Get user's session token for authorization
    if (!_cachedToken) {
      const { data: { session } } = await _sb.auth.getSession();
      _cachedToken = session?.access_token || null;
    }
    const token = _cachedToken;
    if (!token) { console.warn('[sbPushStore] No access token'); return; }

    const stripped = {
      ...store,
      files: (store.files || []).map(({ data: _d, ...f }) => f),
      _lastSave: Date.now()
    };
    
    console.log('[sbPushStore] Pushing to REST API for user_id:', _sbUser.id);
    
    const url = `${_SB_URL}/rest/v1/stores?on_conflict=user_id`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': _SB_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        user_id: _sbUser.id,
        data: stripped,
        updated_at: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.warn('[sbPushStore] REST API error:', response.status, errText);
    } else {
      console.log('[sbPushStore] REST API success');
    }
  } catch(e) {
    console.warn('[sbPushStore] Exception:', e.message);
  }
}

// ── Login modal UI functions ───────────────────────────────────────────────
let _loginEmail = '';

async function _loginSendOtp() {
  const email = (document.getElementById('login-email')?.value || '').trim();
  if (!email) return;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  const btn = document.getElementById('login-send-btn');
  btn.textContent = 'Sending…'; btn.disabled = true;
  try {
    await sbSendOtp(email);
    _loginEmail = email;
    document.getElementById('login-step-email').style.display = 'none';
    document.getElementById('login-step-otp').style.display = '';
    document.getElementById('login-otp-sent-to').textContent = email;
    setTimeout(() => document.getElementById('login-otp')?.focus(), 50);
  } catch(e) {
    errEl.textContent = e.message?.includes('not found') || e.message?.includes('signups')
      ? 'This email isn\'t registered. Contact the administrator.'
      : (e.message || 'Could not send code — please try again.');
    btn.textContent = 'Send sign-in code'; btn.disabled = false;
  }
}

async function _loginVerifyOtp() {
  const token = (document.getElementById('login-otp')?.value || '').trim();
  if (!token || token.length < 6) return;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  const btn = document.getElementById('login-verify-btn');
  btn.textContent = 'Signing in…'; btn.disabled = true;
  try {
    await sbVerifyOtp(_loginEmail, token);
    // onAuthStateChange handles the rest
  } catch(e) {
    errEl.textContent = e.message || 'Invalid or expired code.';
    btn.textContent = 'Sign in'; btn.disabled = false;
  }
}

function _loginBack() {
  document.getElementById('login-step-otp').style.display = 'none';
  document.getElementById('login-step-email').style.display = '';
  document.getElementById('login-error').textContent = '';
  const btn = document.getElementById('login-send-btn');
  btn.textContent = 'Send sign-in code'; btn.disabled = false;
}
