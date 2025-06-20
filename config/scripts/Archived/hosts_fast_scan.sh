#!/bin/bash


# /config/scripts/install.sh


uname -a > /config/logs/uname.log
ifconfig | grep inet > /config/logs/ip.log
arp -a > /config/logs/arp.log
x=$(traceroute google.com | grep " 2 " | grep -oP '\d{1,3}\.\d{1,3}\.\d{1,3}\.' | sed 's/$/0\/24/')
nmap -sn $x -oG /config/logs/nmap.log

traceroute google.com | grep " 2 " | grep -oP '\d{1,3}\.\d{1,3}\.\d{1,3}\.' | sed 's/$/0\\24/' > /config/logs/hop.log 
# echo "0/24"  >> hop.log


# Define the input file
input_file="/config/logs/nmap.log"

# Extract IP and Name
grep "Host:" "$input_file" | awk -F '[ ()]' '{
    ip = $2
    name = ($4 == "" ? "NoName" : $4)
    print ip, name
}' > /config/logs/hosts.log

# # sqlite add values
# sqlite3 /config/db/atlas.db <<EOF
# INSERT INTO hosts (ip, name, os_details, mac_address, open_ports)
# VALUES ("$ip", "$name", "$os_details", "$mac_address", "$ports");
# EOF


# Define the input file and database
input_file="/config/logs/nmap.log"
db_file="/config/db/atlas.db"


## create tables
# /config/scripts/db_setup.sh

# Read the Nmap log and extract values line by line
while IFS= read -r line; do
    # Extract IP and Name
    ip=$(echo "$line" | awk -F '[ ()]' '{print $2}')
    name=$(echo "$line" | awk -F '[ ()]' '{print ($4 == "" ? "NoName" : $4)}')

    # Placeholder values for missing fields
    os_details="Unknown"
    mac_address="Unknown"
    open_ports="Unknown"

    # Insert if the IP does not exist
#     sqlite3 /config/db/atlas.db <<EOF
# INSERT INTO hosts (ip, name, os_details, mac_address, open_ports)
# SELECT '$ip', '$name', '$os_details', '$mac_address', '$open_ports'
# WHERE NOT EXISTS (
#     SELECT 1 FROM hosts WHERE ip = '$ip'
# );
# EOF

existing=$(sqlite3 "$db_file" "SELECT COUNT(*) FROM hosts WHERE ip = '$ip';")

if [ "$existing" -eq 0 ]; then
  sqlite3 "$db_file" <<EOF
INSERT INTO hosts (ip, name, os_details, mac_address, open_ports, next_hop, network_name, last_seen)
VALUES ('$ip', '$name', '$os_details', '$mac_address', '$open_ports', '$next_hop', '$network_name', CURRENT_TIMESTAMP);
EOF
else
  sqlite3 "$db_file" <<EOF
UPDATE hosts
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
    OR network_name != '$network_name')
    OR last_seen != CURRENT_TIMESTAMP;
EOF
fi


# Step: Remove stale hosts from DB
current_ips=$(grep "Host:" "$input_file" | awk '{print $2}' | sort | uniq | tr '\n' ',' | sed 's/,$//')

sqlite3 "$db_file" <<EOF
DELETE FROM hosts
WHERE ip NOT IN ($(echo "'$current_ips'" | sed "s/,/','/g"));
EOF



done < "$input_file"


echo "Data inserted into the database successfully."

/config/scripts/nmap.sh 

# # api
# pip install fastapi uvicorn sqlite3

# # app.py
# from fastapi import FastAPI
# import sqlite3

# app = FastAPI()

# @app.get("/hosts")
# def get_hosts():
#     conn = sqlite3.connect("/config/db/atlas.db")
#     cursor = conn.cursor()
#     cursor.execute("SELECT * FROM hosts")
#     rows = cursor.fetchall()
#     conn.close()
#     return rows

# # export the path
# export PYTHONPATH=/config
# # start in the background and save to log file
# uvicorn scripts.app:app --host 0.0.0.0 --port 8000 > /config/logs/uvicorn.log 2>&1 &

# cd /config/scripts
# uvicorn app:app --host 0.0.0.0 --port 8000 > /config/logs/uvicorn.log 2>&1 &

df -h > /config/logs/df.log