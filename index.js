const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors")
const app = express();
const PORT = Number(process.env.PORT) || 3000;
require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);

require('dotenv').config();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors())

// Import Routes
const clientRoutes = require('./routes/clientRoutes');
const progressRoutes = require('./routes/progressRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { startStaleProgressCron } = require('./services/staleProgressCron');

// Use Routes
app.get('/', (req, res) => {
    res.json({ message: "Welcome to the API" });
});
app.use(authRoutes);
app.use(clientRoutes);
app.use(progressRoutes);
app.use(organizationRoutes);
app.use(notificationRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message });
    }
    if (err.name === 'CastError') {
        return res.status(400).json({ message: "Invalid ID format" });
    }
    if (err.code === 11000) {
        return res.status(400).json({ message: "Duplicate entry" });
    }
    
    res.status(err.status || 500).json({ 
        message: err.message || "Internal server error" 
    });
});

mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log("MongoDB Connected")
    startStaleProgressCron();
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`)
    })
})
.catch((err) => {
    console.error("MongoDB Connection Error:", err)
})
