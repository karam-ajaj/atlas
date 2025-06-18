package db

import (
	"database/sql"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

func InitDB() error {
	dbPath := "/config/db/atlas.db"
	fmt.Println("🛠️  Ensuring database and tables exist...")

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open DB: %w", err)
	}
	defer db.Close()

	schema := `
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_hosts_ip ON hosts(ip);
CREATE UNIQUE INDEX IF NOT EXISTS idx_docker_hosts_ip ON docker_hosts(ip);
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_networks_ip ON external_networks(public_ip);
`

	_, err = db.Exec(schema)
	if err != nil {
		return fmt.Errorf("schema execution failed: %w", err)
	}

	fmt.Println("✅ Database is ready.")
	return nil
}
