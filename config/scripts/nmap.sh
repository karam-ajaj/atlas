#!/bin/bash

# this script will scan the ips of the host network

# Define the target network range
network_range=$(traceroute google.com | grep " 2 " | grep -oP '\d{1,3}\.\d{1,3}\.\d{1,3}\.' | sed 's/$/0\/24/')


# Define temporary and output files
live_hosts_file="/config/logs/live_hosts.txt"
output_file="/config/logs/nmap_quick_scan.log"
final_output="/config/logs/nmap_last.log"

# Step 1: Find live hosts
echo "Scanning for live hosts in the network range $network_range..."
nmap -sn "$network_range" -oG - | awk '/Up$/{print $2}' > "$live_hosts_file"

# Check if any live hosts were found
if [[ ! -s $live_hosts_file ]]; then
    echo "No live hosts detected. Exiting."
    exit 1
fi

echo "Live hosts found:"
cat "$live_hosts_file"

# Step 2: Perform a quick scan on live hosts
echo "Scanning live hosts for detailed information..."
nmap -A -O -T4 -oN "$output_file" -iL "$live_hosts_file"

# Display a summary of results
echo "Scan completed. Results saved in $output_file."
echo "Summary of detected hosts:"

grep -E "^Nmap scan report for|MAC Address|OS details|Ports:" "$output_file" | \
awk '{
    if ($1 == "Nmap") print "\n" $0; 
    else print "  -> " $0;
}' > /config/logs/nmap_temp.log


# Process the nmap.log to include only host entries
grep -E "^Host:" "$output_file" | awk '{print $2, $3}' > "$final_output"