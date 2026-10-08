const express = require('express');
const Docker = require('dockerode');
const path = require('path');

const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const PORT = process.env.PORT || 8585;

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API: Get all containers with advanced details
app.get('/api/containers', async (req, res) => {
    try {
        const containers = await docker.listContainers({ all: true });
        const data = containers.map(c => {
            const name = c.Names[0].replace('/', '');
            // Extract Docker Compose Project Name
            const composeProject = c.Labels['com.docker.compose.project'] || 'Standalone';
            // Extract Network Info
            const networks = Object.keys(c.NetworkSettings.Networks).join(', ');
            
            let ports = [];
            if (c.Ports) {
                ports = c.Ports.filter(p => p.PublicPort).map(p => ({
                    public: p.PublicPort,
                    private: p.PrivatePort,
                    type: p.Type
                }));
            }

            return { 
                id: c.Id,
                name, 
                state: c.State, 
                status: c.Status, // Contains Uptime (e.g., "Up 2 hours")
                composeProject,
                networks,
                ports,
                image: c.Image
            };
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Get live CPU/RAM stats for a specific container
app.get('/api/stats/:id', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        const stats = await container.stats({ stream: false });
        
        // Calculate CPU Percentage
        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const cpus = stats.cpu_stats.online_cpus || 1;
        let cpuPercent = 0.0;
        if (systemDelta > 0 && cpuDelta > 0) {
            cpuPercent = (cpuDelta / systemDelta) * cpus * 100.0;
        }

        // Calculate RAM Percentage & Usage
        const usedMemory = stats.memory_stats.usage - (stats.memory_stats.stats?.cache || 0);
        const limitMemory = stats.memory_stats.limit;
        const ramPercent = limitMemory ? (usedMemory / limitMemory) * 100.0 : 0;
        const ramMB = (usedMemory / 1024 / 1024).toFixed(2);
        const limitMB = limitMemory ? (limitMemory / 1024 / 1024).toFixed(2) : 0;

        res.json({
            cpu: cpuPercent.toFixed(2),
            ramPercent: ramPercent.toFixed(2),
            ramUsage: `${ramMB} MB / ${limitMB} MB`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Container Actions (Start, Stop, Restart)
app.post('/api/action/:id/:action', async (req, res) => {
    try {
        const { id, action } = req.params;
        const container = docker.getContainer(id);
        
        if (action === 'start') await container.start();
        else if (action === 'stop') await container.stop();
        else if (action === 'restart') await container.restart();
        else return res.status(400).json({ error: "Invalid action" });

        res.json({ success: true, message: `Container ${action}ed successfully` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Ultimate Port Viewer API running on port ${PORT}`);
});
