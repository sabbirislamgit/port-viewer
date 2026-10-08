const express = require('express');
const Docker = require('dockerode');

const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const PORT = process.env.PORT || 8585;

app.get('/', async (req, res) => {
    try {
        const containers = await docker.listContainers();
        let html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Port Viewer</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #121212; color: #ffffff; padding: 30px; }
                h1 { text-align: center; color: #00d2ff; font-weight: 300; margin-bottom: 30px; }
                table { width: 100%; border-collapse: collapse; background-color: #1e1e1e; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
                th, td { padding: 15px 20px; text-align: left; border-bottom: 1px solid #2c2c2c; }
                th { background-color: #252525; color: #00d2ff; text-transform: uppercase; font-size: 14px; letter-spacing: 1px; }
                tr:hover { background-color: #2a2a2a; }
                .status-running { color: #4CAF50; font-weight: bold; }
                .status-stopped { color: #f44336; font-weight: bold; }
                .port-badge { background-color: #00d2ff; color: #000; padding: 5px 10px; border-radius: 6px; font-weight: bold; margin-right: 8px; display: inline-block; font-size: 13px; margin-bottom: 4px; }
            </style>
        </head>
        <body>
            <h1>🐳 CasaOS Port Viewer</h1>
            <table>
                <thead>
                    <tr>
                        <th>Container Name</th>
                        <th>State</th>
                        <th>Mapped Ports (Public &rarr; Private)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        containers.forEach(container => {
            const name = container.Names[0].replace('/', '');
            const state = container.State;
            let portsHtml = '';
            
            if (container.Ports && container.Ports.length > 0) {
                container.Ports.forEach(p => {
                    if (p.PublicPort) {
                        portsHtml += `<span class="port-badge">${p.PublicPort} &rarr; ${p.PrivatePort}/${p.Type}</span>`;
                    }
                });
            }

            if (!portsHtml) portsHtml = '<span style="color:#777;">No public ports mapped</span>';

            html += `
                <tr>
                    <td><strong>${name}</strong></td>
                    <td class="${state === 'running' ? 'status-running' : 'status-stopped'}">${state}</td>
                    <td>${portsHtml}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        </body>
        </html>
        `;

        res.send(html);
    } catch (error) {
        res.status(500).send(`<h2 style="color:red; text-align:center;">Error reading Docker socket. Make sure it's mounted correctly!</h2><p style="text-align:center;">${error.message}</p>`);
    }
});

app.listen(PORT, () => {
    console.log(`Port Viewer running on port ${PORT}`);
});
