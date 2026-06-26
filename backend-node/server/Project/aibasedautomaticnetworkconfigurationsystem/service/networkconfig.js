'use strict';

const NetworkConfig = require('../models/NetworkConfig');

/**
 * List all configurations, with optional query filters.
 */
exports.onQuerys = async function (request, response) {
  try {
    const filter = {};
    if (request.query.status) filter.status = request.query.status;
    if (request.query.deviceType) filter.deviceType = request.query.deviceType;
    if (request.query.search) {
      const re = new RegExp(String(request.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ hostname: re }, { ip: re }, { template: re }];
    }
    const records = await NetworkConfig.find(filter).sort({ createdAt: -1 });
    return response.status(200).json({ success: true, data: records });
  } catch (err) {
    return response.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get a single configuration by ID.
 */
exports.onGet = async function (request, response) {
  try {
    const record = await NetworkConfig.findById(request.params.id);
    if (!record) return response.status(404).json({ success: false, message: 'Not found' });
    return response.status(200).json({ success: true, data: record });
  } catch (err) {
    return response.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Create a new configuration record.
 */
exports.onCreate = async function (request, response) {
  try {
    const { hostname, ip, deviceType, template, description, appliedBy } = request.body || {};
    if (!hostname || !ip) {
      return response.status(400).json({ success: false, message: 'hostname and ip are required' });
    }
    const record = new NetworkConfig({
      hostname,
      ip,
      deviceType: deviceType || 'router',
      template: template || '',
      description: description || '',
      appliedBy: appliedBy || 'manual',
      status: 'pending',
      log: ['INFO  Record created — pending first configuration run']
    });
    await record.save();
    return response.status(201).json({ success: true, data: record });
  } catch (err) {
    return response.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Update an existing configuration record.
 */
exports.onUpdate = async function (request, response) {
  try {
    const record = await NetworkConfig.findById(request.params.id);
    if (!record) return response.status(404).json({ success: false, message: 'Not found' });
    const allowed = ['hostname', 'ip', 'deviceType', 'template', 'description', 'status', 'appliedBy'];
    allowed.forEach(field => {
      if (request.body && request.body[field] !== undefined) {
        record[field] = request.body[field];
      }
    });
    if (request.body && Array.isArray(request.body.log)) {
      record.log = request.body.log;
    }
    await record.save();
    return response.status(200).json({ success: true, data: record });
  } catch (err) {
    return response.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Delete a configuration record.
 */
exports.onDelete = async function (request, response) {
  try {
    const record = await NetworkConfig.findByIdAndDelete(request.params.id);
    if (!record) return response.status(404).json({ success: false, message: 'Not found' });
    return response.status(200).json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    return response.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Trigger a re-run of configuration application on a device.
 */
exports.onRerun = async function (request, response) {
  try {
    const record = await NetworkConfig.findById(request.params.id);
    if (!record) return response.status(404).json({ success: false, message: 'Not found' });
    record.status = 'pending';
    record.lastRun = new Date();
    record.log = [
      ...record.log,
      `INFO  Re-run triggered at ${new Date().toISOString()}`
    ];
    await record.save();
    return response.status(200).json({ success: true, data: record });
  } catch (err) {
    return response.status(500).json({ success: false, message: err.message });
  }
};
