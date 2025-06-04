# this is the main script to find the hosts and docker containers

#!/bin/bash

# initiate db
./db_setup.sh

# find containers
# ./docker_script_multips_ips.sh
./new_docker_script_multips_ips.sh

# find hosts
./hosts_fast_scan.sh
./hosts_deep_scan_macs.sh


# export the path
export PYTHONPATH=/config
# start in the background and save to log file
uvicorn scripts.app:app --host 0.0.0.0 --port 8000 > /config/logs/uvicorn.log 2>&1 &