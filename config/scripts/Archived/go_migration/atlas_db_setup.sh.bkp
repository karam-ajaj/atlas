#!/bin/bash

db_file="/config/db/atlas.db"

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
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    online_status TEXT DEFAULT 'online'
);

CREATE TABLE IF NOT EXISTS docker_hosts (
    id TEXT PRIMARY KEY,             -- Use container ID as primary key!
    ip TEXT,
    name TEXT,
    os_details TEXT,
    mac_address TEXT,
    open_ports TEXT,
    next_hop TEXT,
    network_name TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    online_status TEXT DEFAULT 'online'
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_hosts_ip ON hosts(ip);
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_networks_ip ON external_networks(public_ip);

EOF