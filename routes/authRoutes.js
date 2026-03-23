const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const Organization = require('../organizationSchema');
const authMiddleware = require('../middleware/authMiddleware');
const imagekit = require('../config/imagekit');

// Multer setup - store file in memory for ImageKit upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Wrapper to catch multer errors (file filter, size limit) gracefully
const handleUpload = (req, res, next) => {
    upload.single('logo')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Multer-specific error (e.g. file too large)
            return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Maximum size is 5MB' : err.message });
        }
        if (err) {
            // Other errors (e.g. fileFilter rejection)
            return res.status(400).json({ message: err.message });
        }
        next();
    });
};

// Generate JWT Token
const generateToken = (organizationId) => {
    return jwt.sign(
        { organizationId },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
    );
};

// POST /auth/register - Register new organization (with optional logo upload)
router.post('/auth/register', handleUpload, async (req, res) => {
    const { organizationName, email, password, phone, address } = req.body;
    const normalizedOrgName = typeof organizationName === 'string' ? organizationName.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    // Input validation
    if (!normalizedOrgName || !normalizedEmail || !password) {
        return res.status(400).json({ message: "Organization name, email, and password are required" });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ message: "Invalid email format" });
    }

    try {
        // Check if organization already exists (lowercase email for case-insensitive check)
        const existingOrg = await Organization.findOne({ 
            $or: [{ email: normalizedEmail }, { organizationName: normalizedOrgName }] 
        });
        
        if (existingOrg) {
            return res.status(400).json({ 
                message: existingOrg.email === normalizedEmail 
                    ? "Email already registered" 
                    : "Organization name already taken"
            });
        }

        // Upload logo to ImageKit if provided
        let logoUrl = null;
        if (req.file) {
            if (!imagekit) {
                return res.status(503).json({ message: 'Logo upload is unavailable. ImageKit is not configured.' });
            }

            try {
                const uploadResponse = await imagekit.upload({
                    file: req.file.buffer.toString('base64'),
                    fileName: `org-logo-${Date.now()}`,
                    folder: '/organization-logos'
                });
                logoUrl = uploadResponse.url;
            } catch (uploadErr) {
                console.error('ImageKit upload failed:', uploadErr.message);
            }
        }

        // Create new organization
        const newOrganization = new Organization({
            organizationName: normalizedOrgName,
            email: normalizedEmail,
            password,
            phone,
            address,
            logo: logoUrl
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
                address: savedOrganization.address,
                logo: savedOrganization.logo
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
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    // Input validation
    if (!normalizedEmail || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    try {
        // Find organization by email (lowercase for case-insensitive lookup)
        const organization = await Organization.findOne({ email: normalizedEmail });
        
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
                address: organization.address,
                logo: organization.logo
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

// PUT /auth/update - Update current organization profile (protected, with optional logo upload)
router.put('/auth/update', authMiddleware, handleUpload, async (req, res) => {
    const { organizationName, email, phone, address } = req.body;

    try {
        // Only include fields that are actually provided (avoid overwriting with undefined)
        const updateData = {};
        if (organizationName !== undefined) {
            const normalizedOrgName = typeof organizationName === 'string' ? organizationName.trim() : '';
            if (!normalizedOrgName) {
                return res.status(400).json({ message: "organizationName cannot be empty" });
            }

            const existingOrgByName = await Organization.findOne({
                _id: { $ne: req.organizationId },
                organizationName: normalizedOrgName
            }).lean();

            if (existingOrgByName) {
                return res.status(400).json({ message: "Organization name already taken" });
            }

            updateData.organizationName = normalizedOrgName;
        }
        if (email !== undefined) {
            const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
                return res.status(400).json({ message: "Invalid email format" });
            }

            const existingOrgByEmail = await Organization.findOne({
                _id: { $ne: req.organizationId },
                email: normalizedEmail
            }).lean();

            if (existingOrgByEmail) {
                return res.status(400).json({ message: "Email already registered" });
            }

            updateData.email = normalizedEmail;
        }
        if (phone !== undefined) updateData.phone = phone;
        if (address !== undefined) updateData.address = address;

        // Upload new logo to ImageKit if provided
        if (req.file) {
            if (!imagekit) {
                return res.status(503).json({ message: 'Logo upload is unavailable. ImageKit is not configured.' });
            }

            try {
                const uploadResponse = await imagekit.upload({
                    file: req.file.buffer.toString('base64'),
                    fileName: `org-logo-${Date.now()}`,
                    folder: '/organization-logos'
                });
                updateData.logo = uploadResponse.url;
            } catch (uploadErr) {
                console.error('ImageKit upload failed:', uploadErr.message);
            }
        }

        if (!Object.keys(updateData).length && !req.file) {
            return res.status(400).json({ message: "No valid fields to update" });
        }

        const updated = await Organization.findByIdAndUpdate(
            req.organizationId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-password');

        if (!updated) {
            return res.status(404).json({ message: "Organization not found" });
        }

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
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }
        
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
