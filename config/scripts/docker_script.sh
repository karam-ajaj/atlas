#!/bin/bash

## create tables
/config/scripts/db_setup.sh

# create the file
# docker inspect $(docker ps -q ) --format='{{ printf "%-50s" .Name}} {{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' > /config/logs/docker.log
docker inspect $(docker ps -q) --format='{{.Name}} {{range .NetworkSettings.Networks}}{{.IPAddress}} MAC:{{.MacAddress}} {{end}}{{if .NetworkSettings.Ports}}Ports:{{range $p, $v := .NetworkSettings.Ports}}{{$p}} {{end}}{{end}}Image:{{.Config.Image}}' | sed 's/^\/\([^ ]*\)/\1/' > /config/logs/docker.log


# Define the input file
# input_file="/config/logs/nmap.log"
input_file="/config/logs/docker.log"

# Extract IP and Name
# awk 'NF >= 2 { name = $1; sub(/^\//, "", name); print $2, name }' /config/logs/docker.log > /config/logs/docker_hosts.log

# script to extract more data
exec > /config/logs/docker_hosts.log
while read -r ip name; do
    short_name="${name%%.*}"
    container_id=$(docker ps -q --filter name="^/${short_name}")

    if [ -n "$container_id" ]; then
        mac=$(docker inspect "$container_id" | grep -o '"MacAddress": *"[^"]*"' | cut -d'"' -f4 | paste -sd, -)
        image=$(docker inspect -f '{{.Config.Image}}' "$container_id")
        os=$(docker image inspect "$image" --format '{{.Os}}' 2>/dev/null)
        os=${os:-unknown}

        printf "%-15s %-50s %-10s %-30s\n" "$ip" "$name" "$os" "$mac"
    else
        printf "%-15s %-50s %-10s %-30s\n" "$ip" "$name" "unknown" "not_found"
    fi
done < <(awk 'NF >= 2 { name = $1; sub(/^\//, "", name); print $2, name }' /config/logs/docker.log)




# # sqlite add values
# sqlite3 /config/db/atlas.db <<EOF
# INSERT INTO hosts (ip, name, os_details, mac_address, open_ports)
# VALUES ("$ip", "$name", "$os_details", "$mac_address", "$ports");
# EOF


# # Define the input file and database
# # input_file="/config/logs/nmap.log"
# input_file="/config/logs/docker_hosts.log"
# db_file="/config/db/atlas.db"


# # Read the Nmap log and extract values line by line
# while IFS= read -r line; do
#     # Extract IP and Name
#     ip=$(echo "$line" | awk -F '[ ()]' '{print $1}')
#     name=$(echo "$line" | awk -F '[ ()]' '{print ($2 == "" ? "NoName" : $2)}')

#     # Placeholder values for missing fields
#     os_details="Unknown"
#     mac_address="Unknown"
#     open_ports="Unknown"

#     # echo $ip $name
#     # Insert if the IP does not exist
#     sqlite3 /config/db/atlas.db <<EOF
# INSERT INTO docker_hosts (ip, name, os_details, mac_address, open_ports)
# SELECT '$ip', '$name', '$os_details', '$mac_address', '$open_ports'
# WHERE NOT EXISTS (
#     SELECT 1 FROM docker_hosts WHERE ip = '$ip'
# );
# EOF

# done < "/config/logs/docker_hosts.log"


input_file="/config/logs/docker_hosts.log"
db_file="/config/db/atlas.db"

while IFS= read -r line; do
    # Parse the line into fields (assuming whitespace-separated)
    ip=$(echo "$line" | awk '{print $1}')
    name=$(echo "$line" | awk '{print $2}')
    os_details=$(echo "$line" | awk '{print $3}')
    # MAC could be multiple parts if it has commas/spaces, get the rest after 3rd field
    mac_address=$(echo "$line" | awk '{for(i=4; i<=NF; i++) printf "%s%s", $i, (i==NF ? "\n" : " ")}')

    open_ports="Unknown"  # You can update this if you have actual open port info

    # Insert into database only if IP doesn't already exist
    sqlite3 "$db_file" <<EOF
INSERT INTO docker_hosts (ip, name, os_details, mac_address, open_ports)
SELECT '$ip', '$name', '$os_details', '$mac_address', '$open_ports'
WHERE NOT EXISTS (
    SELECT 1 FROM docker_hosts WHERE ip = '$ip'
);
EOF

done < "$input_file"




# echo "Data inserted into the database successfully."

# /config/scripts/nmap.sh 



# export the path
export PYTHONPATH=/config
# start in the background and save to log file
uvicorn scripts.docker:app --host 0.0.0.0 --port 8000 > /config/logs/uvicorn.log 2>&1 &

# cd /config/scripts
# uvicorn app:app --host 0.0.0.0 --port 8000 > /config/logs/uvicorn.log 2>&1 &

df -h > /config/logs/df.log