const axios = require('axios');
const { sendAlertEmail } = require('./email');
require('dotenv').config();

const API_BASE_URL = 'https://developers.hostinger.com/api/vps/v1';

// Global map to store which token belongs to which VPS ID
// format: vpsId (string) -> { token: string, name: string }
const vpsOwnerMap = new Map();

const parseTokens = () => {
    const raw = process.env.HOSTINGER_API_TOKEN || '';
    const tokens = [];

    // Check for new format: [Name=Token],[Name2=Token2]
    // Regex: \[([^=]+)=([^\]]+)\]
    const matches = raw.matchAll(/\[([^=]+)=([^\]]+)\]/g);
    let found = false;
    for (const match of matches) {
        found = true;
        tokens.push({ name: match[1], token: match[2] });
    }

    // Fallback for single token (old format)
    if (!found && raw.trim().length > 0) {
        tokens.push({ name: 'Default', token: raw.trim() });
    }

    return tokens;
};

const getTokenForVps = (vpsId) => {
    // Try to find the exact token for this VPS
    const owner = vpsOwnerMap.get(parseInt(vpsId)) || vpsOwnerMap.get(String(vpsId));
    if (owner) return owner.token;

    // Fallback: use the first available token
    const tokens = parseTokens();
    if (tokens.length > 0) return tokens[0].token;

    return '';
};

const transformData = (apiData, specs) => {
    if (!apiData) return [];

    // Collect all unique timestamps from all metrics
    const timestamps = new Set();
    const metricsMap = {
        cpu: apiData.cpu_usage?.usage || {},
        ram: apiData.ram_usage?.usage || {},
        disk: apiData.disk_space?.usage || {},
        netIn: apiData.incoming_traffic?.usage || {},
        netOut: apiData.outgoing_traffic?.usage || {}
    };

    Object.values(metricsMap).forEach(usageObj => {
        if (usageObj) {
            Object.keys(usageObj).forEach(ts => timestamps.add(ts));
        }
    });

    const sortedTimestamps = Array.from(timestamps).sort((a, b) => parseInt(a) - parseInt(b));
    const ramTotalBytes = specs ? specs.ram_mb * 1024 * 1024 : 0;
    const diskTotalBytes = specs ? specs.disk_gb * 1024 * 1024 * 1024 : 0;

    return sortedTimestamps.map(ts => {
        const date = new Date(parseInt(ts) * 1000);
        // Format HH:MM in Asia/Kolkata timezone
        const timeStr = date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Kolkata'
        });

        // RAM/Disk in bytes
        const ramBytes = metricsMap.ram[ts] || 0;
        const diskBytes = metricsMap.disk[ts] || 0;
        const netOutBytes = metricsMap.netOut[ts] || 0;

        let ramPercent = 0;
        if (ramTotalBytes > 0) {
            ramPercent = (ramBytes / ramTotalBytes) * 100;
        }

        let diskPercent = 0;
        if (diskTotalBytes > 0) {
            diskPercent = (diskBytes / diskTotalBytes) * 100;
        }

        return {
            time: timeStr,
            fullDate: date.toISOString(),
            cpu: metricsMap.cpu[ts] || 0,
            ram: parseFloat(ramPercent.toFixed(1)),
            disk: parseFloat(diskPercent.toFixed(1)),
            ramGB: parseFloat((ramBytes / (1024 * 1024 * 1024)).toFixed(2)),
            diskGB: parseFloat((diskBytes / (1024 * 1024 * 1024)).toFixed(2)),
            net: parseFloat((netOutBytes / (1024 * 1024)).toFixed(2)) // MB
        };
    });
};

const getMetrics = async (vpsId, dateFrom, dateTo) => {
    try {
        const token = getTokenForVps(vpsId);
        const response = await axios.get(`${API_BASE_URL}/virtual-machines/${vpsId}/metrics`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            params: {
                date_from: dateFrom,
                date_to: dateTo
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching metrics:', error.response ? error.response.data : error.message);
        throw error;
    }
};

// Cache for VPS specifications
const vpsSpecsCache = new Map();

const getVPSSpecs = async (vpsId) => {
    // Return cached specs if available
    if (vpsSpecsCache.has(vpsId)) {
        return vpsSpecsCache.get(vpsId);
    }

    try {
        const token = getTokenForVps(vpsId);
        const response = await axios.get(`${API_BASE_URL}/virtual-machines/${vpsId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const owner = vpsOwnerMap.get(parseInt(vpsId)) || vpsOwnerMap.get(String(vpsId));
        const accountName = owner ? owner.name : 'Default';

        const specs = {
            id: vpsId,
            account_name: accountName,
            ram_mb: response.data.memory || 0,  // API returns 'memory' in MB
            disk_gb: response.data.disk ? (response.data.disk / 1024).toFixed(0) : 0,  // API returns 'disk' in MB, convert to GB
            cpu_cores: response.data.cpus || 0,  // API returns 'cpus'
            hostname: response.data.hostname || 'Unknown',
            state: response.data.state || 'Unknown',
            plan: response.data.plan || 'Unknown',
            bandwidth: response.data.bandwidth || 0
        };

        // Cache the specs
        vpsSpecsCache.set(vpsId, specs);
        console.log(`Cached specs for VPS ${vpsId}:`, specs);

        return specs;
    } catch (error) {
        console.error(`Error fetching VPS specs for ${vpsId}:`, error.response ? error.response.data : error.message);
        throw error;
    }
};

const fetchVPSListFromAPI = async () => {
    const tokens = parseTokens();
    const allVpsIds = [];

    console.log(`Checking ${tokens.length} Hostinger accounts for VPS instances...`);

    for (const { name, token } of tokens) {
        try {
            const response = await axios.get(`${API_BASE_URL}/virtual-machines`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            let ids = [];
            if (response.data && response.data.data) {
                ids = response.data.data.map(vm => vm.id);
            } else if (Array.isArray(response.data)) {
                ids = response.data.map(vm => vm.id);
            }

            console.log(`Account [${name}] found ${ids.length} VPS: ${ids.join(', ')}`);

            ids.forEach(id => {
                // Store mapping for later use
                vpsOwnerMap.set(id, { token, name });
                vpsOwnerMap.set(String(id), { token, name }); // Store as string too for safety
                allVpsIds.push(id);
            });

        } catch (error) {
            console.error(`Failed to fetch VPS list for account [${name}]:`, error.message);
        }
    }

    // Remove duplicates if any
    return [...new Set(allVpsIds)];
};

const initializeVPSSpecs = async () => {
    console.log('Initializing VPS specifications...');
    const vpsIds = await fetchVPSListFromAPI();

    if (vpsIds.length === 0) {
        console.log('No VPS IDs discovered from API or Config.');
        return;
    }

    console.log(`Discovered ${vpsIds.length} VPS instances to monitor: ${vpsIds.join(', ')}`);

    for (const vpsId of vpsIds) {
        try {
            await getVPSSpecs(vpsId);
            console.log(`Successfully initialized specs for VPS ${vpsId}`);
        } catch (error) {
            console.error(`Failed to initialize specs for VPS ${vpsId}:`, error.message);
        }
    }
    return vpsIds;
};

const checkAndAlert = async () => {
    console.log('Running health check...');
    // Always fetch latest list in case new VPS created
    const vpsIds = await fetchVPSListFromAPI();

    if (vpsIds.length === 0) {
        console.log('No VPS IDs configured.');
        return;
    }

    // Get thresholds from environment variables
    const cpuThreshold = parseInt(process.env.CPU_THRESHOLD || '80');
    const ramThreshold = parseInt(process.env.RAM_THRESHOLD || '80');
    const diskThreshold = parseInt(process.env.DISK_THRESHOLD || '85');
    const checkIntervalRaw = process.env.CHECK_INTERVAL_MINUTES || '15';
    let lookbackMinutes = 15;

    if (checkIntervalRaw.includes(',')) {
        // Calculate max gap for array inputs like "15,45"
        const minutes = checkIntervalRaw.split(',').map(m => parseInt(m.trim())).sort((a, b) => a - b);
        if (minutes.length > 0) {
            let maxGap = 0;
            for (let i = 0; i < minutes.length - 1; i++) {
                maxGap = Math.max(maxGap, minutes[i + 1] - minutes[i]);
            }
            // Gap between last of this hour and first of next hour
            maxGap = Math.max(maxGap, (60 - minutes[minutes.length - 1]) + minutes[0]);
            lookbackMinutes = maxGap;
        }
    } else {
        lookbackMinutes = parseInt(checkIntervalRaw);
    }

    const now = new Date();
    // Fetch a wider window (180m) to ensure data availability, as requested by user
    const fetchWindowMinutes = 180;
    const past = new Date(now.getTime() - fetchWindowMinutes * 60 * 1000);

    const dateFrom = past.toISOString().split('.')[0] + 'Z';
    const dateTo = now.toISOString().split('.')[0] + 'Z';

    // We only want to alert on spikes that occurred within the check interval
    // to avoid re-alerting on old spikes.
    // Timestamps from API are in seconds.

    for (const vpsId of vpsIds) {
        try {
            // Get thresholds with optional per-VPS override
            // Example: CPU_THRESHOLD_1030000 overrides global CPU_THRESHOLD
            const cpuThreshold = parseInt(process.env[`CPU_THRESHOLD_${vpsId}`] || process.env.CPU_THRESHOLD || '80');
            const ramThreshold = parseInt(process.env[`RAM_THRESHOLD_${vpsId}`] || process.env.RAM_THRESHOLD || '80');
            const diskThreshold = parseInt(process.env[`DISK_THRESHOLD_${vpsId}`] || process.env.DISK_THRESHOLD || '85');

            // Get VPS specs to calculate percentages
            const specs = await getVPSSpecs(vpsId);
            const data = await getMetrics(vpsId, dateFrom, dateTo);

            // Find the latest timestamp in the data to anchor our check window
            // This handles cases where API data might be lagged (e.g. 10-15 mins behind real time)
            const getAllTimestamps = (metricObj) => {
                if (!metricObj || !metricObj.usage) return [];
                return Object.keys(metricObj.usage).map(ts => parseInt(ts));
            };

            const allTimestamps = [
                ...getAllTimestamps(data.cpu_usage),
                ...getAllTimestamps(data.ram_usage),
                ...getAllTimestamps(data.disk_space)
            ];

            if (allTimestamps.length === 0) {
                console.log(`VPS ${vpsId}: No data returned from API.`);
                continue;
            }

            const latestDataTimestamp = Math.max(...allTimestamps);
            // Anchor the check window to the latest data point, not 'now'
            const checkStartTimeSeconds = latestDataTimestamp - (lookbackMinutes * 60);

            const timeZone = process.env.TZ || 'Asia/Kolkata';
            // User requested to remove seconds (precision), e.g., "16/12/2025, 12:45"
            const formatTime = (ts) => new Date(ts * 1000).toLocaleString('en-GB', {
                timeZone,
                hour12: false,
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
            });

            console.log(`VPS ${vpsId}: Checking data window [${formatTime(checkStartTimeSeconds)} to ${formatTime(latestDataTimestamp)}] (Latest data ts: ${latestDataTimestamp})`);

            // Helper to get max value from proper usage object within the check interval
            const getMaxValue = (metricObj, minTimestamp) => {
                if (!metricObj || !metricObj.usage) return null;
                const entries = Object.entries(metricObj.usage);
                if (entries.length === 0) return null;

                // Filter for values newer than checkStartTimeSeconds
                const recentValues = entries
                    .filter(([ts, val]) => parseInt(ts) >= minTimestamp)
                    .map(([ts, val]) => val);

                if (recentValues.length === 0) return null;
                return Math.max(...recentValues);
            };

            const maxCpu = getMaxValue(data.cpu_usage, checkStartTimeSeconds);
            const maxRam = getMaxValue(data.ram_usage, checkStartTimeSeconds); // bytes
            const maxDisk = getMaxValue(data.disk_space, checkStartTimeSeconds); // bytes

            if (maxCpu !== null || maxRam !== null || maxDisk !== null) {
                const alerts = [];

                // Check CPU threshold
                if (maxCpu !== null) {
                    if (maxCpu > cpuThreshold) {
                        alerts.push(`CPU usage spiked to ${maxCpu}% (threshold: ${cpuThreshold}%)`);
                    }
                }

                // Check RAM threshold
                if (maxRam !== null && specs.ram_mb) {
                    // RAM is in bytes, specs.ram_mb is in MB
                    const ramUsageMb = maxRam / (1024 * 1024);
                    const ramPercent = (ramUsageMb / specs.ram_mb) * 100;

                    if (ramPercent > ramThreshold) {
                        alerts.push(`RAM usage spiked to ${ramPercent.toFixed(1)}% (threshold: ${ramThreshold}%)`);
                    }
                }

                // Check Disk threshold
                if (maxDisk !== null && specs.disk_gb) {
                    // Disk is in bytes, specs.disk_gb is in GB
                    const diskUsageGb = maxDisk / (1024 * 1024 * 1024);
                    const diskPercent = (diskUsageGb / specs.disk_gb) * 100;

                    if (diskPercent > diskThreshold) {
                        alerts.push(`Disk usage spiked to ${diskPercent.toFixed(1)}% (threshold: ${diskThreshold}%)`);
                    }
                }

                // Send alert if any threshold exceeded
                if (alerts.length > 0) {
                    const vpsLabel = `${specs.hostname} (${specs.plan})`;
                    const alertMessage = `VPS ${vpsLabel} Alert (Latest Data: ${formatTime(latestDataTimestamp)}):\n${alerts.join('\n')}`;
                    console.warn(alertMessage);

                    // Create HTML list items for the email template
                    const alertItemsHtml = alerts.map(alert => `<li>${alert}</li>`).join('');

                    await sendAlertEmail(`Resource Shield Alert - ${vpsLabel}`, alertMessage, {
                        vpsName: specs.hostname,
                        plan: specs.plan,
                        alertItems: alertItemsHtml,
                        latestDataTime: formatTime(latestDataTimestamp)
                    });
                } else {
                    console.log(`VPS ${vpsId}: Peak usage within normal range used: CPU:${maxCpu}% RAM:${maxRam} B Disk:${maxDisk} B`);
                }
            } else {
                console.log(`VPS ${vpsId}: No data points found in the last ${lookbackMinutes} minutes (fetched window: ${fetchWindowMinutes}m)`);
            }

            console.log(`Health check completed for ${vpsId}.`);
        } catch (error) {
            console.error(`Health check failed for ${vpsId}:`, error.message);
        }
    }

    // Calculate and log next run time
    const calcNow = new Date();
    const nextCheckTZ = process.env.TZ || 'Asia/Kolkata';

    console.log(`Calculating next check time based on config: "${checkIntervalRaw}" (TZ: ${nextCheckTZ})`);

    // Get current time components in the target timezone
    const formatParts = new Intl.DateTimeFormat('en-GB', {
        timeZone: nextCheckTZ,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    }).formatToParts(calcNow);

    const currentHour = parseInt(formatParts.find(p => p.type === 'hour').value);
    const currentMinute = parseInt(formatParts.find(p => p.type === 'minute').value);

    let minutesToAdd = 0;

    if (checkIntervalRaw.includes(',')) {
        const minutes = checkIntervalRaw.split(',').map(m => parseInt(m.trim())).sort((a, b) => a - b);

        // Find next minute in the current hour
        const nextMinute = minutes.find(m => m > currentMinute);

        if (nextMinute !== undefined) {
            minutesToAdd = nextMinute - currentMinute;
        } else {
            // No more checks this hour, wrap to first minute of next hour
            // Mins left in this hour + Mins from start of next hour
            minutesToAdd = (60 - currentMinute) + minutes[0];
        }
    } else {
        const interval = parseInt(checkIntervalRaw);
        // Calculate next slot: ceil((current + 1) / interval) * interval
        let nextMinute = Math.ceil((currentMinute + 0.1) / interval) * interval;

        if (nextMinute >= 60) {
            // Next hour
            // e.g. current=50, interval=15, next=60. Delta = 10.
            minutesToAdd = nextMinute - currentMinute;
        } else {
            minutesToAdd = nextMinute - currentMinute;
        }
    }

    const nextCheck = new Date(calcNow.getTime() + minutesToAdd * 60000);
    // Zero out seconds/ms for cleaner log, though mathematically it overlaps with execution time drift
    nextCheck.setSeconds(0);
    nextCheck.setMilliseconds(0);

    console.log(`Next check scheduled for: ${nextCheck.toLocaleString('en-GB', { timeZone: nextCheckTZ, hour12: false })}`);
};

const getAllVPSSpecs = async () => {
    const vpsIds = await fetchVPSListFromAPI();
    const allSpecs = [];

    for (const vpsId of vpsIds) {
        try {
            const specs = await getVPSSpecs(vpsId);
            allSpecs.push(specs);
        } catch (error) {
            console.error(`Failed to get specs for ${vpsId} in getAllVPSSpecs:`, error.message);
            // Fallback to basic object if fetch fails
            allSpecs.push({ id: vpsId, hostname: `VPS ${vpsId}`, plan: 'Unknown' });
        }
    }
    return allSpecs;
};

module.exports = { getMetrics, getVPSSpecs, initializeVPSSpecs, checkAndAlert, getAllVPSSpecs, transformData };
