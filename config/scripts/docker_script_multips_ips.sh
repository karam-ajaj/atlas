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
        ports=$(docker inspect "$container_id" | \
            jq -r '.[0].NetworkSettings.Ports // {} | to_entries[]? | "\(.key) -> \(.value[0].HostIp):\(.value[0].HostPort)"' | paste -sd, -)
        ports=${ports:-no_ports}

        printf "%-15s %-50s %-10s %-30s %-40s\n" "$ip" "$short_name" "$os" "$mac" "$ports"
    else
        printf "%-15s %-50s %-10s %-30s %-40s\n" "$ip" "$short_name" "unknown" "not_found" "no_ports"
    fi
done < "$log_file"

# Insert data into SQLite database
while IFS= read -r line; do
    # Parse the line into fields (assuming whitespace-separated)
    ip=$(echo "$line" | awk '{print $1}')
    name=$(echo "$line" | awk '{print $2}')
    os_details=$(echo "$line" | awk '{print $3}')
    mac_address=$(echo "$line" | awk '{print $4}')
    open_ports=$(echo "$line" | awk '{$1=$2=$3=$4=""; print $0}' | sed 's/^[ \t]*//')

    # Insert into database only if IP doesn't already exist
    sqlite3 "$db_file" <<EOF
INSERT INTO docker_hosts (ip, name, os_details, mac_address, open_ports)
SELECT '$ip', '$name', '$os_details', '$mac_address', '$open_ports'
WHERE NOT EXISTS (
    SELECT 1 FROM docker_hosts WHERE ip = '$ip'
);
EOF

done < "$hosts_file"

# Start server
export PYTHONPATH=/config
uvicorn scripts.docker:app --host 0.0.0.0 --port 8000 > /config/logs/uvicorn.log 2>&1 &

# Log disk usage
df -h > /config/logs/df.log
