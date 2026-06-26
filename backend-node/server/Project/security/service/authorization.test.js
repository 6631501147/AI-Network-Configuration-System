'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../../../../config/config');
const authorization = require('./authorization');
const accountAccess = require('./account-access');
const AccountModel = require('../../accounts/controller/account');
const { createMockIamServer } = require('../../../../test/mock-iam-server');

let mockServer;
let originalOnQuery;
let originalPermissionSource;

function createResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

test.before(async function () {
  originalPermissionSource = config.security && config.security.permissionSource;
  config.security.permissionSource = 'iam';

  mockServer = createMockIamServer();
  const serverInfo = await mockServer.start();

  config.iam.baseUrl = serverInfo.baseUrl;
  config.iam.introspectPath = '/api/v1/b2b/introspect';
  config.iam.profilePath = '/api/v1/b2b/clients/me';
  config.iam.requiredAudience = 'aibasedautomaticnetworkconfigurationsystem-api';
  config.iamAdmin.baseUrl = serverInfo.baseUrl;
  config.iamAdmin.tokenPath = '/api/v1/b2b/token';
  config.iamAdmin.basePath = '/api/v1/b2b/admin';
  config.iamAdmin.clientId = 'ai-based-automatic-network-configuration-system-sdk';
  config.iamAdmin.clientSecret = 'super-secret';
  config.iamAdmin.scope = 'ai.based.automatic.network.configuration.system.registry.read ai.based.automatic.network.configuration.system.registry.write ai.based.automatic.network.configuration.system.report.read iam.security.read iam.security.write iam.audit.read iam.accounts.read';
  config.iamAdmin.audience = 'aibasedautomaticnetworkconfigurationsystem-api';

  originalOnQuery = AccountModel.onQuery;
  AccountModel.onQuery = async function (query) {
    if (query && String(query._id) === 'aibasedautomaticnetworkconfigurationsystem-account-1') {
      return {
        _id: 'aibasedautomaticnetworkconfigurationsystem-account-1',
        email: 'aibasedautomaticnetworkconfigurationsystem.ops@example.com'
      };
    }
    return null;
  };
});

test.after(async function () {
  AccountModel.onQuery = originalOnQuery;
  config.security.permissionSource = originalPermissionSource;
  await mockServer.stop();
});

test('account-access resolves effective permissions from IAM', async function () {
  mockServer.state.permissionMatrix = {
    '/accounts/directory': { view: true, edit: true, action: true }
  };

  const result = await accountAccess.getEffectivePermissions('aibasedautomaticnetworkconfigurationsystem-account-1');

  assert.equal(result.source, 'iam');
  assert.equal(result.accountId, 'acc-1');
  assert.equal(result.matrix['/accounts/directory'].view, true);
});

test('account-access resolves IAM group options and assignment snapshots', async function () {
  mockServer.state.accountAssignments = [
    {
      _id: 'acct-assign-1',
      account: 'acc-1',
      group: { _id: 'group-1', name: 'IAM Governance' },
      active: true,
      dataScope: 'org',
      scopeUnits: []
    }
  ];

  const groups = await accountAccess.getGroupOptions();
  const assignmentsByAccountId = await accountAccess.loadAssignmentsByAccountIds(['aibasedautomaticnetworkconfigurationsystem-account-1']);

  assert.equal(groups.length >= 2, true);
  assert.equal(groups[0]._id, 'group-1');
  assert.equal(Array.isArray(assignmentsByAccountId['aibasedautomaticnetworkconfigurationsystem-account-1']), true);
  assert.equal(assignmentsByAccountId['aibasedautomaticnetworkconfigurationsystem-account-1'][0].group._id, 'group-1');
});

test('authorization middleware enforces IAM-backed permission matrix', async function () {
  mockServer.state.permissionMatrix = {
    '/accounts/directory': { view: true, edit: false, action: false }
  };

  const allowMiddleware = authorization.requirePermission('/accounts/directory', 'view');
  const allowResponse = createResponse();
  let nextCalled = false;

  await allowMiddleware({
    body: { accounts: 'aibasedautomaticnetworkconfigurationsystem-account-1' }
  }, allowResponse, function () {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(allowResponse.payload, null);

  const denyMiddleware = authorization.requirePermission('/accounts/directory', 'edit');
  const denyResponse = createResponse();

  await denyMiddleware({
    body: { accounts: 'aibasedautomaticnetworkconfigurationsystem-account-1' }
  }, denyResponse, function () {
    throw new Error('next should not be called');
  });

  assert.equal(denyResponse.statusCode, 403);
  assert.equal(denyResponse.payload.status, false);
  assert.equal(denyResponse.payload.data.source, 'iam');
});
