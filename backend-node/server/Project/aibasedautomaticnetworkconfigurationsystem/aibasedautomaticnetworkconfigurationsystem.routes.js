'use strict';

const express = require('express');
const router = express.Router();

const account = require('../accounts/service/account');
const authorization = require('../security/service/authorization');
const networkconfig = require('./service/networkconfig');

const canView   = authorization.requirePermission('/ai-based-automatic-network-configuration-system/registry', 'view');
const canEdit   = authorization.requirePermission('/ai-based-automatic-network-configuration-system/registry', 'edit');
const canDelete = authorization.requirePermission('/ai-based-automatic-network-configuration-system/registry', 'delete');
const canAction = authorization.requirePermission('/ai-based-automatic-network-configuration-system/registry', 'action');

// All routes require a valid session
router.use(account.onCheckAuthorization);

// List / query
router.get('/registry',      canView,   networkconfig.onQuerys);

// Get single
router.get('/registry/:id',  canView,   networkconfig.onGet);

// Create
router.post('/registry',     canEdit,   networkconfig.onCreate);

// Update
router.put('/registry/:id',  canEdit,   networkconfig.onUpdate);

// Delete
router.delete('/registry/:id', canDelete, networkconfig.onDelete);

// Rerun configuration
router.post('/registry/:id/rerun', canAction, networkconfig.onRerun);

module.exports = router;
