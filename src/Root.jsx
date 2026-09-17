import { useEffect, useState } from 'react';
import { getSupabase } from './lib/supabase';
import AuthScreen from './components/AuthScreen';
import { AccountSession, DemoSession } from './components/BudgetSession';
import './account.css';

function initialMode() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (hash.get('type') === 'recovery') return 'account';
  try { return sessionStorage.getItem('budget-mode') === 'demo' ? 'demo' : 'account'; }
  catch { return 'account'; }
}

function recoveryUser(id) {
  try {
    if (id === null) sessionStorage.removeItem('budget-recovery-user');
    else if (id !== undefined) sessionStorage.setItem('budget-recovery-user', id);
    return sessionStorage.getItem('budget-recovery-user');
  } catch { return null; }
}

export default function Root() {
  const [mode, setMode] = useState(initialMode);
  const [linkError, setLinkError] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    if (!hash.has('error') && !query.has('error')) return null;
    return (hash.get('error_code') || query.get('error_code')) === 'otp_expired'
      ? 'This email link is invalid, has expired, or has already been used. Opening this link did not change your password. Request a new link using Forgot Password and open it once.'
      : 'This email link could not be verified. Request a new link and try again.';
  });
  const [auth, setAuth] = useState({ loading: true, session: null, client: null, recovering: false });
  useEffect(() => {
    if (mode === 'demo') return;
    let active = true;
    let receivedAuthEvent = false;
    const client = getSupabase();
    if (!client) {
      // Initialization is asynchronous so this follows the same lifecycle as session loading.
      Promise.resolve().then(() => { if (active) setAuth({ loading: false, session: null, client: null, recovering: false }); });
      return () => { active = false; };
    }
    client.auth.startAutoRefresh();
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      receivedAuthEvent = true;
      if (event === 'PASSWORD_RECOVERY' && session) {
        recoveryUser(session.user.id);
        try { sessionStorage.removeItem('budget-mode'); } catch { /* In-memory account mode is sufficient. */ }
      }
      if (event === 'SIGNED_OUT') recoveryUser(null);
      setAuth(prev => ({ client, session, loading: false, recovering: Boolean(session && (
        event === 'PASSWORD_RECOVERY' || recoveryUser() === session.user.id ||
        (prev.recovering && prev.session?.user.id === session.user.id)
      )) }));
    });
    client.auth.getSession().then(({ data, error }) => {
      if (active && !receivedAuthEvent) setAuth({ client, loading: false, session: error ? null : data.session,
        recovering: Boolean(!error && data.session && recoveryUser() === data.session.user.id) });
    }).catch(() => { if (active && !receivedAuthEvent) setAuth({ client, loading: false, session: null, recovering: false }); });
    return () => { active = false; subscription.unsubscribe(); client.auth.stopAutoRefresh(); };
  }, [mode]);
  function enterDemo() {
    try { sessionStorage.setItem('budget-mode', 'demo'); } catch { /* Demo still works for this visit. */ }
    setMode('demo');
  }
  function exitDemo() {
    try { sessionStorage.removeItem('budget-mode'); } catch { /* In-memory mode still resets. */ }
    setAuth({ loading: true, session: null, client: null, recovering: false }); setMode('account');
  }
  async function signOut() {
    const { error } = await auth.client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    setAuth(prev => ({ ...prev, session: null, recovering: false }));
  }
  if (linkError) return <main className="account-page"><section className="account-card">
    <h1>Budget Tracker</h1><h2>Email link could not be used</h2>
    <p role="alert" className="account-error">{linkError}</p>
    <p>Your existing budget and session have been preserved.</p>
    <button onClick={() => {
      const url = new URL(window.location.href);
      url.hash = '';
      for (const key of ['error', 'error_code', 'error_description']) url.searchParams.delete(key);
      window.history.replaceState(null, '', url.pathname + url.search);
      setLinkError(null);
    }}>Continue</button>
  </section></main>;
  if (mode === 'demo') return <DemoSession onExit={exitDemo} />;
  if (auth.loading) return <main className="account-page"><p role="status">Opening Budget Tracker…</p></main>;
  if (auth.recovering) return <AuthScreen client={auth.client} recovering onRecovered={() => {
    recoveryUser(null);
    setAuth(prev => ({ ...prev, recovering: false }));
  }} />;
  if (!auth.session) return <AuthScreen client={auth.client} onDemo={enterDemo} />;
  return <AccountSession key={auth.session.user.id} client={auth.client} user={auth.session.user} onSignOut={signOut} />;
}
