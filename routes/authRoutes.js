const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Organization = require('../organizationSchema');
const authMiddleware = require('../middleware/authMiddleware');

// Generate JWT Token
const generateToken = (organizationId) => {
    return jwt.sign(
        { organizationId },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
    );
};

// POST /auth/register - Register new organization
router.post('/auth/register', async (req, res) => {
    const { organizationName, email, password, phone, address } = req.body;

    // Input validation
    if (!organizationName || !email || !password) {
        return res.status(400).json({ message: "Organization name, email, and password are required" });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
    }

    try {
        // Check if organization already exists
        const existingOrg = await Organization.findOne({ 
            $or: [{ email }, { organizationName }] 
        });
        
        if (existingOrg) {
            return res.status(400).json({ 
                message: existingOrg.email === email 
                    ? "Email already registered" 
                    : "Organization name already taken"
            });
        }

        // Create new organization
        const newOrganization = new Organization({
            organizationName,
            email,
            password,
            phone,
            address
        });

        const savedOrganization = await newOrganization.save();

        // Generate token
        const token = generateToken(savedOrganization._id);

        res.status(201).json({
            message: "Organization registered successfully",
            organization: {
                _id: savedOrganization._id,
                organizationName: savedOrganization.organizationName,
                email: savedOrganization.email,
                phone: savedOrganization.phone,
                address: savedOrganization.address
            },
            token
        });

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// POST /auth/login - Login organization
router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    try {
        // Find organization by email
        const organization = await Organization.findOne({ email });
        
        if (!organization) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        if (!organization.isActive) {
            return res.status(401).json({ message: "Organization is deactivated" });
        }

        // Check password
        const isMatch = await organization.comparePassword(password);
        
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Generate token
        const token = generateToken(organization._id);

        res.json({
            message: "Login successful",
            organization: {
                _id: organization._id,
                organizationName: organization.organizationName,
                email: organization.email,
                phone: organization.phone,
                address: organization.address
            },
            token
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET /auth/me - Get current organization (protected)
router.get('/auth/me', authMiddleware, async (req, res) => {
    res.json({
        organization: req.organization
    });
});

// PUT /auth/update - Update current organization profile (protected)
router.put('/auth/update', authMiddleware, async (req, res) => {
    const { organizationName, phone, address } = req.body;

    try {
        const updated = await Organization.findByIdAndUpdate(
            req.organizationId,
            { $set: { organizationName, phone, address } },
            { new: true }
        ).select('-password');

        res.json({
            message: "Profile updated successfully",
            organization: updated
        });

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// PUT /auth/change-password - Change password (protected)
router.put('/auth/change-password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // Input validation
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    try {
        const organization = await Organization.findById(req.organizationId);
        
        // Verify current password
        const isMatch = await organization.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }

        // Update password
        organization.password = newPassword;
        await organization.save();

        res.json({ message: "Password changed successfully" });

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
