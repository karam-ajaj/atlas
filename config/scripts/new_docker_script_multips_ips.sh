#!/bin/bash

log_file="/config/logs/docker.log"
hosts_file="/config/logs/docker_hosts.log"
db_file="/config/db/atlas.db"

declare -A gateway_cache

# Function to extract container network info
extract_container_info() {
    docker inspect "$1" | jq -r '
        .[0].Name as $name |
        .[0].NetworkSettings.Networks | to_entries[] |
        [$name, .key, .value.IPAddress, .value.MacAddress] | @tsv
    '
}

# Collect container info
docker ps -q | while read -r container_id; do
    extract_container_info "$container_id"
done > "$log_file"

# Generate host info
exec > "$hosts_file"
while read -r name network ip mac; do
    short_name="${name##/}"
    container_id=$(docker ps -q --filter name="^/${short_name}")

    if [ -n "$container_id" ]; then
        image=$(docker inspect -f '{{.Config.Image}}' "$container_id")
        os=$(docker image inspect "$image" --format '{{.Os}}' 2>/dev/null)
        os=${os:-unknown}

        ports=$(docker inspect "$container_id" |
            jq -r '.[0].NetworkSettings.Ports // {} | to_entries[]? |
            if .value[0].HostIp == null or .value[0].HostPort == null
            then "\(.key) (internal)"
            else "\(.key) -> \(.value[0].HostIp):\(.value[0].HostPort)"
            end' | paste -sd, -)
        ports=${ports:-no_ports}

        # Try Docker network inspect
        nexthop=$(docker network inspect "$network" 2>/dev/null |
            grep -B 5 "\"$ip\"" | grep '"Gateway":' | awk -F '"' '{print $4}')

        # Try fallback inside container
        if [[ -z "$nexthop" || "$nexthop" == "null" ]]; then
            nexthop=$(docker exec "$container_id" sh -c "ip route | awk '/default/ {print \$3}'" 2>&1)

            # Clean errors and use fallback
            if [[ "$nexthop" == *"not found"* || "$nexthop" == *"OCI runtime"* || "$nexthop" == *"exec failed"* || -z "$nexthop" ]]; then
                nexthop="${gateway_cache[$network]}"
                nexthop=${nexthop:-unavailable}
            fi
        fi

        # Cache the result
        if [[ "$nexthop" != "unavailable" ]]; then
            gateway_cache["$network"]=$nexthop
        fi

        printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\n" "$ip" "$short_name" "$os" "$mac" "$ports" "$nexthop" "$network"
    else
        printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\n" "$ip" "$short_name" "unknown" "not_found" "no_ports" "unavailable" "$network"
    fi
done < "$log_file"

# Insert/update database
while IFS=$'\t' read -r ip name os_details mac_address open_ports next_hop network_name; do
    existing=$(sqlite3 "$db_file" "SELECT COUNT(*) FROM docker_hosts WHERE ip = '$ip';")

    if [ "$existing" -eq 0 ]; then
        sqlite3 "$db_file" <<EOF
INSERT INTO docker_hosts (ip, name, os_details, mac_address, open_ports, next_hop, network_name, last_seen)
VALUES ('$ip', '$name', '$os_details', '$mac_address', '$open_ports', '$next_hop', '$network_name', CURRENT_TIMESTAMP);
EOF
    else
        sqlite3 "$db_file" <<EOF
UPDATE docker_hosts
SET name = '$name',
    os_details = '$os_details',
    mac_address = '$mac_address',
    open_ports = '$open_ports',
    next_hop = '$next_hop',
    network_name = '$network_name',
    last_seen = CURRENT_TIMESTAMP
WHERE ip = '$ip'
  AND (name != '$name'
    OR os_details != '$os_details'
    OR mac_address != '$mac_address'
    OR open_ports != '$open_ports'
    OR next_hop != '$next_hop'
    OR network_name != '$network_name');
EOF
    fi
done < "$hosts_file"

# Remove stale records
current_ips=$(cut -f1 "$hosts_file" | sort | uniq | tr '\n' ',' | sed 's/,$//')
sqlite3 "$db_file" <<EOF
DELETE FROM docker_hosts
WHERE ip NOT IN ($(echo "'$current_ips'" | sed "s/,/','/g"));
EOF
