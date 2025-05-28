#!/bin/bash

# Path to store logs and database
log_file="/config/logs/docker.log"
hosts_file="/config/logs/docker_hosts.log"
db_file="/config/db/atlas.db"

# Function to extract container details
extract_container_info() {
    docker inspect "$1" | jq -r '
        .[0].Name as $name |
        .[0].NetworkSettings.Networks | to_entries[] | 
        [$name, .key, .value.IPAddress, .value.MacAddress] | @tsv
    '
}

# Capture container details
docker ps -q | while read -r container_id; do
    extract_container_info "$container_id"
done > "$log_file"

# Process log file to extract container details including multiple IPs
exec > "$hosts_file"
while read -r name network ip mac; do
    short_name="${name##/}"
    container_id=$(docker ps -q --filter name="^/${short_name}")

    if [ -n "$container_id" ]; then
        image=$(docker inspect -f '{{.Config.Image}}' "$container_id")
        os=$(docker image inspect "$image" --format '{{.Os}}' 2>/dev/null)
        os=${os:-unknown}

        # Extract ports from container inspect (Swarm compatible)
        ports=$(docker inspect "$container_id" |
            jq -r '.[0].NetworkSettings.Ports // {} | to_entries[]? | "\(.key) -> \(.value[0].HostIp):\(.value[0].HostPort)"' | paste -sd, -)
        ports=${ports:-no_ports}

        # Extract next-hop IP (default gateway)
        nexthop=$(docker exec "$container_id" sh -c "ip route | awk '/default/ {print \$3}'" 2>/dev/null)
        nexthop=${nexthop:-unknown}

        printf "%-15s %-50s %-10s %-30s %-40s %-15s\n" "$ip" "$short_name" "$os" "$mac" "$ports" "$nexthop"
    else
        printf "%-15s %-50s %-10s %-30s %-40s %-15s\n" "$ip" "$short_name" "unknown" "not_found" "no_ports" "unknown"
    fi
done < "$log_file"

# Insert data into SQLite database
while IFS= read -r line; do
    ip=$(echo "$line" | awk '{print $1}')
    name=$(echo "$line" | awk '{print $2}')
    os_details=$(echo "$line" | awk '{print $3}')
    mac_address=$(echo "$line" | awk '{print $4}')
    open_ports=$(echo "$line" | awk '{$1=$2=$3=$4=$NF=""; print $0}' | sed 's/^[ \t]*//' | sed 's/[ \t]*$//')
    next_hop=$(echo "$line" | awk '{print $NF}')

    sqlite3 "$db_file" <<EOF
INSERT OR IGNORE INTO docker_hosts (ip, name, os_details, mac_address, open_ports, next_hop)
VALUES ('$ip', '$name', '$os_details', '$mac_address', '$open_ports', '$next_hop');
EOF

done < "$hosts_file"
