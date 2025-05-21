#!/bin/bash

# Prep environment
uname -a > /config/logs/uname.log
ifconfig | grep inet > /config/logs/ip.log
arp -a > /config/logs/arp.log

# Detect subnet
subnet=$(traceroute google.com | grep " 2 " | grep -oP '\d{1,3}\.\d{1,3}\.\d{1,3}\.' | sed 's/$/0\/24/')

# Quick scan to collect MACs
nmap -sn "$subnet" -oX /config/logs/nmap_mac.xml

# Full scan with OS + ports
nmap -O -sS -p- "$subnet" -oX /config/logs/nmap_full.xml

# Create DB table if not exists
/config/scripts/db_setup.sh

# Parse and write to DB + log
python3 <<EOF
import sqlite3
from lxml import etree

mac_tree = etree.parse("/config/logs/nmap_mac.xml")
mac_map = {}
for host in mac_tree.xpath("//host"):
    ip_elem = host.find("address[@addrtype='ipv4']")
    mac_elem = host.find("address[@addrtype='mac']")
    if ip_elem is not None and mac_elem is not None:
        mac_map[ip_elem.get("addr")] = mac_elem.get("addr")

xml_file = "/config/logs/nmap_full.xml"
log_file = "/config/logs/hosts.log"
db_file = "/config/db/atlas.db"

tree = etree.parse(xml_file)
hosts = tree.xpath("//host")
output = []

conn = sqlite3.connect(db_file)
cur = conn.cursor()

index = 1
for host in hosts:
    addr = host.find("address[@addrtype='ipv4']")
    ip = addr.get("addr") if addr is not None else "Unknown"

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

    # Append to log
    output.append([index, ip, hostname, os_name, mac, open_ports])

    # Insert into DB
    cur.execute("""
    INSERT INTO hosts (ip, name, os_details, mac_address, open_ports)
    SELECT ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
        SELECT 1 FROM hosts WHERE ip = ?
    )
    """, (ip, hostname, os_name, mac, open_ports, ip))

    index += 1

conn.commit()
conn.close()

# Write to hosts.log
with open(log_file, "w") as f:
    f.write("[\n")
    for entry in output[:-1]:
        f.write(f"  {entry},\n")
    f.write(f"  {output[-1]}\n]")

EOF

echo "Full data inserted into database and written to hosts.log."

# Start FastAPI app
export PYTHONPATH=/config
uvicorn scripts.app:app --host 0.0.0.0 --port 8000 > /config/logs/uvicorn.log 2>&1 &

# Save disk usage
df -h > /config/logs/df.log
