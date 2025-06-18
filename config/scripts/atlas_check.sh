# this is the main script to find the hosts and docker containers

#!/bin/bash

# initiate db
# ./atlas_db_setup.sh

# # find containers
# # ./docker_script_multips_ips.sh
# ./atlas_docker_script_multips_ips.sh

# # find hosts
# ./atlas_hosts_fast_scan.sh
# ./atlas_hosts_deep_scan_macs.sh


# export the path
export PYTHONPATH=/config
# # start in the background and save to log file
uvicorn scripts.app:app --host 0.0.0.0 --port 8889 > /config/logs/uvicorn.log 2>&1 &

# Start Nginx in foreground
nginx -g "daemon off;"