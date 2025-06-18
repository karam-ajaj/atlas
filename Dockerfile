FROM nginx:latest

# Copy nginx config
COPY config/nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy HTML static files
COPY data/html/ /usr/share/nginx/html/

# Copy Go binary from your local Go project
COPY config/atlas_go_sqlite/atlas /config/bin/atlas

# Copy all other config files (excluding db)
COPY config/ /config/

# Run setup script if needed
RUN chmod +x /config/scripts/atlas_install.sh && /config/scripts/atlas_install.sh
RUN mkdir /config/db && touch /config/db/atlas.db
RUN chmod +x /config/scripts/atlas_db_setup.sh && /config/scripts/atlas_db_setup.sh
RUN chmod +x /config/scripts/atlas_check.sh
# RUN export PYTHONPATH=/config && uvicorn scripts.app:app --host 0.0.0.0 --port 8889 > /config/logs/uvicorn.log 2>&1 &

# Expose the default nginx port
EXPOSE 8888
EXPOSE 8889

CMD ["/config/scripts/atlas_check.sh"]


# cd /swarm/github-repos/atlas
# docker build -t keinstien/atlas:v1.1 .
# docker push keinstien/atlas:v1.1

# docker build -t keinstien/atlas:v1.1 /swarm/github-repos/atlas