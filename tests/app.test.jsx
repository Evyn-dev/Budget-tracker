// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import Root from '../src/Root';
import { createDemoData } from '../src/utils/demoData';
import { accountKey, DEMO_KEY } from '../src/utils/storage';

const mock = vi.hoisted(() => ({ client: null, repository: null }));
vi.mock('../src/lib/supabase', () => ({ getSupabase: () => mock.client }));
vi.mock('../src/utils/cloudStorage', async importOriginal => ({ ...await importOriginal(), cloudRepository: () => mock.repository }));

let session, listeners, rows;
const users = { 'a@example.test': { id: 'a', email: 'a@example.test' }, 'b@example.test': { id: 'b', email: 'b@example.test' } };
function emit(event, next) { session = next; for (const listener of listeners) listener(event, next); }
beforeEach(() => {
  window.history.replaceState(null, '', '/');
  localStorage.clear(); sessionStorage.clear(); session = null; listeners = new Set(); rows = new Map();
  mock.client = { auth: {
    startAutoRefresh: vi.fn(), stopAutoRefresh: vi.fn(),
    onAuthStateChange: vi.fn(fn => { listeners.add(fn); return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } }; }),
    getSession: vi.fn(async () => ({ data: { session } })),
    signInWithPassword: vi.fn(async ({ email, password }) => {
      if (!users[email] || password !== 'correct-password') return { error: new Error('Invalid credentials') };
      emit('SIGNED_IN', { user: users[email] }); return { data: { session } };
    }),
    signUp: vi.fn(async () => ({ data: { session: null } })),
    signOut: vi.fn(async () => { emit('SIGNED_OUT', null); return {}; }),
    resetPasswordForEmail: vi.fn(async () => ({})), updateUser: vi.fn(async () => ({})),
  } };
  mock.repository = {
    load: vi.fn(async () => structuredClone(rows.get(session.user.id) || null)),
    save: vi.fn(async (data, revision, id) => {
      const row = { data: structuredClone(data), revision: revision + 1, last_write_id: id };
      rows.set(session.user.id, row); return row;
    }),
  };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function login(email = 'a@example.test', password = 'correct-password') {
  await screen.findByRole('button', { name: 'Sign In', exact: true });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign In', exact: true }));
}
async function tab(name) {
  fireEvent.click(screen.getByRole('button', { name: /^(Home|Recaps|Money|Subscriptions|Credit Cards|Debts|Categories)\s*▼$/ }));
  fireEvent.click(screen.getByRole('button', { name, exact: true }));
}

describe('authentication and app persistence', () => {
  it('opens recovery from demo mode, retains it on refresh, and clears it only after success', async () => {
    sessionStorage.setItem('budget-mode', 'demo');
    window.history.replaceState(null, '', '/#type=recovery');
    const view = render(<Root />);
    await waitFor(() => expect(mock.client.auth.onAuthStateChange).toHaveBeenCalled());
    act(() => emit('PASSWORD_RECOVERY', { user: users['a@example.test'] }));
    await screen.findByRole('button', { name: 'Update Password' });
    expect(sessionStorage.getItem('budget-mode')).toBeNull();
    window.history.replaceState(null, '', '/');
    view.unmount(); render(<Root />);
    await screen.findByRole('button', { name: 'Update Password' });
    mock.client.auth.updateUser.mockResolvedValueOnce({ error: new Error('Try a different password') });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'new-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
    await screen.findByText('Try a different password');
    expect(sessionStorage.getItem('budget-recovery-user')).toBe('a');
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
    await screen.findByRole('button', { name: 'Sign Out' });
    expect(sessionStorage.getItem('budget-recovery-user')).toBeNull();
  });
  it('does not show another account the previous account recovery screen', async () => {
    sessionStorage.setItem('budget-recovery-user', 'a');
    session = { user: users['b@example.test'] };
    render(<Root />);
    await screen.findByRole('button', { name: 'Sign Out' });
    expect(screen.queryByRole('button', { name: 'Update Password' })).toBeNull();
  });
  it('explains expired email links even with a saved session and does not change the password', async () => {
    session = { user: users['a@example.test'] };
    window.history.replaceState(null, '', '/#error=access_denied&error_code=otp_expired');
    render(<Root />);
    expect(screen.getByRole('alert').textContent).toContain('already been used');
    await waitFor(() => expect(mock.client.auth.getSession).toHaveBeenCalled());
    expect(mock.repository.load).not.toHaveBeenCalled();
    expect(mock.client.auth.updateUser).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('button', { name: 'Sign Out' });
    expect(window.location.hash).toBe('');
  });
  it('handles signup confirmation, wrong password, reset email and recovery', async () => {
    render(<Root />);
    await screen.findByRole('button', { name: 'Create Account', exact: true });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account', exact: true }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account', exact: true }));
    await screen.findByText(/Check your email to confirm/);
    fireEvent.click(screen.getByRole('button', { name: 'Back to Sign In' }));
    await login('a@example.test', 'wrong');
    await screen.findByRole('alert'); expect(mock.repository.load).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Forgot Password?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));
    await screen.findByText(/If an account exists/);
    expect(mock.client.auth.resetPasswordForEmail).toHaveBeenCalled();
    act(() => emit('PASSWORD_RECOVERY', { user: users['a@example.test'] }));
    await screen.findByRole('button', { name: 'Update Password' });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'new-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
    await screen.findByRole('button', { name: 'Sign Out' });
    expect(mock.client.auth.updateUser).toHaveBeenCalledWith({ password: 'new-password' });
  });
  it('saves a transaction, survives refresh and signout/signin, and isolates another account', async () => {
    const view = render(<Root />); await login();
    await screen.findByRole('button', { name: 'Add Transaction' });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'income' } });
    fireEvent.change(screen.getByPlaceholderText('Enter total amount'), { target: { value: '1234' } });
    fireEvent.change(screen.getByPlaceholderText('Add a note'), { target: { value: 'Cloud paycheck test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));
    await waitFor(() => expect(rows.get('a').data.transactions.some(t => t.note === 'Cloud paycheck test')).toBe(true));
    view.unmount(); render(<Root />);
    await screen.findByText(/Cloud paycheck test/);
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    await login('b@example.test'); await screen.findByRole('button', { name: 'Add Transaction' });
    expect(screen.queryByText(/Cloud paycheck test/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    await login(); await screen.findByText(/Cloud paycheck test/);
    expect(rows.get('a').data.transactions).toHaveLength(1);
  });
  it('prompts before migrating legacy data and retains it across failed cloud saves', async () => {
    const legacy = createDemoData();
    localStorage.setItem('transactions', JSON.stringify(legacy.transactions));
    mock.repository.save.mockRejectedValue(new Error('offline'));
    render(<Root />); await login();
    await screen.findByText('Existing Budget Data Found');
    expect(mock.repository.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Move it to my account' }));
    await screen.findByText(/Offline \/ Save failed/);
    expect(JSON.parse(localStorage.getItem('transactions'))).toEqual(legacy.transactions);
    expect(JSON.parse(localStorage.getItem(accountKey('a'))).pending).toBe(true);
    mock.repository.save.mockImplementation(async (data, revision) => { const row = { data, revision: revision + 1 }; rows.set('a', row); return row; });
    fireEvent.click(screen.getByRole('button', { name: 'Retry Save' }));
    await screen.findByText('Saved');
    expect(rows.get('a').data.transactions).toHaveLength(legacy.transactions.length);
    expect(localStorage.getItem('transactions')).toBeTruthy();
  });
  it('Start Fresh preserves legacy data without importing it', async () => {
    localStorage.setItem('transactions', JSON.stringify(createDemoData().transactions));
    render(<Root />); await login();
    fireEvent.click(await screen.findByRole('button', { name: 'Start Fresh' }));
    await screen.findByText('Saved');
    expect(rows.get('a').data.transactions).toEqual([]);
    expect(JSON.parse(localStorage.getItem('transactions')).length).toBeGreaterThan(0);
  });
  it('does not initialize an empty account after a failed cloud load', async () => {
    mock.repository.load.mockRejectedValue(new Error('Network unavailable'));
    render(<Root />); await login();
    await screen.findByText('Network unavailable');
    expect(screen.queryByRole('button', { name: 'Add Transaction' })).toBeNull();
    expect(mock.repository.save).not.toHaveBeenCalled();
  });
  it('validates imports, exports QBUD2, and persists imported account data', async () => {
    rows.set('a', { data: createDemoData(), revision: 1 });
    render(<Root />); await login();
    await screen.findByRole('button', { name: 'Add Transaction' });
    await tab('Categories');
    fireEvent.click(screen.getByRole('button', { name: 'Export Backup' }));
    const textbox = screen.getByPlaceholderText(/Export will place/);
    await waitFor(() => expect(textbox.value.startsWith('QBUD2:')).toBe(true));
    fireEvent.change(textbox, { target: { value: '{"unexpected":true}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import Backup' }));
    await screen.findByText('That text is not valid import data.');
    expect(screen.queryByRole('button', { name: 'Import Data' })).toBeNull();
    const imported = createDemoData(); imported.transactions[0].note = 'Imported account backup';
    fireEvent.change(textbox, { target: { value: JSON.stringify(imported) } });
    fireEvent.click(screen.getByRole('button', { name: 'Import Backup' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Import Data' }));
    await waitFor(() => expect(rows.get('a').data.transactions[0].note).toBe('Imported account backup'));
  });
});

describe('public demo', () => {
  it('works without cloud configuration, covers every major tab, resets edits and exits', async () => {
    mock.client = null;
    render(<Root />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try Demo' }));
    await screen.findByText('Demo Mode');
    expect(screen.getAllByText(/Northstar Studio/).length).toBeGreaterThan(0);
    for (const name of ['Recaps', 'Money', 'Subscriptions', 'Credit Cards', 'Debts', 'Categories', 'Home']) {
      await tab(name);
      expect(screen.getByRole('button', { name: new RegExp('^' + name + '\\s*▼$') })).toBeTruthy();
    }
    fireEvent.change(screen.getByPlaceholderText('Enter total amount'), { target: { value: '4' } });
    fireEvent.change(screen.getByPlaceholderText('Add a note'), { target: { value: 'Demo experiment' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));
    await screen.findByText(/Demo experiment/);
    expect(JSON.parse(localStorage.getItem(DEMO_KEY)).transactions.some(t => t.note === 'Demo experiment')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reset Demo Data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Sample Data' }));
    expect(screen.queryByText(/Demo experiment/)).toBeNull();
    expect(mock.repository.load).not.toHaveBeenCalled(); expect(mock.repository.save).not.toHaveBeenCalled();
    expect(localStorage.getItem('transactions')).toBeNull();
    await tab('Categories');
    const imported = createDemoData(); imported.transactions[0].note = 'Demo import only';
    fireEvent.change(screen.getByPlaceholderText(/Export will place/), { target: { value: JSON.stringify(imported) } });
    fireEvent.click(screen.getByRole('button', { name: 'Import Backup' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Import Data' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(DEMO_KEY)).transactions[0].note).toBe('Demo import only'));
    expect(mock.repository.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Exit Demo' }));
    await screen.findByRole('button', { name: 'Try Demo' });
  });
  it('refreshes an existing demo without initializing an auth session', async () => {
    sessionStorage.setItem('budget-mode', 'demo');
    render(<Root />); await screen.findByText('Demo Mode');
    expect(mock.client.auth.getSession).not.toHaveBeenCalled();
    expect(mock.client.auth.startAutoRefresh).not.toHaveBeenCalled();
  });
});
