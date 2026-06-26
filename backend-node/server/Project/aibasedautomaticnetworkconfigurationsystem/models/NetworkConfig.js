'use strict';

const mongoose = require('mongoose');

const NetworkConfigSchema = new mongoose.Schema(
  {
    hostname:    { type: String, required: true, trim: true },
    ip:          { type: String, required: true, trim: true },
    deviceType:  { type: String, enum: ['router', 'switch', 'firewall', 'ap'], default: 'router' },
    template:    { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    appliedBy:   { type: String, trim: true, default: 'manual' },
    status:      { type: String, enum: ['active', 'pending', 'error', 'archived'], default: 'pending' },
    log:         { type: [String], default: [] },
    lastRun:     { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('NetworkConfig', NetworkConfigSchema);
