# 🌍 Atlas - Network Infrastructure Visualizer

**Atlas** is a containerized tool for scanning, parsing, and visualizing network infrastructure. It automatically collects data from sources like Docker and Nmap, and presents it as an interactive, filterable dashboard using modern web technologies.

---

## 🚀 Features

### ✅ Phase 1: Infrastructure Parsing
- Scans running Docker containers and extracts:
  - IP addresses  
  - MAC addresses  
  - Open ports  
  - Image names  
- Supports parsing of Nmap output and other static logs.
- Outputs structured data into files like `docker.log` and `nmap.log`.

### 🎨 Phase 2: Usability & Styling
- Interactive web-based dashboard using `G6` or `vis.js`.
- Sidebar with modular panels:
  - Overview  
  - Node Info  
  - Logs  
  - Settings  
- Dark Mode toggle for comfortable viewing.
- Node tooltips and info panel on click.
- Search and filtering by IP, OS, or service.
- Subnet and OS-based color/shape styling.

### 📊 Phase 3: Deeper Data Insights _(In Progress)_
- **Subnet Ring Layout** – Group nodes into subnet-based clusters.
- **Live Network Stats** – Host count, subnet count, Docker stats, and duplicates.
- **Connection Detection** – Visualize service/port connections.
- **Export Tools** – Export visualized data as PNG, JSON, or CSV.
- **Live Status (Ping/Reachability)** – Show online/offline indicators (optional).

---

## 🧱 Architecture

```
+-----------------------------+
|   Docker Container (Atlas) |
|-----------------------------|
| - Runs scanner scripts      |
| - Parses Docker/Nmap data   |
| - Outputs logs and JSON     |
+-----------------------------+

         ↓

+-----------------------------+
|     Web Frontend (HTML)    |
|-----------------------------|
| - G6 or vis.js visualization|
| - Dynamic subnet layout     |
| - Info sidebar and filters  |
+-----------------------------+
```

---

## 📂 Project Structure

```
atlas/
├── config/
│   ├── logs/
│   │   ├── docker.log        # Docker container info
│   │   ├── nmap.log          # Nmap scan results
│   │   └── docker_hosts.log  # Processed container data
│   └── scripts/
│       └── docker_script.sh  # Script to scan Docker containers
├── data/
│   └── html/
│       ├── visuals/          # G6-based working dashboard
│       └── visuals2/         # vis.js-based dashboard version
└── README.md
```

---

## 🧪 Getting Started

1. **Clone the repo:**
   ```bash
   git clone https://github.com/karam-ajaj/atlas.git
   cd atlas
   ```

2. **Run the scanner script inside your container:**
   ```bash
   bash config/scripts/docker_script.sh
   ```

3. **Serve the dashboard using Nginx or Python server:**
   ```bash
   cd data/html/visuals
   python3 -m http.server 8889
   # Then open http://localhost:8889 in browser
   ```

---

## 📈 Roadmap

| Phase | Feature                        | Status     |
|-------|--------------------------------|------------|
| 1     | Docker/Nmap log parser         | ✅ Complete |
| 2     | Interactive dashboard UI       | ✅ Working  |
| 3     | Subnet clustering & stats      | 🚧 Ongoing |
| 3     | Connection detection           | 🚧 Ongoing |
| 3     | Export to PNG/CSV/JSON         | 📝 Planned |
| 3     | Live host reachability         | ⏳ Optional |

---

## 👨‍💻 Author

**Karam Ajaj**  
Infrastructure & Automation Engineer  
[https://github.com/karam-ajaj](https://github.com/karam-ajaj)

---

## 📝 License

This project is licensed under the MIT License.

---

## 💡 Contribution

Ideas, issues, and PRs are welcome. Feel free to fork the repo and contribute to better infrastructure visibility!
