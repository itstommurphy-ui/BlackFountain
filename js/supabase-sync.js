// ══════════════════════════════════════════
// SUPABASE SYNC
// ══════════════════════════════════════════
const _SB_URL = 'https://xhvmzfmirdbdyjkbyriu.supabase.co';
const _SB_KEY = 'sb_publishable_1zLwSLWq8SWd3NE7rsnLSg_AxH4KaBq';

let _sb = null;
let _sbUser = null;
let _sbAppReadyCallback = null;
let _sbAppStarted = false;

function sbInit(onReady) {
  _sbAppReadyCallback = onReady;
  if (typeof supabase === 'undefined') {
    console.warn('[sbInit] Supabase client not loaded — running offline only');
    onReady();
    return;
  }
  try {
    _sb = supabase.createClient(_SB_URL, _SB_KEY);
  } catch(e) {
    console.warn('[sbInit] Supabase init failed — running offline only');
    onReady();
    return;
  }

  _sb.auth.onAuthStateChange(async (event, session) => {
    _sbUser = session?.user ?? null;
    _updateAuthIndicator();
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && _sbUser && !_sbAppStarted) {
      _sbAppStarted = true;
      document.getElementById('modal-login').style.display = 'none';
      await _sbAppReadyCallback();
    }
    if (event === 'SIGNED_OUT') {
      document.getElementById('modal-login').style.display = 'none';
    }
  });

  // If no Supabase or session isn't immediately found, wait briefly then start
  setTimeout(() => {
    if (!_sbAppStarted) {
      _sbAppStarted = true;
      _sbAppReadyCallback();
    }
  }, 1000);
}

function _updateAuthIndicator() {
  const el = document.getElementById('sb-auth-indicator');
  if (!el) return;
  if (_sbUser) {
    el.textContent = _sbUser.email;
    el.title = 'Signed in — click to sign out';
    el.style.color = 'var(--text3)';
    el.style.cursor = 'pointer';
    el.onclick = sbSignOut;
  } else {
    el.textContent = '';
    el.onclick = null;
  }
}

async function sbSendOtp(email) {
  const { error } = await _sb.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false }
  });
  if (error) throw error;
}

async function sbVerifyOtp(email, token) {
  const { data, error } = await _sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  return data;
}

async function sbSignOut() {
  if (!_sb) return;
  await _sb.auth.signOut();
}

// Pull store from Supabase (returns null if not logged in or empty)
async function sbPullStore() {
  if (!_sb || !_sbUser) return null;
  const { data, error } = await _sb.from('stores')
    .select('data')
    .eq('user_id', _sbUser.id)
    .maybeSingle();
  if (error) { console.warn('[sbPullStore]', error.message); return null; }
  return data?.data ?? null;
}

// Push store to Supabase (strips file blobs to stay under size limits)
async function sbPushStore() {
  if (!_sb || !_sbUser) return;
  const stripped = {
    ...store,
    files: (store.files || []).map(({ data: _d, ...f }) => f)
  };
  const { error } = await _sb.from('stores').upsert({
    user_id: _sbUser.id,
    data: stripped,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  if (error) console.warn('[sbPushStore]', error.message);
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
