#!/bin/bash

db_file1="/config/db/atlas.db"

# delete the database
# rm -rf $db_file1

# Create database if it doesn't exist
# if [[ ! -f $db_file ]]; then
    echo "Creating database..."
    sqlite3 "$db_file1" <<EOF
    CREATE TABLE IF NOT EXISTS hosts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT UNIQUE,
        name TEXT,
        os_details TEXT,
        mac_address TEXT,
        open_ports TEXT
    );
    CREATE TABLE IF NOT EXISTS docker_hosts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT UNIQUE,
        name TEXT,
        os_details TEXT,
        mac_address TEXT,
        open_ports TEXT
    );
    CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        log_type TEXT NOT NULL,
        content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
EOF
# fi

# db_file2="/config/db/atlas_docker.db"

# # delete the database
# rm -rf $db_file2

# # Create database if it doesn't exist
# # if [[ ! -f $db_file ]]; then
#     echo "Creating database..."
#     sqlite3 "$db_file2" <<EOF
#     CREATE TABLE IF NOT EXISTS hosts (
#         id INTEGER PRIMARY KEY AUTOINCREMENT,
#         ip TEXT UNIQUE,
#         name TEXT,
#         os_details TEXT,
#         mac_address TEXT,
#         open_ports TEXT
#     );
#     CREATE TABLE IF NOT EXISTS logs (
#         id INTEGER PRIMARY KEY AUTOINCREMENT,
#         log_type TEXT NOT NULL,
#         content TEXT,
#         timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
#     );
# EOF