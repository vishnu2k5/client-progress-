const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Progress = require('../progressSchma');
const Client = require('../clientSchma');
const authMiddleware = require('../middleware/authMiddleware');

// GET /progress - Get progress for logged-in organization (optionally filter by clientId)
router.get('/progress', authMiddleware, async (req, res) => {
    const { clientId } = req.query;
    try {
        let progress;
        
        if (clientId) {
            // Verify client belongs to this organization
            const client = await Client.findOne({ 
                _id: clientId, 
                organizationId: req.organizationId 
            }).lean();
            
            if (!client) {
                return res.status(404).json({ message: "Client not found" });
            }
            
            progress = await Progress.find({ clientId }).populate({
                path: 'clientId',
                select: 'clientName organizationId',
                populate: {
                    path: 'organizationId',
                    select: 'organizationName'
                }
            }).lean();
        } else {
            // Optimized: Use aggregation to get progress in a single query
            progress = await Progress.aggregate([
                {
                    $lookup: {
                        from: 'clients',
                        localField: 'clientId',
                        foreignField: '_id',
                        as: 'clientData'
                    }
                },
                { $unwind: '$clientData' },
                {
                    $match: {
                        'clientData.organizationId': new mongoose.Types.ObjectId(req.organizationId)
                    }
                },
                {
                    $lookup: {
                        from: 'organizations',
                        localField: 'clientData.organizationId',
                        foreignField: '_id',
                        as: 'orgData'
                    }
                },
                { $unwind: '$orgData' },
                {
                    $project: {
                        _id: 1,
                        Lead: 1,
                        firstContact: 1,
                        followUp: 1,
                        RFQ: 1,
                        quote: 1,
                        quoteFollowUp: 1,
                        order: 1,
                        delivered: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        clientId: {
                            _id: '$clientData._id',
                            clientName: '$clientData.clientName',
                            organizationId: {
                                _id: '$orgData._id',
                                organizationName: '$orgData.organizationName'
                            }
                        }
                    }
                }
            ]);
        }
        
        res.json(progress);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// PUT /update/progress - Update progress by clientId (only if client belongs to org)
router.put('/update/progress', authMiddleware, async (req, res) => {
    const { clientId } = req.query;

    if (!clientId) {
        return res.status(400).json({ message: "clientId query parameter is required" });
    }

    try {
        // Verify client belongs to this organization
        const client = await Client.findOne({ 
            _id: clientId, 
            organizationId: req.organizationId 
        }).lean();
        
        if (!client) {
            return res.status(404).json({ message: "Client not found" });
        }

        const updated = await Progress.findOneAndUpdate(
            { clientId: new mongoose.Types.ObjectId(clientId) },
            { $set: req.body },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ message: "Progress record not found" });
        }

        res.json(updated);

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
