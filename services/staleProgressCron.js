const cron = require('node-cron');
const { Expo } = require('expo-server-sdk');
const NotificationDevice = require('../notificationDeviceSchema');
const NotificationLog = require('../notificationLogSchema');
const Progress = require('../progressSchma');

const expo = new Expo();
const MIN_DAYS_FOR_REMINDER = 2;
const stages = ['Lead', 'firstContact', 'followUp', 'RFQ', 'quote', 'quoteFollowUp', 'order'];
const SEND_HOURS = new Set([9, 11, 13, 15, 17]);

function toTs(value) {
    if (!value) return null;
    const d = new Date(value);
    const ts = d.getTime();
    return Number.isNaN(ts) ? null : ts;
}

function fromStageDate(value) {
    if (!value || typeof value !== 'string') return null;
    const normalized = value.replace(/\//g, '-');
    return toTs(normalized);
}

function getLastUpdateInfo(progressData) {
    const timestamps = [];

    for (const stage of stages) {
        const stageData = progressData?.[stage];
        if (!stageData || typeof stageData !== 'object') continue;

        const updatedAtTs = toTs(stageData.updatedAt);
        const dateTs = fromStageDate(stageData.date);

        if (updatedAtTs) timestamps.push(updatedAtTs);
        if (dateTs) timestamps.push(dateTs);
    }

    const docUpdatedAtTs = toTs(progressData?.updatedAt);
    const docCreatedAtTs = toTs(progressData?.createdAt);
    if (docUpdatedAtTs) timestamps.push(docUpdatedAtTs);
    if (docCreatedAtTs) timestamps.push(docCreatedAtTs);

    if (!timestamps.length) return { daysAgo: Infinity, isOverdue: true };

    const lastTs = Math.max(...timestamps);
    const daysAgo = Math.max(0, Math.floor((Date.now() - lastTs) / (1000 * 60 * 60 * 24)));

    return {
        daysAgo,
        isOverdue: daysAgo >= MIN_DAYS_FOR_REMINDER
    };
}

function slotKeyLocal(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    return `${y}-${m}-${d}:${h}`;
}

async function markInvalidTokensInactiveFromTickets(messages, tickets) {
    const invalidTokens = [];

    for (let i = 0; i < tickets.length; i += 1) {
        const ticket = tickets[i];
        if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(messages[i]?.to);
        }
    }

    const validInvalidTokens = [...new Set(invalidTokens.filter(Boolean))];
    if (!validInvalidTokens.length) return;

    await NotificationDevice.updateMany(
        { expoPushToken: { $in: validInvalidTokens } },
        { $set: { isActive: false, lastSeenAt: new Date() } }
    );
}

async function sendStaleProgressNotifications(now = new Date()) {
    if (!SEND_HOURS.has(now.getHours())) {
        return;
    }

    const progresses = await Progress.find({ delivered: { $ne: true } })
        .populate('clientId', 'clientName organizationId')
        .lean();

    const groupedByOrg = new Map();

    for (const progress of progresses) {
        const orgId = progress?.clientId?.organizationId?.toString();
        const clientId = progress?.clientId?._id?.toString();
        if (!orgId || !clientId) continue;

        const { isOverdue, daysAgo } = getLastUpdateInfo(progress);
        if (!isOverdue) continue;

        if (!groupedByOrg.has(orgId)) groupedByOrg.set(orgId, []);
        groupedByOrg.get(orgId).push({
            clientId,
            clientName: progress.clientId.clientName,
            daysAgo
        });
    }

    for (const [orgId, staleClients] of groupedByOrg.entries()) {
        const activeDevices = await NotificationDevice.find({ organizationId: orgId, isActive: true }).lean();
        if (!activeDevices.length) continue;

        const slotKey = slotKeyLocal(now);
        const dedupeKeys = staleClients.map(
            (client) => `${orgId}:${client.clientId}:stale_progress:${slotKey}`
        );

        const existingLogs = await NotificationLog.find({ dedupeKey: { $in: dedupeKeys } })
            .select('dedupeKey')
            .lean();
        const existingKeySet = new Set(existingLogs.map((log) => log.dedupeKey));

        for (const client of staleClients) {
            const dedupeKey = `${orgId}:${client.clientId}:stale_progress:${slotKey}`;
            if (existingKeySet.has(dedupeKey)) continue;

            const messages = activeDevices
                .filter((device) => Expo.isExpoPushToken(device.expoPushToken))
                .map((device) => ({
                    to: device.expoPushToken,
                    sound: 'default',
                    title: 'Progress reminder',
                    body: `${client.clientName} has not been updated for ${client.daysAgo} day(s).`,
                    data: {
                        type: 'stale_progress',
                        clientId: client.clientId
                    }
                }));

            if (!messages.length) continue;

            const chunks = expo.chunkPushNotifications(messages);
            const tickets = [];
            for (const chunk of chunks) {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            }

            await markInvalidTokensInactiveFromTickets(messages, tickets);

            await NotificationLog.create({
                organizationId: orgId,
                clientId: client.clientId,
                type: 'stale_progress',
                dedupeKey,
                sentAt: new Date()
            });

            existingKeySet.add(dedupeKey);
        }
    }
}

function startStaleProgressCron() {
    // 5 reminders/day at 09:00, 11:00, 13:00, 15:00, 17:00.
    cron.schedule('0 9,11,13,15,17 * * *', async () => {
        try {
            await sendStaleProgressNotifications();
            console.log('[stale-progress-cron] run completed');
        } catch (error) {
            console.error('[stale-progress-cron] run failed', error);
        }
    });
}

module.exports = { startStaleProgressCron, sendStaleProgressNotifications };