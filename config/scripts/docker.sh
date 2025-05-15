docker inspect $(docker ps -q ) \
--format='{{ printf "%-50s" .Name}} {{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' > /config/logs/docker.log