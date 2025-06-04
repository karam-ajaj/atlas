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

# Ensure DB table exists
/config/scripts/db_setup.sh

# Ensure 'deleted' column exists
sqlite3 /config/db/atlas.db "PRAGMA table_info(hosts);" | grep -q 'deleted' || \
sqlite3 /config/db/atlas.db "ALTER TABLE hosts ADD COLUMN deleted BOOLEAN DEFAULT 0;"

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
    output.append([index, ip, hostname, os_name, mac, open_ports])

    # Reactivate deleted entries if reappeared
    cur.execute("""
    UPDATE hosts
    SET deleted = 0,
        name = ?,
        os_details = ?,
        mac_address = ?,
        open_ports = ?,
        last_seen = CURRENT_TIMESTAMP
    WHERE ip = ?
      AND deleted = 1
    """, (hostname, os_name, mac, open_ports, ip))

    # Insert new entries
    cur.execute("""
    INSERT INTO hosts (ip, name, os_details, mac_address, open_ports, last_seen, deleted)
    SELECT ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0
    WHERE NOT EXISTS (
        SELECT 1 FROM hosts WHERE ip = ?
    )
    """, (ip, hostname, os_name, mac, open_ports, ip))

    # Update existing entries if changed
    cur.execute("""
    UPDATE hosts
    SET name = ?,
        os_details = ?,
        mac_address = ?,
        open_ports = ?,
        last_seen = CURRENT_TIMESTAMP
    WHERE ip = ?
      AND deleted = 0
      AND (name != ?
           OR os_details != ?
           OR mac_address != ?
           OR open_ports != ?)
    """, (hostname, os_name, mac, open_ports, ip, hostname, os_name, mac, open_ports))

    index += 1

# Soft-delete hosts that are no longer visible
placeholders = ', '.join('?' for _ in current_ips)
cur.execute(f"""
UPDATE hosts
SET deleted = 1, last_seen = CURRENT_TIMESTAMP
WHERE ip NOT IN ({placeholders})
""", current_ips)

conn.commit()
conn.close()

# Write final results to log
with open(log_file, "w") as f:
    f.write("[\n")
    for entry in output[:-1]:
        f.write(f"  {entry},\n")
    f.write(f"  {output[-1]}\n]")

EOF

echo "Scan results synced to database with soft-delete tracking."
