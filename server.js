const express = require('express');
const Docker = require('dockerode');

const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const PORT = process.env.PORT || 8585;

// নতুন API সিস্টেম তৈরি করা হলো
app.get('/api/containers', async (req, res) => {
    try {
        const containers = await docker.listContainers({ all: true });
        const data = containers.map(c => {
            const name = c.Names[0].replace('/', '');
            const state = c.State;
            let ports = [];
            if (c.Ports) {
                ports = c.Ports.filter(p => p.PublicPort).map(p => ({
                    public: p.PublicPort,
                    private: p.PrivatePort,
                    type: p.Type
                }));
            }
            return { name, state, ports };
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// মডার্ন ফ্রন্টএন্ড UI
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Port Viewer Pro</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            body { background-color: #0f172a; color: #e2e8f0; font-family: 'Segoe UI', system-ui, sans-serif; }
            .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
        </style>
    </head>
    <body class="p-4 md:p-10 min-h-screen">
        <div class="max-w-6xl mx-auto">
            
            <!-- Header & Search -->
            <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-5">
                <h1 class="text-3xl font-bold text-sky-400 flex items-center gap-3">
                    <i class="fa-brands fa-docker text-4xl"></i> Port Viewer <span class="text-xs bg-sky-500/20 text-sky-300 px-2 py-1 rounded-md ml-2 border border-sky-500/30">PRO</span>
                </h1>
                <div class="relative w-full md:w-80">
                    <i class="fa-solid fa-search absolute left-4 top-3.5 text-slate-400"></i>
                    <input type="text" id="searchInput" placeholder="Search apps..." class="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all shadow-inner">
                </div>
            </div>

            <!-- Table Container -->
            <div class="glass rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-slate-900/60 text-slate-300 text-sm uppercase tracking-wider">
                                <th class="p-5 font-semibold">App Name</th>
                                <th class="p-5 font-semibold">Status</th>
                                <th class="p-5 font-semibold">Mapped Ports</th>
                            </tr>
                        </thead>
                        <tbody id="tableBody" class="divide-y divide-slate-700/50">
                            <tr><td colspan="3" class="p-10 text-center text-slate-400"><i class="fa-solid fa-circle-notch fa-spin text-3xl mb-3 text-sky-500"></i><br>Loading your apps...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="text-center mt-8 flex items-center justify-center gap-2 text-slate-500 text-sm">
                <span class="relative flex h-2 w-2"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
                Live Auto-refreshing • Docker API
            </div>
        </div>

        <script>
            let allContainers = [];

            async function fetchContainers() {
                try {
                    const response = await fetch('/api/containers');
                    allContainers = await response.json();
                    renderTable();
                } catch (error) {
                    console.error("Error fetching data:", error);
                }
            }

            function renderTable() {
                const searchTerm = document.getElementById('searchInput').value.toLowerCase();
                const tbody = document.getElementById('tableBody');
                
                const filtered = allContainers.filter(c => c.name.toLowerCase().includes(searchTerm));
                
                if(filtered.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="3" class="p-10 text-center text-slate-400"><i class="fa-regular fa-folder-open text-4xl mb-3"></i><br>No matching apps found</td></tr>';
                    return;
                }

                tbody.innerHTML = filtered.map(c => {
                    const isRunning = c.state === 'running';
                    const statusIcon = isRunning 
                        ? '<span class="relative flex h-3 w-3 mr-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>' 
                        : '<span class="inline-flex rounded-full h-3 w-3 bg-red-500 mr-3"></span>';
                    
                    let portsHtml = c.ports.map(p => 
                        '<span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 mr-2 mb-2 hover:bg-sky-500/20 transition-all cursor-default shadow-sm">' +
                            '<i class="fa-solid fa-network-wired text-xs opacity-70"></i> <b class="text-sky-300">' + p.public + '</b> ' + 
                            '<i class="fa-solid fa-arrow-right text-[10px] opacity-40"></i> ' + p.private + '/' + p.type +
                        '</span>'
                    ).join('');

                    if (!portsHtml) portsHtml = '<span class="text-slate-600 text-sm flex items-center gap-2"><i class="fa-solid fa-link-slash"></i> No external ports</span>';

                    return '<tr class="hover:bg-slate-800/40 transition-colors group">' +
                                '<td class="p-5 font-bold text-slate-200 text-base group-hover:text-sky-300 transition-colors">' + c.name + '</td>' +
                                '<td class="p-5 flex items-center capitalize font-medium ' + (isRunning ? "text-emerald-400" : "text-red-400") + '">' + statusIcon + c.state + '</td>' +
                                '<td class="p-5">' + portsHtml + '</td>' +
                            '</tr>';
                }).join('');
            }

            document.getElementById('searchInput').addEventListener('input', renderTable);
            
            // প্রথমবার লোড হওয়া এবং প্রতি ৫ সেকেন্ডে লাইভ আপডেট
            fetchContainers();
            setInterval(fetchContainers, 5000);
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, () => {
    console.log("Modern Port Viewer running on port " + PORT);
});
