const jwt = require('jsonwebtoken');
const Organization = require('../organizationSchema');

const authMiddleware = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: "No token provided, authorization denied" });
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

        // Get organization from token
        const organization = await Organization.findById(decoded.organizationId).select('-password');
        
        if (!organization) {
            return res.status(401).json({ message: "Organization not found" });
        }

        if (!organization.isActive) {
            return res.status(401).json({ message: "Organization is deactivated" });
        }

        // Add organization to request
        req.organization = organization;
        req.organizationId = organization._id;

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: "Invalid token" });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: "Token expired" });
        }
        res.status(500).json({ message: error.message });
    }
};

module.exports = authMiddleware;
