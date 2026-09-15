import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { emptyBudget } from '../src/utils/budgetDocument';

let db;
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
const op = n => `00000000-0000-4000-8001-${String(n).padStart(12, '0')}`;
async function asUser(id, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id || '']);
  await db.exec(`set role ${role}`);
}
async function save(revision, id, data = emptyBudget()) {
  return (await db.query('select * from public.save_budget($1::jsonb,$2,$3::uuid)', [JSON.stringify(data), revision, id])).rows;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role authenticated; create role anon;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;`);
  await db.query('insert into auth.users(id) values ($1), ($2)', [a, b]);
  await db.exec(await readFile(new URL('../supabase/migrations/20260915020323_user_budget_data.sql', import.meta.url), 'utf8'));
});
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await db.exec('reset role; truncate public.user_budget_data'); });

describe('actual PostgreSQL migration and RLS (PGlite)', () => {
  it('enables RLS and creates the versioned document table', async () => {
    const { rows } = await db.query("select relrowsecurity, relforcerowsecurity from pg_class where oid = 'public.user_budget_data'::regclass");
    expect(rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
  });
  it('isolates two users for reads, writes, owner changes and deletes', async () => {
    await asUser(a); expect((await save(0, op(1)))[0].user_id).toBe(a);
    await asUser(b); expect((await save(0, op(2)))[0].user_id).toBe(b);
    expect((await db.query('select user_id from public.user_budget_data')).rows).toEqual([{ user_id: b }]);
    expect((await db.query('update public.user_budget_data set data = $1 where user_id = $2 returning *', [JSON.stringify(emptyBudget()), a])).rows).toEqual([]);
    await expect(db.query('update public.user_budget_data set user_id = $1 where user_id = $2', [a, b])).rejects.toThrow();
    await expect(db.query('delete from public.user_budget_data where user_id = $1', [a])).rejects.toThrow();
    await asUser(a);
    expect((await db.query('select user_id from public.user_budget_data')).rows).toEqual([{ user_id: a }]);
    expect((await db.query('update public.user_budget_data set data = $1 where user_id = $2 returning *', [JSON.stringify(emptyBudget()), b])).rows).toEqual([]);
  });
  it('prevents inserting a different owner and denies anonymous enumeration/RPC', async () => {
    await asUser(a);
    await expect(db.query('insert into public.user_budget_data(user_id,data) values ($1,$2)', [b, JSON.stringify(emptyBudget())])).rejects.toThrow();
    await asUser(null, 'anon');
    await expect(db.query('select * from public.user_budget_data')).rejects.toThrow();
    await expect(save(0, op(1))).rejects.toThrow();
    await asUser(null);
    await expect(save(0, op(1))).rejects.toThrow('Authentication required');
  });
  it('rejects stale revisions, idempotently retries, and increments exactly once', async () => {
    await asUser(a);
    expect((await save(0, op(1)))[0].revision).toBe(1);
    expect((await save(0, op(1)))[0].revision).toBe(1);
    expect(await save(0, op(2))).toEqual([]);
    expect((await save(1, op(3)))[0].revision).toBe(2);
    expect(await save(1, op(4))).toEqual([]);
    expect((await save(1, op(3)))[0].revision).toBe(2);
  });
});
