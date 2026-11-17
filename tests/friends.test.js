import test from 'node:test';
import assert from 'node:assert/strict';
import { codeIn, FRIEND_CODE } from '../friends-ui.js';

test('friends: the code is found in links, pastes and lower case, and odd text is refused', () => {
  assert.equal(codeIn('https://zhihui.onrender.com/add/KB-7Q4M2X'), 'KB-7Q4M2X');
  assert.equal(codeIn(' kb-7q4m2x '), 'KB-7Q4M2X');
  assert.equal(codeIn('my id: KB-ABC234, add me'), 'KB-ABC234');
  assert.equal(codeIn('KB-0O1IL5'), '', 'no 0, O, 1, I or L');
  assert.equal(codeIn(''), '');
  assert.equal(codeIn(null), '');
  assert.ok(FRIEND_CODE.test('KB-ZZZZZZ'));
});

test('friends: tables are closed and the functions are for signed-in accounts only', async () => {
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(new URL('../cloud-schema.sql', import.meta.url), 'utf8');
  for (const table of ['friend_codes', 'friend_requests', 'friend_links']) assert.match(sql, new RegExp(`alter table public\.${table} enable row level security`));
  assert.match(sql, /revoke all on public\.friend_codes, public\.friend_requests, public\.friend_links from anon, authenticated;/);
  const grant = sql.split('grant execute on function public.my_friend_code()')[1].split(';')[0];
  assert.match(grant, /to authenticated$/);
  assert.doesNotMatch(grant, /\banon\b/);
  assert.doesNotMatch(grant, /friend_new_code|friend_user|friend_pair_exists/, 'helpers stay internal');
});
