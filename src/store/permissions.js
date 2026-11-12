const base = Object.freeze({
  viewStore: false,
  viewInventory: false,
  sellProducts: false,
  viewLandingPrice: false,
  mutateInventory: false,
  viewAllSales: false,
  editStore: false,
  manageSellers: false,
  manageManagers: false,
  regenerateEntryCode: false
});

const byRole = Object.freeze({
  seller: Object.freeze({ ...base, viewStore: true, viewInventory: true, sellProducts: true }),
  manager: Object.freeze({
    ...base, viewStore: true, viewInventory: true, sellProducts: true, viewLandingPrice: true,
    mutateInventory: true, viewAllSales: true, manageSellers: true
  }),
  owner: Object.freeze({
    ...base, viewStore: true, viewInventory: true, sellProducts: true, viewLandingPrice: true,
    mutateInventory: true, viewAllSales: true, editStore: true, manageSellers: true,
    manageManagers: true, regenerateEntryCode: true
  })
});

function permissionsForRole(role) {
  return { ...(byRole[role] || base) };
}

function canAssignRole(actorRole, targetRole) {
  return targetRole === 'seller'
    ? ['owner', 'manager'].includes(actorRole)
    : targetRole === 'manager' && actorRole === 'owner';
}

function canRemoveRole(actorRole, targetRole) {
  if (targetRole === 'owner') return false;
  return targetRole === 'seller'
    ? ['owner', 'manager'].includes(actorRole)
    : targetRole === 'manager' && actorRole === 'owner';
}

module.exports = { permissionsForRole, canAssignRole, canRemoveRole };
