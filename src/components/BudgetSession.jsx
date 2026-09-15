import { useCallback, useEffect, useState } from 'react';
import App from '../App';
import { emptyBudget } from '../utils/budgetDocument';
import { readDemo, saveDemo, readLegacy, readDraft, writeDraft, accountKey } from '../utils/storage';
import { createDemoData } from '../utils/demoData';
import { cloudRepository, reconcileDraft, SaveQueue, ConflictError } from '../utils/cloudStorage';
import { createBudgetBackupText } from '../utils/backup';

async function downloadBackup(data) {
  const text = await createBudgetBackupText({ ...data, version: 2 });
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'budget-recovery.txt'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DemoSession({ onExit }) {
  const [initial, setInitial] = useState(() => {
    try { return { data: readDemo(createDemoData), version: 0 }; }
    catch { return { error: 'Demo storage could not be read. Reset to the sample data to continue.' }; }
  });
  const [status, setStatus] = useState('Changes are stored only in this browser.');
  const [confirm, setConfirm] = useState(false);
  const update = useCallback(data => {
    try { saveDemo(data); setStatus('Changes are stored only in this browser.'); }
    catch { setStatus('Browser storage unavailable. Changes will be lost when you leave; export a backup to keep them.'); }
  }, []);
  function reset() {
    const data = createDemoData(); update(data);
    setInitial(prev => ({ data, version: (prev.version || 0) + 1 })); setConfirm(false);
  }
  return <>
    <div className="session-bar"><div><strong>Demo Mode</strong><span>{status}</span></div><div className="session-actions"><button onClick={() => setConfirm(true)}>Reset Demo Data</button><button onClick={onExit}>Exit Demo</button></div></div>
    {confirm && <div className="account-prompt" role="dialog" aria-label="Reset demo"><p>Replace your demo changes with the original fictional sample data?</p><button onClick={reset}>Reset to Sample Data</button><button onClick={() => setConfirm(false)}>Cancel</button></div>}
    {initial.error ? <div className="account-prompt" role="alert">{initial.error}</div> : <App key={initial.version} initialData={initial.data} onDataChange={update} />}
  </>;
}

export function AccountSession({ client, user, onSignOut }) {
  const [state, setState] = useState({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('Loading…');
  const [leave, setLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let queue;
    async function initialize() {
      try {
        const repository = cloudRepository(client, user.id);
        const row = await repository.load();
        if (!active) return;
        const draft = readDraft(user.id);
        let reconciled;
        try { reconciled = reconcileDraft(row, draft); }
        catch (e) {
          if (e instanceof ConflictError) { setState({ kind: 'conflict', draft, row }); return; }
          throw e;
        }
        if (!row && !draft?.pending) {
          const legacy = readLegacy();
          if (legacy) { setState({ kind: 'migration', legacy }); return; }
        }
        const data = reconciled.data || emptyBudget();
        const pending = reconciled.pending || !row;
        queue = new SaveQueue({ userId: user.id, repository,
          draft: { ...reconciled, data, pending }, onStatus: next => { if (active) setStatus(next); } });
        queue.persist();
        setState({ kind: 'ready', initialData: data, queue });
        setStatus(pending ? 'Unsaved changes' : 'Saved');
        if (pending) void queue.flush();
      } catch (e) { if (active) setState({ kind: 'error', message: e.message || 'Could not load your cloud budget. Check your connection and retry. Your local data is untouched.' }); }
    }
    void initialize();
    const online = () => queue?.flush();
    const beforeUnload = event => {
      if (queue?.draft.pending) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('online', online);
    window.addEventListener('beforeunload', beforeUnload);
    return () => { active = false; queue?.stop(); window.removeEventListener('online', online); window.removeEventListener('beforeunload', beforeUnload); };
  }, [client, user.id, attempt]);

  const queue = state.queue;
  const update = useCallback(data => { queue?.update(data); }, [queue]);
  async function migrate(data) {
    setBusy(true); setError('');
    try {
      // Keep the original legacy keys forever. A per-user recovery copy is written first.
      writeDraft(user.id, { data, revision: 0, pending: true, operation: null });
      setState({ kind: 'loading' }); setAttempt(value => value + 1);
    } catch { setError('Could not keep a browser recovery copy. Export your existing data or free browser storage before migrating.'); }
    finally { setBusy(false); }
  }
  async function signOut(keepRecovery = false) {
    setBusy(true); setError('');
    try {
      if (queue && !keepRecovery && !(await queue.flush())) {
        if (queue.localError) { setError('Export your local changes before leaving; neither cloud saving nor browser recovery is available.'); return; }
        setLeave(true); return;
      }
      await onSignOut();
      if (queue && !queue.draft.pending) {
        try {
          const cached = readDraft(user.id);
          if (cached && !cached.pending && cached.writerId === queue.draft.writerId) localStorage.removeItem(accountKey(user.id));
        } catch { /* Cloud data is unaffected. */ }
      }
    } catch { setError('Could not sign out. Please check your connection and retry.'); }
    finally { setBusy(false); }
  }
  async function useCloud() {
    setBusy(true); setError('');
    try {
      const draft = queue?.draft || state.draft;
      // Preserve the displaced draft as well as offering a portable QBUD2 export.
      localStorage.setItem(`budget-recovery:${user.id}:${Date.now()}`, JSON.stringify(draft));
      const row = await cloudRepository(client, user.id).load();
      if (!row) throw new Error('Cloud data could not be loaded. Local changes were kept.');
      writeDraft(user.id, { data: row.data, revision: row.revision, pending: false, operation: null });
      setStatus('Loading…'); setState({ kind: 'loading' }); setAttempt(value => value + 1);
    } catch (e) { setError(e.message || 'Could not load the cloud copy.'); }
    finally { setBusy(false); }
  }
  async function exportLocal() {
    try { await downloadBackup(queue?.draft.data || state.draft.data); }
    catch { setError('Could not export the recovery copy. Please keep this page open and retry.'); }
  }
  const conflict = state.kind === 'conflict' || status === 'Conflict';
  return <>
    <div className="session-bar"><div><strong>{user.email || 'Your account'}</strong><span role="status">{status}</span></div><div className="session-actions">
      {state.kind === 'ready' && !conflict && status !== 'Saved' && <button disabled={busy} onClick={() => queue.flush()}>Retry Save</button>}
      <button disabled={busy} onClick={() => signOut()}>Sign Out</button></div></div>
    {error && <p role="alert" className="account-prompt account-error">{error}</p>}
    {leave && <div className="account-prompt" role="dialog" aria-label="Unsaved changes"><p>Some changes are not in the cloud. A recovery copy is saved in this browser for this account.</p><button disabled={busy} onClick={exportLocal}>Export Local Backup</button><button disabled={busy} onClick={() => signOut(true)}>Sign Out and Keep Recovery Copy</button><button onClick={() => setLeave(false)}>Stay Here</button></div>}
    {state.kind === 'loading' && <p className="account-prompt" role="status">Loading your budget…</p>}
    {state.kind === 'error' && <div className="account-prompt" role="alert"><p>{state.message}</p><button onClick={() => { setState({ kind: 'loading' }); setAttempt(value => value + 1); }}>Retry Loading</button></div>}
    {state.kind === 'migration' && <section className="account-prompt"><h2>Existing Budget Data Found</h2><p>We found Budget Tracker data saved in this browser. Move it into this empty account? The original browser copy will be kept.</p><button disabled={busy} onClick={() => migrate(state.legacy)}>Move it to my account</button><button disabled={busy} onClick={() => migrate(emptyBudget())}>Start Fresh</button></section>}
    {conflict && <section className="account-prompt" role="alert"><h2>A newer cloud budget was found</h2><p>Your local changes have been kept. Export them before loading the cloud copy. You can import that backup later if you choose to replace the cloud data.</p><button disabled={busy} onClick={exportLocal}>Export Local Backup</button><button disabled={busy} onClick={useCloud}>Use Cloud Copy and Archive Local Changes</button></section>}
    {state.kind === 'ready' && <App key={attempt} initialData={state.initialData} onDataChange={update} />}
  </>;
}
