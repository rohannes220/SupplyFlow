// Test-only accounts. The API seeds them in memory (IN_MEMORY_DEMO_USERS) for the e2e run only;
// these passwords exist nowhere else.
export const E2E_ADMIN = Object.freeze({
  name: 'Demo Admin',
  email: 'admin@supplyflow.com',
  password: 'e2e-Admin#Pass-1',
});

export const E2E_EMPLOYEE = Object.freeze({
  name: 'Demo Employee',
  email: 'employee@supplyflow.com',
  password: 'e2e-Employee#Pass-1',
});
