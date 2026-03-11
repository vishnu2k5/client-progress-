const express = require('express');
const router = express.Router();
const Organization = require('../organizationSchema');

// GET /organizations - Get all organizations (public, excludes sensitive data)
router.get('/organizations', async (req, res) => {
    try {
        const organizations = await Organization.find({ isActive: true })
            .select('-password')
            .lean();
        res.json(organizations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET /organizations/:id - Get organization by ID (public, excludes sensitive data)
router.get('/organizations/:id', async (req, res) => {
    try {
        const organization = await Organization.findById(req.params.id)
            .select('-password')
            .lean();
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }
        res.json(organization);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Note: Use POST /auth/register to create new organizations
// Note: Use PUT /auth/update to update organization profile (protected)
// Note: Use DELETE is removed - deactivation should be admin-only

module.exports = router;
