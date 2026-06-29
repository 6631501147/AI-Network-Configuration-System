'use strict';
const mongoose = require('mongoose');
var Schema = mongoose.Schema;

var objsSchema = new Schema({
    aibasedautomaticnetworkconfigurationsystemNo: { type: String, required: true },
    title: { type: String, required: true },
    partnerName: { type: String, required: true },
    partnerType: { type: String, default: 'University' },
    country: { type: String, default: 'Thailand' },
    ownerUnit: { type: String, default: null },
    coordinatorName: { type: String, default: null },
    coordinatorEmail: { type: String, default: null },
    status: { type: String, default: 'draft' },
    effectiveDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    renewalNoticeDate: { type: Date, default: null },
    documentUrl: { type: String, default: null },
    tags: [{ type: String }],
    notes: { type: String, default: null },
    create: {
        by: { type: Schema.ObjectId, default: null },
        name: { type: String, default: null },
        email: { type: String, default: null },
        datetime: { type: Date, default: Date.now }
    },
    update: {
        by: { type: Schema.ObjectId, default: null },
        name: { type: String, default: null },
        email: { type: String, default: null },
        datetime: { type: Date, default: null }
    }
}, {
    timestamps: true
});

var AIBasedAutomaticNetworkConfigurationSystemDocument = mongoose.model('AIBasedAutomaticNetworkConfigurationSystemDocument', objsSchema, 'AIBasedAutomaticNetworkConfigurationSystemDocuments');
module.exports = AIBasedAutomaticNetworkConfigurationSystemDocument;
