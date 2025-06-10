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
# /config/scripts/db_setup.sh

# Parse and write to DB + log
python3 <<EOF
import sqlite3
import subprocess
from lxml import etree
import re

# Detect gateway (next hop)
try:
    traceroute_output = subprocess.check_output(["traceroute", "-n", "8.8.8.8"], stderr=subprocess.DEVNULL).decode()
    match = re.search(r"^\s*1\s+(\d{1,3}(?:\.\d{1,3}){3})", traceroute_output, re.MULTILINE)
    inferred_nexthop = match.group(1) if match else "unavailable"
except Exception:
    inferred_nexthop = "unavailable"

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
current_ips = []

for host in hosts:
    addr = host.find("address[@addrtype='ipv4']")
    ip = addr.get("addr") if addr is not None else "Unknown"
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

    # Append full record
    output.append([index, ip, hostname, os_name, mac, open_ports, inferred_nexthop])
    index += 1

# Track deleted hosts
placeholders = ', '.join('?' for _ in current_ips)
cur.execute(f"""
UPDATE hosts
SET deleted = 1
WHERE ip NOT IN ({placeholders})
""", current_ips)

# Insert/update live records
for record in output:
    _, ip, name, os_details, mac_address, open_ports, next_hop = record

    cur.execute("""
    INSERT INTO hosts (ip, name, os_details, mac_address, open_ports, next_hop, last_seen, deleted)
    SELECT ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0
    WHERE NOT EXISTS (SELECT 1 FROM hosts WHERE ip = ?)
    """, (ip, name, os_details, mac_address, open_ports, next_hop, ip))

    cur.execute("""
    UPDATE hosts
    SET name = ?, os_details = ?, mac_address = ?, open_ports = ?, next_hop = ?, last_seen = CURRENT_TIMESTAMP, deleted = 0
    WHERE ip = ?
      AND (name != ? OR os_details != ? OR mac_address != ? OR open_ports != ? OR next_hop != ?)
    """, (name, os_details, mac_address, open_ports, next_hop, ip,
          name, os_details, mac_address, open_ports, next_hop))

conn.commit()
conn.close()

# Log output
with open(log_file, "w") as f:
    f.write("[\n")
    for entry in output[:-1]:
        f.write(f"  {entry},\n")
    f.write(f"  {output[-1]}\n]")

EOF

echo "Scan complete. Hosts stored with next hop inferred."
