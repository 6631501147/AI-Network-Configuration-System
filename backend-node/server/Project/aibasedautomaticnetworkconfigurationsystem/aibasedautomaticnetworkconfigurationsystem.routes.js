'use strict';

const express = require('express');
const router = express.Router();

const account = require('../accounts/service/account');
const authorization = require('../security/service/authorization');
const aibasedautomaticnetworkconfigurationsystemDocument = require('./service/aibasedautomaticnetworkconfigurationsystem_document');

const canViewRegistry = authorization.requirePermission('/ai-based-automatic-network-configuration-system/registry', 'view');
const canEditRegistry = authorization.requirePermission('/ai-based-automatic-network-configuration-system/registry', 'edit');
const canDeleteRegistry = authorization.requirePermission('/ai-based-automatic-network-configuration-system/registry', 'delete');
const canViewReports = authorization.requirePermission(['/ai-based-automatic-network-configuration-system/registry', '/ai-based-automatic-network-configuration-system/reports'], 'view');

function ok(response, data, status) {
  return response.status(status || 200).json({
    code: 20000,
    message: 'Success',
    data: data
  });
}

function fail(response, error) {
  const status = error && error.status ? error.status : 500;
  return response.status(status).json({
    code: status === 400 ? 40000 : 50000,
    message: error && error.message ? error.message : 'AIBasedAutomaticNetworkConfigurationSystem request failed'
  });
}

router.use(account.onCheckAuthorization);

router.get('/documents', canViewRegistry, async function (request, response) {
  try {
    return ok(response, await aibasedautomaticnetworkconfigurationsystemDocument.list(request.query || {}));
  } catch (error) {
    return fail(response, error);
  }
});

router.get('/documents/stats', canViewReports, async function (request, response) {
  try {
    return ok(response, await aibasedautomaticnetworkconfigurationsystemDocument.stats());
  } catch (error) {
    return fail(response, error);
  }
});

router.post('/documents', canEditRegistry, async function (request, response) {
  try {
    return ok(response, await aibasedautomaticnetworkconfigurationsystemDocument.create(request.body || {}, request), 201);
  } catch (error) {
    return fail(response, error);
  }
});

router.put('/documents/:id', canEditRegistry, async function (request, response) {
  try {
    return ok(response, await aibasedautomaticnetworkconfigurationsystemDocument.update(request.params.id, request.body || {}, request));
  } catch (error) {
    return fail(response, error);
  }
});

router.delete('/documents/:id', canDeleteRegistry, async function (request, response) {
  try {
    return ok(response, await aibasedautomaticnetworkconfigurationsystemDocument.remove(request.params.id));
  } catch (error) {
    return fail(response, error);
  }
});

router.post('/documents/seed-demo', canEditRegistry, async function (request, response) {
  try {
    return ok(response, await aibasedautomaticnetworkconfigurationsystemDocument.seedDemo(request), 201);
  } catch (error) {
    return fail(response, error);
  }
});

module.exports = router;
