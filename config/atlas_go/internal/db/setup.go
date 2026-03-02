package db

import (
	"database/sql"
	"fmt"
	"os"

	_ "modernc.org/sqlite"
)

const dbPath = "/config/db/atlas.db"

func InitDB() error {
	// Step 1: Make sure the directory exists
	dbDir := "/config/db"
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return fmt.Errorf("failed to create DB dir: %v", err)
	}

	// Step 2: Open the SQLite database (it will be created if not exists)
	db, err := sql.Open("sqlite", dbPath)
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
    interface_name TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    online_status TEXT DEFAULT 'online'
);

CREATE TABLE IF NOT EXISTS docker_hosts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    container_id TEXT NOT NULL,
    ip TEXT,
    name TEXT,
    os_details TEXT,
    mac_address TEXT,
    open_ports TEXT,
    next_hop TEXT,
    network_name TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    online_status TEXT DEFAULT 'online',
    UNIQUE(container_id, network_name)
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_hosts_ip_interface ON hosts(ip, interface_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_networks_ip ON external_networks(public_ip);
`

	if _, err := db.Exec(schema); err != nil {
		return fmt.Errorf("schema execution failed: %v", err)
	}

	// Backfill / migrate older DBs that may not have interface_name column or the unique index.
	// If the column is missing, attempt to add it. SQLite's ALTER TABLE ADD COLUMN is safe when
	// the column doesn't exist; if it already exists the following will fail which we ignore.
	_, _ = db.Exec(`ALTER TABLE hosts ADD COLUMN interface_name TEXT;`)

	// Ensure no NULL interface_name values remain (set to 'unknown' for existing records)
	_, _ = db.Exec(`UPDATE hosts SET interface_name = 'unknown' WHERE interface_name IS NULL OR interface_name = '';`)

	// Recreate unique index if missing (IF NOT EXISTS used above in schema creation, but older DBs may lack it)
	_, _ = db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_hosts_ip_interface ON hosts(ip, interface_name);`)

	return nil
}
