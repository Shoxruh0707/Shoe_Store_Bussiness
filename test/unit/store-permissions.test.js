const test = require('node:test');
const assert = require('node:assert/strict');
const { permissionsForRole, canAssignRole, canRemoveRole } = require('../../src/store/permissions');

test('effective permissions encode the owner manager seller hierarchy', () => {
  assert.deepEqual(permissionsForRole('seller'), {
    viewStore: true, viewInventory: true, sellProducts: true, viewLandingPrice: false,
    mutateInventory: false, viewAllSales: false, editStore: false, manageSellers: false,
    manageManagers: false, regenerateEntryCode: false
  });
  assert.equal(permissionsForRole('manager').mutateInventory, true);
  assert.equal(permissionsForRole('manager').manageSellers, true);
  assert.equal(permissionsForRole('manager').editStore, false);
  assert.equal(permissionsForRole('manager').manageManagers, false);
  assert.equal(permissionsForRole('owner').editStore, true);
  assert.equal(permissionsForRole('owner').manageManagers, true);
});

test('only owners assign managers while managers can administer sellers', () => {
  assert.equal(canAssignRole('owner', 'manager'), true);
  assert.equal(canAssignRole('owner', 'seller'), true);
  assert.equal(canAssignRole('manager', 'seller'), true);
  assert.equal(canAssignRole('manager', 'manager'), false);
  assert.equal(canAssignRole('seller', 'seller'), false);
  assert.equal(canRemoveRole('owner', 'manager'), true);
  assert.equal(canRemoveRole('manager', 'seller'), true);
  assert.equal(canRemoveRole('manager', 'manager'), false);
  assert.equal(canRemoveRole('owner', 'owner'), false);
});
