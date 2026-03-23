const express = require('express');
const { Expo } = require('expo-server-sdk');
const NotificationDevice = require('../notificationDeviceSchema');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const expo = new Expo();

const normalizePlatform = (platform) => (typeof platform === 'string' ? platform.trim().toLowerCase() : '');
const normalizeToken = (token) => (typeof token === 'string' ? token.trim() : '');

const markInvalidTokensInactiveFromTickets = async (messages, tickets) => {
    const invalidTokens = [];

    for (let i = 0; i < tickets.length; i += 1) {
        const ticket = tickets[i];
        if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(messages[i]?.to);
        }
    }

    const uniqueInvalidTokens = [...new Set(invalidTokens.filter(Boolean))];
    if (!uniqueInvalidTokens.length) return;

    await NotificationDevice.updateMany(
        { expoPushToken: { $in: uniqueInvalidTokens } },
        { $set: { isActive: false, lastSeenAt: new Date() } }
    );
};

router.post('/notifications/register-device', authMiddleware, async (req, res) => {
    try {
        const organizationId = req.organizationId;
        const platform = normalizePlatform(req.body?.platform);
        const expoPushToken = normalizeToken(req.body?.expoPushToken);

        console.log('[notifications/register-device] request', {
            organizationId: organizationId?.toString?.(),
            platform,
            hasToken: !!expoPushToken,
            tokenPreview: expoPushToken ? `${expoPushToken.slice(0, 20)}...` : null
        });

        if (!platform || !expoPushToken) {
            return res.status(400).json({ message: 'platform and expoPushToken are required' });
        }

        if (!['android', 'ios'].includes(platform)) {
            return res.status(400).json({ message: 'platform must be android or ios' });
        }

        if (!Expo.isExpoPushToken(expoPushToken)) {
            return res.status(400).json({ message: 'Invalid Expo push token' });
        }

        const device = await NotificationDevice.findOneAndUpdate(
            { organizationId, expoPushToken },
            {
                $set: {
                    organizationId,
                    platform,
                    expoPushToken,
                    isActive: true,
                    lastSeenAt: new Date()
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log('[notifications/register-device] success', {
            organizationId: organizationId?.toString?.(),
            deviceId: device?._id?.toString?.()
        });

        return res.json({ message: 'Device registered', data: device });
    } catch (error) {
        console.error('[notifications/register-device] failed', error);
        return res.status(500).json({ message: 'Failed to register device', error: error.message });
    }
});

router.delete('/notifications/register-device', authMiddleware, async (req, res) => {
    try {
        const organizationId = req.organizationId;
        const expoPushToken = normalizeToken(req.body?.expoPushToken);

        if (!expoPushToken) {
            return res.status(400).json({ message: 'expoPushToken is required' });
        }

        await NotificationDevice.findOneAndUpdate(
            { organizationId, expoPushToken },
            { isActive: false, lastSeenAt: new Date() }
        );

        return res.json({ message: 'Device unregistered' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to unregister device', error: error.message });
    }
});

router.post('/notifications/test', authMiddleware, async (req, res) => {
    try {
        const organizationId = req.organizationId;
        const devices = await NotificationDevice.find({ organizationId, isActive: true }).lean();

        if (!devices.length) {
            return res.status(404).json({ message: 'No active device found' });
        }

        const messages = devices
            .filter((d) => Expo.isExpoPushToken(d.expoPushToken))
            .map((d) => ({
                to: d.expoPushToken,
                sound: 'default',
                title: 'Test reminder',
                body: 'Background notification is working.',
                data: { type: 'test' }
            }));

        if (!messages.length) {
            return res.status(400).json({ message: 'No valid Expo token found for active devices' });
        }

        const chunks = expo.chunkPushNotifications(messages);
        const tickets = [];
        for (const chunk of chunks) {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
        }

        await markInvalidTokensInactiveFromTickets(messages, tickets);

        return res.json({ message: 'Test notification sent', count: messages.length });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to send test notification', error: error.message });
    }
});

module.exports = router;