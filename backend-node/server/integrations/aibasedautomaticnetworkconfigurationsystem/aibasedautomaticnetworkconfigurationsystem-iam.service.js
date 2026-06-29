'use strict';

const { createProjectIamService } = require('../iam/project-iam-service');
const { normalizeAudience, normalizeScope } = require('../iam/iam-sdk-adapter');

const DEFAULT_AI_BASED_AUTOMATIC_NETWORK_CONFIGURATION_SYSTEM_SCOPES = [
  'ai.based.automatic.network.configuration.system.registry.read',
  'ai.based.automatic.network.configuration.system.registry.write',
  'ai.based.automatic.network.configuration.system.report.read',
  'iam.security.read',
  'iam.security.write',
  'iam.audit.read',
  'iam.accounts.read'
];

function applyAIBasedAutomaticNetworkConfigurationSystemDefaults(payload) {
  const source = payload || {};
  const metadata = Object.assign({}, source.metadata || {});

  const targetSystem = String(source.targetSystem || metadata.targetSystem || 'aibasedautomaticnetworkconfigurationsystem').trim();
  const ownerEmail = String(source.ownerEmail || metadata.ownerEmail || 'ai-based-automatic-network-configuration-system.integration@example.com').trim();
  const partnerId = String(source.partnerId || metadata.partnerId || 'ai-based-automatic-network-configuration-system-team').trim();
  const tenant = String(source.tenant || metadata.tenant || 'iam-shared').trim();
  const systemCode = source.systemCode || metadata.systemCode || null;

  return Object.assign({}, source, {
    targetSystem: targetSystem,
    ownerEmail: ownerEmail,
    partnerId: partnerId,
    tenant: tenant,
    allowedScopes: normalizeScope(source.allowedScopes || metadata.allowedScopes || DEFAULT_AI_BASED_AUTOMATIC_NETWORK_CONFIGURATION_SYSTEM_SCOPES),
    allowedAudiences: normalizeAudience(source.allowedAudiences || metadata.allowedAudiences || 'aibasedautomaticnetworkconfigurationsystem-api'),
    metadata: Object.assign({}, metadata, systemCode ? {
      systemCode: String(systemCode).trim()
    } : {}, {
      targetSystem: targetSystem,
      ownerEmail: ownerEmail,
      partnerId: partnerId,
      tenant: tenant
    })
  });
}

function createAIBasedAutomaticNetworkConfigurationSystemIamService(config) {
  const projectIamService = createProjectIamService(config);

  return Object.assign({}, projectIamService, {
    async registerManagedClient(payload, options) {
      return projectIamService.registerManagedClient(applyAIBasedAutomaticNetworkConfigurationSystemDefaults(payload), options || {});
    },
    async updateManagedClient(payload, options) {
      return projectIamService.updateManagedClient(applyAIBasedAutomaticNetworkConfigurationSystemDefaults(payload), options || {});
    }
  });
}

module.exports = {
  createAIBasedAutomaticNetworkConfigurationSystemIamService: createAIBasedAutomaticNetworkConfigurationSystemIamService
};
