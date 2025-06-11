FROM nginx:alpine

# Copy nginx config
COPY config/nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy HTML static files
COPY data/html/ /usr/share/nginx/html/

# Copy all other config files (excluding db)
COPY config/ /config/

# Run setup script if needed
RUN chmod +x /config/scripts/atlas_install.sh && /config/scripts/atlas_install.sh

# Expose the default nginx port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
