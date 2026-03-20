const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('monitor off kembali ke akun sebelum monitoring', async () => {
  const dbPath = path.resolve(__dirname, '../src/db/index.js');
  const accountPath = path.resolve(__dirname, '../src/bot/account.js');

  delete require.cache[dbPath];
  delete require.cache[accountPath];

  const calls = [];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      getActiveAccountToken: async () => ({ accountId: 1, token: 't' }),
      rotateActiveAccountToken: async () => ({ accountId: 1, token: 't2' }),
      getActiveAccountContext: async () => ({ accountId: 10, canWrite: true, role: 'owner' }),
      joinAccountByToken: async () => {},
      listUserAccounts: async () => [],
      setActiveAccount: async (userId, accountId) => calls.push(['setActiveAccount', userId, accountId]),
      createAccountAndSetActive: async () => ({ accountId: 99, token: 'x' }),
      switchToOwnedAccount: async (userId) => calls.push(['switchToOwnedAccount', userId]),
      createInvite: async () => ({ id: 1, token: 'i' }),
      listInvites: async () => [],
      revokeInvite: async () => {},
      listMembers: async () => [],
      revokeMember: async () => {},
    },
  };

  const { handleJoinToken, handleMonitorOff } = require(accountPath);
  const senderId = 'u1';
  const message = { reply: async () => {} };

  await handleJoinToken(message, senderId, 'shared-token');

  require.cache[dbPath].exports.getActiveAccountContext = async () => ({
    accountId: 20,
    canWrite: false,
    role: 'viewer',
  });

  await handleMonitorOff(message, senderId);

  assert.deepEqual(calls, [['setActiveAccount', senderId, 10]]);
});

