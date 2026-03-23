const mongoose = require('mongoose');

const notificationDeviceSchema = new mongoose.Schema(
    {
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true
        },
        platform: {
            type: String,
            enum: ['android', 'ios'],
            required: true
        },
        expoPushToken: {
            type: String,
            required: true,
            index: true
        },
        isActive: {
            type: Boolean,
            default: true
        },
        lastSeenAt: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
);

notificationDeviceSchema.index({ organizationId: 1, expoPushToken: 1 }, { unique: true });

module.exports = mongoose.model('NotificationDevice', notificationDeviceSchema);