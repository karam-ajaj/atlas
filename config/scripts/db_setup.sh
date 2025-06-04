#!/bin/bash

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

CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_type TEXT NOT NULL,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
EOF
