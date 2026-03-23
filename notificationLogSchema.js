const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema(
    {
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true
        },
        clientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true
        },
        type: {
            type: String,
            enum: ['stale_progress'],
            required: true
        },
        dedupeKey: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        sentAt: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('NotificationLog', notificationLogSchema);