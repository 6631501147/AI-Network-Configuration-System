'use strict';

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');
const { promisify } = require('node:util');

const { createMockIamServer } = require('./mock-iam-server');

const execFileAsync = promisify(execFile);

let mockServer;
let baseUrl;

test.before(async function () {
  mockServer = createMockIamServer();
  const serverInfo = await mockServer.start();
  baseUrl = serverInfo.baseUrl;
});

test.after(async function () {
  await mockServer.stop();
});

test('AIBasedAutomaticNetworkConfigurationSystem bootstrap script provisions permissions and assigns the configured IAM account', async function () {
  const scriptPath = path.resolve(__dirname, '../scripts/bootstrap-aibasedautomaticnetworkconfigurationsystem-permissions.js');
  const execution = await execFileAsync(process.execPath, [scriptPath], {
    cwd: path.resolve(__dirname, '..'),
    env: Object.assign({}, process.env, {
      PROJECT_CODE: 'aibasedautomaticnetworkconfigurationsystem',
      PROJECT_NAME: 'AIBasedAutomaticNetworkConfigurationSystem',
      PROJECT_PERMISSION_TYPE_TITLE: 'AI Based Automatic Network Configuration System Administration',
      PROJECT_PERMISSION_GROUP_TITLE: 'AI Based Automatic Network Configuration System Admin',
      PROJECT_PERMISSION_ROOT_PATH: '/ai-based-automatic-network-configuration-system/security/permission',
      PROJECT_PERMISSION_PATHS: '/ai-based-automatic-network-configuration-system/security/permission,/dashboard,/accounts/directory',
      PROJECT_PERMISSION_ACCOUNT_EMAIL: 'ops@example.com',
      IAM_SDK_BASE_URL: baseUrl,
      IAM_SDK_CLIENT_ID: 'sample-sdk',
      IAM_SDK_CLIENT_SECRET: 'super-secret',
      IAM_SDK_AUDIENCE: 'aibasedautomaticnetworkconfigurationsystem-api',
      IAM_SDK_ADMIN_AUDIENCE: 'iam-admin-api',
      IAM_SDK_SCOPE: 'iam.security.read iam.security.write iam.audit.read iam.accounts.read'
    })
  });

  const payload = JSON.parse(execution.stdout);

  assert.equal(payload.ok, true);
  assert.equal(payload.accountId, 'acc-2');
  assert.equal(payload.accountEmail, 'ops@example.com');
  assert.equal(payload.assignmentId, 'acct-assign-inactive');
  assert.ok(payload.paths.includes('/ai-based-automatic-network-configuration-system/security/permission'));
  assert.ok(payload.paths.includes('/accounts/directory'));
});
