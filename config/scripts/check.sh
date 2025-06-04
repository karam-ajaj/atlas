# this is the main script to find the hosts and docker containers

#!/bin/bash

# initiate db
./db_setup.sh

# find containers
# ./docker_script_multips_ips.sh
./new_docker_script_multips_ips.sh

# find hosts
./hosts_fast_scan.sh
# ./hosts_deep_scan_macs.sh