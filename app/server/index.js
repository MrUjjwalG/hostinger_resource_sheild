const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { getMetrics, getVPSSpecs, initializeVPSSpecs, checkAndAlert } = require('./services/monitor');
const verifyToken = require('./middleware/auth');
const { sendAlertEmail } = require('./services/email');

const app = express();
app.use(cors());
app.use(express.json());

// Base path configuration for subpath deployment
const BASE_PATH = process.env.BASE_PATH || '/monitor';
const appRouter = express.Router();

// Serve React build static files under BASE_PATH
appRouter.use(express.static('../client/dist'));

// Auth Route
appRouter.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '12h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Config Route
appRouter.get('/api/config', verifyToken, async (req, res) => {
    // ... existing logic ...
    try {
        const { getAllVPSSpecs } = require('./services/monitor');
        const vpsList = await getAllVPSSpecs();
        res.json({
            vpsList,
            checkInterval: parseInt(process.env.CHECK_INTERVAL_MINUTES || '15')
        });
    } catch (error) {
        console.error('Failed to get VPS config:', error);
        // Fallback
        const envVpsIds = process.env.VPS_ID ? process.env.VPS_ID.split(',').map(id => id.trim()) : [];
        res.json({ vpsIds: envVpsIds });
    }
});

// VPS Specs Route
appRouter.get('/api/vps-specs', verifyToken, async (req, res) => {
    try {
        const { vpsId } = req.query;
        const envVpsIds = process.env.VPS_ID ? process.env.VPS_ID.split(',').map(id => id.trim()) : [];
        const targetVpsId = vpsId || envVpsIds[0];

        if (!targetVpsId) {
            return res.status(400).json({ error: 'No VPS ID provided or configured' });
        }

        const specs = await getVPSSpecs(targetVpsId);
        res.json(specs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch VPS specifications' });
    }
});

// Metrics Route
appRouter.get('/api/metrics', verifyToken, async (req, res) => {
    // Default to 180 minutes as per user request example if not specified
    const { timeRange = 180, vpsId } = req.query;

    // Use provided vpsId, or the first one from the list in env
    const envVpsIds = process.env.VPS_ID ? process.env.VPS_ID.split(',').map(id => id.trim()) : [];
    const targetVpsId = vpsId || envVpsIds[0];

    if (!targetVpsId) {
        return res.status(400).json({ error: 'No VPS ID configured or provided' });
    }

    const now = new Date();
    const past = new Date(now.getTime() - timeRange * 60 * 1000);

    // Format YYYY-MM-DDTHH:MM:SSZ
    const dateFrom = past.toISOString().split('.')[0] + 'Z';
    const dateTo = now.toISOString().split('.')[0] + 'Z';

    const { getMetrics, transformData, getVPSSpecs } = require('./services/monitor');

    try {
        const specs = await getVPSSpecs(targetVpsId);
        const rawData = await getMetrics(targetVpsId, dateFrom, dateTo);
        const formattedData = transformData(rawData, specs);
        // Wrap in { data: ... } as expected by frontend
        res.json({ data: formattedData });
    } catch (error) {
        console.error('Error fetching metrics:', error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

// SPA Fallback: Serve index.html for any unknown route within BASE_PATH
// This allows React Router to handle client-side routing (e.g., /monitor/dashboard)
const path = require('path');
appRouter.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/dist/index.html'));
});

// Mount the router
app.use(BASE_PATH, appRouter);

// Root redirect to BASE_PATH
app.get('/', (req, res) => {
    res.redirect(BASE_PATH);
});

// Setup cron job with configurable interval
const checkIntervalRaw = process.env.CHECK_INTERVAL_MINUTES || '15';
let cronExpression;

if (checkIntervalRaw.includes(',')) {
    cronExpression = `${checkIntervalRaw} * * * *`;
} else if (checkIntervalRaw === '60') {
    cronExpression = '0 * * * *';
} else {
    cronExpression = `*/${parseInt(checkIntervalRaw)} * * * *`;
}

console.log(`Setting up health check cron job: ${cronExpression} (Config: ${checkIntervalRaw})`);
cron.schedule(cronExpression, checkAndAlert, {
    timezone: process.env.TZ || 'Asia/Kolkata'
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Base Path: ${BASE_PATH}`);
    console.log(`Health checks configured as: ${checkIntervalRaw} (expression: ${cronExpression})`);
    console.log(`Thresholds: CPU=${process.env.CPU_THRESHOLD || 80}%, RAM=${process.env.RAM_THRESHOLD || 80}%, DISK=${process.env.DISK_THRESHOLD || 85}%`);
    // Initialize VPS specifications on startup
    await initializeVPSSpecs();
    // Run an initial check
    checkAndAlert();
});
