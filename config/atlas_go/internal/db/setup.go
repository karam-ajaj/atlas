package db

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/mattn/go-sqlite3"
)

const dbPath = "/config/db/atlas.db"

func InitDB() error {
	// Step 1: Make sure the directory exists
	dbDir := "/config/db"
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return fmt.Errorf("failed to create DB dir: %v", err)
	}

	// Step 2: Open the SQLite database (it will be created if not exists)
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open DB: %v", err)
	}
	defer db.Close()

	// Step 3: Execute schema setup
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

ALTER TABLE hosts ADD COLUMN online_status TEXT DEFAULT 'online';
ALTER TABLE docker_hosts ADD COLUMN online_status TEXT DEFAULT 'online';

CREATE UNIQUE INDEX IF NOT EXISTS idx_hosts_ip ON hosts(ip);
CREATE UNIQUE INDEX IF NOT EXISTS idx_docker_hosts_ip ON docker_hosts(ip);
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_networks_ip ON external_networks(public_ip);
`

	if _, err := db.Exec(schema); err != nil {
		return fmt.Errorf("schema execution failed: %v", err)
	}

	return nil
}
