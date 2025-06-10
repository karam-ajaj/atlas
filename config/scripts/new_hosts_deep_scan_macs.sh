#!/bin/bash

set -e

log_dir="/config/logs"
db_file="/config/db/atlas.db"
nmap_xml="$log_dir/nmap_scan.xml"
hosts_log="$log_dir/hosts.log"

mkdir -p "$log_dir"

# === Get local subnet ===
subnet=$(ip -o -f inet addr show | awk '/scope global/ {print $4}' | grep '/24' | head -n1)

# === Run full Nmap scan (OS, ports) ===
nmap -O -sS -p- "$subnet" -oX "$nmap_xml" > "$log_dir/nmap_stdout.log" 2>&1

# === Populate ARP table ===
arp -an > "$log_dir/arp_raw.log"

# === Run the Python post-processor ===
python3 <<EOF
import sqlite3
import subprocess
import re
import ipaddress
from lxml import etree

db_file = "$db_file"
xml_file = "$nmap_xml"
log_file = "$hosts_log"

# === Get MAC address map from `arp -an` ===
mac_map = {}
try:
    arp_output = subprocess.check_output(["arp", "-an"]).decode()
    for line in arp_output.splitlines():
        match = re.search(r"\((\d{1,3}(?:\.\d{1,3}){3})\) at ([0-9a-fA-F:]{17})", line)
        if match:
            ip, mac = match.groups()
            mac_map[ip] = mac
except Exception as e:
    print("ARP parsing failed:", e)

# === Get default gateway ===
try:
    route_output = subprocess.check_output(["ip", "route"]).decode()
    match = re.search(r"default via (\d{1,3}(?:\.\d{1,3}){3})", route_output)
    inferred_gateway = match.group(1) if match else "unavailable"
except Exception:
    inferred_gateway = "unavailable"

# === Parse Nmap results ===
tree = etree.parse(xml_file)
hosts = tree.xpath("//host")
output = []

conn = sqlite3.connect(db_file)
cur = conn.cursor()

# Ensure table exists
cur.execute("""
CREATE TABLE IF NOT EXISTS hosts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT UNIQUE,
    name TEXT,
    os_details TEXT,
    mac_address TEXT,
    open_ports TEXT,
    next_hop TEXT,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted BOOLEAN DEFAULT 0
);
""")

# Extract hosts
current_ips = []
index = 1

for host in hosts:
    addr = host.find("address[@addrtype='ipv4']")
    ip = addr.get("addr") if addr is not None else "Unknown"

    try:
        if not ipaddress.ip_address(ip).is_private:
            continue
    except Exception:
        continue

    current_ips.append(ip)

    hostname_elem = host.find(".//hostnames/hostname")
    hostname = hostname_elem.get("name") if hostname_elem is not None else "NoName"

    os_match = host.find(".//os/osmatch")
    os_name = os_match.get("name") if os_match is not None else "Unknown"

    ports = []
    for port in host.findall(".//port"):
        state = port.find("state")
        if state is not None and state.get("state") == "open":
            ports.append(port.get("portid"))
    open_ports = ",".join(ports) if ports else "Unknown"

    mac = mac_map.get(ip, "Unknown")
    nexthop = inferred_gateway

    output.append([index, ip, hostname, os_name, mac, open_ports, nexthop])
    index += 1

# Mark deleted hosts
placeholders = ', '.join('?' for _ in current_ips)
if current_ips:
    cur.execute(f"""
        UPDATE hosts SET deleted = 1 WHERE ip NOT IN ({placeholders})
    """, current_ips)

# Insert or update hosts
for _, ip, name, os_details, mac_address, open_ports, next_hop in output:
    cur.execute("""
    INSERT INTO hosts (ip, name, os_details, mac_address, open_ports, next_hop, last_seen, deleted)
    SELECT ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0
    WHERE NOT EXISTS (SELECT 1 FROM hosts WHERE ip = ?)
    """, (ip, name, os_details, mac_address, open_ports, next_hop, ip))

    cur.execute("""
    UPDATE hosts
    SET name = ?, os_details = ?, mac_address = ?, open_ports = ?, next_hop = ?, last_seen = CURRENT_TIMESTAMP, deleted = 0
    WHERE ip = ? AND (
        name != ? OR os_details != ? OR mac_address != ? OR open_ports != ? OR next_hop != ?
    )
    """, (name, os_details, mac_address, open_ports, next_hop, ip,
          name, os_details, mac_address, open_ports, next_hop))

conn.commit()
conn.close()

# === Write human-readable log ===
with open(log_file, "w") as f:
    f.write("[\n")
    for entry in output[:-1]:
        f.write(f"  {entry},\n")
    f.write(f"  {output[-1]}\n]")

EOF

echo "✅ Network scan complete. Results written to $db_file"
