#!/bin/bash

# /config/scripts/install.sh

LOG_DIR="/config/logs"
DB_FILE="/config/db/atlas.db"
NMAP_LOG="$LOG_DIR/nmap.log"
HOSTS_LOG="$LOG_DIR/hosts.log"

mkdir -p "$LOG_DIR"

# Log basic system info
uname -a > "$LOG_DIR/uname.log"
ip -o -f inet addr show > "$LOG_DIR/ip.log"
arp -a > "$LOG_DIR/arp.log"
df -h > "$LOG_DIR/df.log"

# Get local subnet (e.g., 192.168.2.1/24)
SUBNET=$(ip -o -f inet addr show | awk '/scope global/ {split($4,a,"/"); print a[1]"/24"; exit}')

# Nmap ping scan
nmap -sn "$SUBNET" -oG "$NMAP_LOG"

# Extract IP and hostname
grep "Host:" "$NMAP_LOG" | awk -F '[ ()]' '{
    ip = $2
    name = ($4 == "" ? "NoName" : $4)
    print ip, name
}' > "$HOSTS_LOG"

# Process each host and insert into DB
while read -r ip name; do
    os_details="Unknown"
    mac_address="Unknown"
    open_ports="Unknown"
    next_hop=""
    network_name=""

    existing=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM hosts WHERE ip = '$ip';")

    if [ "$existing" -eq 0 ]; then
        sqlite3 "$DB_FILE" <<EOF
INSERT INTO hosts (ip, name, os_details, mac_address, open_ports, next_hop, network_name, last_seen)
VALUES ('$ip', '$name', '$os_details', '$mac_address', '$open_ports', '$next_hop', '$network_name', CURRENT_TIMESTAMP);
EOF
    else
        sqlite3 "$DB_FILE" <<EOF
UPDATE hosts
SET name = '$name',
    os_details = '$os_details',
    mac_address = '$mac_address',
    open_ports = '$open_ports',
    next_hop = '$next_hop',
    network_name = '$network_name',
    last_seen = CURRENT_TIMESTAMP
WHERE ip = '$ip';
EOF
    fi
done < "$HOSTS_LOG"

# Remove stale hosts
current_ips=$(awk '{print $1}' "$HOSTS_LOG" | sort | uniq | tr '\n' ',' | sed 's/,$//')
sqlite3 "$DB_FILE" <<EOF
DELETE FROM hosts WHERE ip NOT IN ($(echo "'$current_ips'" | sed "s/,/','/g"));
EOF


# Get default gateway IP (internal)
GATEWAY_IP=$(ip route | awk '/default/ {print $3}')

# Get external/public IP via curl as fallback
EXTERNAL_IP=$(curl -s ifconfig.me || curl -s https://api.ipify.org)

if [[ -n "$EXTERNAL_IP" ]]; then
  sqlite3 "$DB_FILE" <<EOF
INSERT OR IGNORE INTO external_networks (public_ip)
VALUES ('$EXTERNAL_IP');

UPDATE external_networks
SET last_seen = CURRENT_TIMESTAMP
WHERE public_ip = '$EXTERNAL_IP';
EOF
fi




echo "✅ Network scan and DB update complete."
