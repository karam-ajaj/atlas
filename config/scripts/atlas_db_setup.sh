#!/usr/bin/env sh

db_file="/config/db/atlas.db"

# Create database and tables if they don't exist
echo "Ensuring database and tables exist..."
sqlite3 "$db_file" <<EOF
CREATE TABLE IF NOT EXISTS hosts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT,
    name TEXT,
    os_details TEXT,
    mac_address TEXT,
    open_ports TEXT,
    next_hop TEXT,
    network_name TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS docker_hosts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT,
    name TEXT,
    os_details TEXT,
    mac_address TEXT,
    open_ports TEXT,
    next_hop TEXT,
    network_name TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS external_networks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_ip TEXT UNIQUE,
    provider TEXT,
    location TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_type TEXT NOT NULL,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE hosts ADD COLUMN online_status TEXT DEFAULT 'online';
ALTER TABLE docker_hosts ADD COLUMN online_status TEXT DEFAULT 'online';

-- ✅ Add UNIQUE constraint via index
CREATE UNIQUE INDEX IF NOT EXISTS idx_hosts_ip ON hosts(ip);
CREATE UNIQUE INDEX IF NOT EXISTS idx_docker_hosts_ip ON docker_hosts(ip);
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_networks_ip ON external_networks(public_ip);

EOF
