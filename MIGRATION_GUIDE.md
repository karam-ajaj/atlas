# Migration Guide: Multiple IPs and MACs Support

## Overview

This update adds support for Docker containers with multiple network interfaces. Each container can now have multiple IP addresses and MAC addresses stored in the database, one entry per network interface.

## What Changed

### Database Schema
The `docker_hosts` table schema has been updated:

**Before:**
```sql
CREATE TABLE docker_hosts (
    id TEXT PRIMARY KEY,  -- Container ID
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
```

**After:**
```sql
CREATE TABLE docker_hosts (
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
```

### Key Changes
1. **Primary Key**: Changed from container ID (TEXT) to auto-increment integer
2. **New Column**: Added `container_id` field to store the Docker container ID
3. **Unique Constraint**: Added on `(container_id, network_name)` to allow multiple rows per container
4. **Multiple Rows**: Each network interface now gets its own row in the database

## Migration Steps

### Automatic Migration (Recommended)

The easiest way to migrate is to let Atlas rebuild the database:

1. **Backup your current database** (optional but recommended):
   ```bash
   docker exec atlas cp /config/db/atlas.db /config/db/atlas.db.backup
   docker cp atlas:/config/db/atlas.db.backup ./atlas-backup-$(date +%Y%m%d).db
   ```

2. **Stop the Atlas container:**
   ```bash
   docker stop atlas
   docker rm atlas
   ```

3. **Pull the latest image and restart:**
   ```bash
   docker pull keinstien/atlas:latest
   docker run -d \
     --name atlas \
     --network=host \
     --cap-add=NET_RAW \
     --cap-add=NET_ADMIN \
     -v /var/run/docker.sock:/var/run/docker.sock \
     keinstien/atlas:latest
   ```

4. **The database will be recreated** with the new schema on first run

### Manual Migration

If you want to preserve existing data, you can manually migrate:

```bash
# Connect to your database
sqlite3 /config/db/atlas.db

# Rename old table
ALTER TABLE docker_hosts RENAME TO docker_hosts_old;

# Create new table
CREATE TABLE docker_hosts (
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

# Copy data (old 'id' becomes 'container_id')
INSERT INTO docker_hosts (container_id, ip, name, os_details, mac_address, open_ports, next_hop, network_name, last_seen, online_status)
SELECT id, ip, name, os_details, mac_address, open_ports, next_hop, network_name, last_seen, online_status
FROM docker_hosts_old;

# Verify migration
SELECT COUNT(*) FROM docker_hosts;

# Drop old table
DROP TABLE docker_hosts_old;
```

## Behavior Changes

### Before
- Each container appeared as a single row, even if it had multiple network interfaces
- Only one IP and MAC address could be stored per container
- Containers on multiple networks would overwrite previous network data

### After
- Each container appears as multiple rows (one per network interface)
- All IPs and MAC addresses are stored
- Searching by container name will show all its network interfaces
- The UI displays each network interface as a separate row in the hosts table

## Example

A container named "web-server" connected to three networks will now appear as:

| ID | Container ID | Name       | IP            | MAC               | Network      | Status |
|----|------------- |------------|---------------|-------------------|--------------|--------|
| 1  | abc123...    | web-server | 172.18.0.10   | 02:42:ac:12:00:0a | bridge       | online |
| 2  | abc123...    | web-server | 192.168.100.5 | 02:42:c0:a8:64:05 | frontend-net | online |
| 3  | abc123...    | web-server | 10.0.20.15    | 02:42:0a:00:14:0f | backend-net  | online |

## API Response Format

The `/api/hosts` endpoint returns data in the same array format, but docker containers with multiple networks will have multiple entries in the array.

**Example Response:**
```json
[
  [...],  // hosts table rows
  [       // docker_hosts table rows
    [1, "abc123def456", "172.18.0.10", "web-server", "nginx:alpine", "02:42:ac:12:00:0a", "80/tcp,443/tcp", "172.18.0.1", "bridge", "2024-01-15 10:30:00", "online"],
    [2, "abc123def456", "192.168.100.5", "web-server", "nginx:alpine", "02:42:c0:a8:64:05", "80/tcp,443/tcp", "192.168.100.1", "frontend-net", "2024-01-15 10:30:00", "online"],
    [3, "abc123def456", "10.0.20.15", "web-server", "nginx:alpine", "02:42:0a:00:14:0f", "80/tcp,443/tcp", "10.0.20.1", "backend-net", "2024-01-15 10:30:00", "online"]
  ]
]
```

## Troubleshooting

### Issue: Database is locked
**Solution:** Stop all Atlas processes and retry:
```bash
docker exec atlas pkill -f atlas
docker exec atlas pkill -f uvicorn
```

### Issue: Old data not showing
**Solution:** The database was recreated. If you need old data, restore from backup and run manual migration.

### Issue: Duplicate entries in UI
**Solution:** This is expected! Each network interface is a separate entry. Use the "Network" filter to view specific networks.

## Compatibility

- ✅ **Forward Compatible**: New schema works with old and new data
- ⚠️ **Not Backward Compatible**: Old code cannot read the new schema properly
- 🔄 **Recommendation**: Update to the latest version and rebuild database

## Questions?

For issues or questions, please open an issue on GitHub: https://github.com/karam-ajaj/atlas/issues
