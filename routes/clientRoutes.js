const express = require('express');
const router = express.Router();
const Client = require('../clientSchma');
const Progress = require('../progressSchma');
const authMiddleware = require('../middleware/authMiddleware');

// GET /clients - Get all clients for the logged-in organization
router.get('/clients', authMiddleware, async (req, res) => {
    try {
        const clients = await Client.find({ organizationId: req.organizationId })
            .populate('organizationId', 'organizationName')
            .lean();
        res.json(clients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET /clients/:id - Get single client by ID (only if belongs to org)
router.get('/clients/:id', authMiddleware, async (req, res) => {
    try {
        const client = await Client.findOne({ 
            _id: req.params.id, 
            organizationId: req.organizationId 
        }).populate('organizationId', 'organizationName').lean();
        
        if (!client) {
            return res.status(404).json({ message: "Client not found" });
        }
        res.json(client);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST /add/clients - Add new client with progress (uses logged-in org)
router.post('/add/clients', authMiddleware, async (req, res) => {
    const { clientName } = req.body;
    const normalizedClientName = typeof clientName === 'string' ? clientName.trim() : '';

    if (!normalizedClientName) {
        return res.status(400).json({ message: "Client name is required" });
    }

    try {
        // create client with logged-in organization's ID
        const newClient = new Client({ 
            clientName: normalizedClientName,
            organizationId: req.organizationId 
        });
        const savedClient = await newClient.save();

        let newProgress;
        try {
            // create progress with only clientId
            newProgress = new Progress({
                clientId: savedClient._id
            });

            await newProgress.save();
        } catch (progressError) {
            // Keep data consistent if progress creation fails.
            await Client.findByIdAndDelete(savedClient._id);
            throw progressError;
        }

        res.status(201).json({
            client: savedClient,
            progress: newProgress,
            message: "Client and Progress created successfully"
        });

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// PUT /update/client/:id - Update client (only if belongs to org)
router.put('/update/client/:id', authMiddleware, async (req, res) => {
    try {
        const normalizedClientName = typeof req.body.clientName === 'string' ? req.body.clientName.trim() : '';
        if (!normalizedClientName) {
            return res.status(400).json({ message: "Client name is required" });
        }

        // Single atomic operation: find by id + org and update
        const updated = await Client.findOneAndUpdate(
            { _id: req.params.id, organizationId: req.organizationId },
            { $set: { clientName: normalizedClientName } },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ message: "Client not found" });
        }

        res.json({
            client: updated,
            message: "Client updated successfully"
        });

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE /delete/client/:id - Delete client and its progress (only if belongs to org)
router.delete('/delete/client/:id', authMiddleware, async (req, res) => {
    try {
        // Single atomic operation: find by id + org and delete
        const deleted = await Client.findOneAndDelete({ 
            _id: req.params.id, 
            organizationId: req.organizationId 
        });
        
        if (!deleted) {
            return res.status(404).json({ message: "Client not found" });
        }

        // Delete associated progress
        await Progress.deleteMany({ clientId: req.params.id });

        res.json({ message: "Client and associated progress deleted successfully" });

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
