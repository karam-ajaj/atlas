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

```plaintext
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
