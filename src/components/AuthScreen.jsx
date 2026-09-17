import { useState } from 'react';

export default function AuthScreen({ client, onDemo, recovering = false, onRecovered }) {
  const [view, setView] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const kind = recovering ? 'recovery' : view;
  const label = { signin: 'Sign In', signup: 'Create Account', reset: 'Send Reset Link', recovery: 'Update Password' }[kind];

  async function submit(event) {
    event.preventDefault();
    setError(''); setMessage(''); setBusy(true);
    try {
      if (!client) throw new Error('Cloud accounts are not configured yet. You can still try the demo.');
      const redirectTo = window.location.origin + '/';
      let result;
      if (kind === 'signin') result = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (kind === 'signup') {
        result = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo } });
        if (!result.error && !result.data.session) setMessage('Check your email to confirm your account, then sign in.');
      }
      if (kind === 'reset') {
        result = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (!result.error) setMessage('If an account exists for this email, a password reset link will arrive shortly.');
      }
      if (kind === 'recovery') result = await client.auth.updateUser({ password });
      if (result.error) throw result.error;
      setPassword('');
      if (kind === 'recovery') onRecovered();
    } catch (e) {
      setError(kind === 'signin' ? 'Could not sign in. Check your email, password, email confirmation, and connection.' : e.message || 'Please try again.');
    } finally { setBusy(false); }
  }
  function changeView(next) { setView(next); setError(''); setMessage(''); setPassword(''); }

  return <main className="account-page">
    <section className="account-card">
      <p className="account-eyebrow">YOUR MONEY, IN ONE PLACE</p>
      <h1>Budget Tracker</h1>
      <p className="account-muted">Track income, expenses, savings, subscriptions, debts, and credit activity in one place.</p>
      {!client && <p className="account-notice">Cloud accounts are not configured yet. Explore the complete app with fictional demo data.</p>}
      <h2>{kind === 'recovery' ? 'Choose a new password' : kind === 'reset' ? 'Reset your password' : label}</h2>
      <p className="account-muted">Note: Password resets currently do not work.</p>
      <form onSubmit={submit}>
        {kind !== 'recovery' && <label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>}
        {kind !== 'reset' && <label>Password<input type="password" autoComplete={kind === 'signin' ? 'current-password' : 'new-password'} minLength={kind === 'signin' ? 1 : 8} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>}
        {error && <p role="alert" className="account-error">{error}</p>}
        {message && <p role="status">{message}</p>}
        <button className="account-primary" disabled={busy || !client}>{busy ? 'Please wait…' : label}</button>
      </form>
      {!recovering && <>
        <div className="account-links">
          <button disabled={busy} onClick={() => changeView(view === 'signup' ? 'signin' : 'signup')}>{view === 'signup' ? 'Back to Sign In' : 'Create Account'}</button>
          <button disabled={busy} onClick={() => changeView(view === 'reset' ? 'signin' : 'reset')}>{view === 'reset' ? 'Back to Sign In' : 'Forgot Password?'}</button>
        </div>
        <div className="account-demo"><p>Want to explore first?</p><button onClick={onDemo} disabled={busy}>Try Demo</button><p className="account-muted">No account needed. Fictional data. Make it your own.</p></div>
      </>}
    </section>
  </main>;
}
