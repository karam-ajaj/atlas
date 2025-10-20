# Migration Guide

## Overview

This guide covers two major updates:
1. **Multiple IPs and MACs Support** for Docker containers with multiple network interfaces
2. **Multi-Interface Network Scanning** to scan all physical network interfaces on the host

---

## Update 1: Multiple IPs and MACs Support

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

---

## Update 2: Multi-Interface Network Scanning

### Overview

Atlas now automatically detects and scans all physical network interfaces on the host system, not just the first non-loopback interface. This allows comprehensive network discovery on systems with multiple network adapters.

### What Changed

#### Database Schema - hosts table
The `hosts` table has been updated to track which interface each host was discovered on:

**New Columns Added:**
- `interface_name TEXT` - Name of the network interface (e.g., eth0, ens160, ens192)
- `subnet TEXT` - Full subnet CIDR notation (e.g., 192.168.1.0/24)

**Updated Schema:**
```sql
CREATE TABLE hosts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT,
    name TEXT,
    os_details TEXT,
    mac_address TEXT,
    open_ports TEXT,
    next_hop TEXT,
    network_name TEXT,
    interface_name TEXT,     -- NEW
    subnet TEXT,             -- NEW
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    online_status TEXT DEFAULT 'online'
);
```

### Key Features

1. **Automatic Interface Detection**: Scans all non-loopback, non-docker interfaces
2. **Per-Interface Gateway Detection**: Identifies the gateway for each interface
3. **Subnet Tracking**: Stores complete subnet information for each discovered host
4. **UI Updates**: Interface and subnet information displayed in the hosts table

### Behavior Changes

#### Before
- Only the first non-loopback interface was scanned
- Systems with multiple network interfaces (e.g., ens160, ens192) would miss hosts on secondary interfaces
- No tracking of which interface a host was discovered on

#### After
- All physical network interfaces are automatically detected and scanned
- Each interface's subnet is scanned independently
- Gateway is determined per-interface
- UI displays interface name and subnet for each host

### Migration Steps

The migration is automatic when you upgrade to the new version:

1. **Backup your database** (recommended):
   ```bash
   docker exec atlas cp /config/db/atlas.db /config/db/atlas.db.backup
   docker cp atlas:/config/db/atlas.db.backup ./atlas-backup-$(date +%Y%m%d).db
   ```

2. **Update to the latest version:**
   ```bash
   docker pull keinstien/atlas:latest
   docker stop atlas
   docker rm atlas
   docker run -d \
     --name atlas \
     --network=host \
     --cap-add=NET_RAW \
     --cap-add=NET_ADMIN \
     -v /var/run/docker.sock:/var/run/docker.sock \
     keinstien/atlas:latest
   ```

3. **Database schema updates automatically** on first run via `CREATE TABLE IF NOT EXISTS`

4. **Existing hosts will have NULL values** for `interface_name` and `subnet` until the next scan

### Example Output

When running a scan on a system with two network interfaces:

```
Found 2 network interface(s) to scan
Scanning subnet: 192.168.1.0/24 on interface: eth0
Scanning subnet: 10.0.0.0/16 on interface: eth1
```

### Example Data

After the scan, the hosts table will contain entries like:

| IP          | Name        | Interface | Subnet         | Gateway     |
|-------------|-------------|-----------|----------------|-------------|
| 192.168.1.5 | server01    | eth0      | 192.168.1.0/24 | 192.168.1.1 |
| 192.168.1.8 | workstation | eth0      | 192.168.1.0/24 | 192.168.1.1 |
| 10.0.0.10   | nas01       | eth1      | 10.0.0.0/16    | 10.0.0.1    |

### UI Changes

The Hosts Table now includes:
- **Interface** column showing the network interface name
- **Subnet** column with complete subnet CIDR
- Filterable by interface and subnet
- Search includes interface name

### Troubleshooting

#### Issue: Not all interfaces being scanned
**Solution:** Check that interfaces are not named "docker*" or "br-*" as these are filtered out by default. Check available interfaces with:
```bash
docker exec atlas ip -o -f inet addr show
```

#### Issue: Gateway not detected for an interface
**Solution:** Verify routing table has a default route for that interface:
```bash
docker exec atlas ip route
```

### Compatibility

- ✅ **Forward Compatible**: New columns have default NULL values
- ✅ **Backward Compatible**: Old code will ignore new columns
- 🔄 **Recommended**: Update UI to display new interface information

### Technical Details

**Code Changes:**
- `GetLocalSubnets()` returns all non-loopback interfaces with subnet information
- `FastScan()` and `DeepScan()` iterate over all detected interfaces
- `getGatewayForInterface()` determines the gateway for each specific interface
- Database inserts include `interface_name` and `subnet` fields

**Filtered Interfaces:**
- Loopback (127.0.0.0/8)
- Docker bridges (docker*, br-*)

### Benefits

1. **Complete Network Discovery**: No more missing hosts on secondary interfaces
2. **Better Network Topology**: Understand which subnet each host belongs to
3. **Multi-Homed Systems**: Properly scan systems with multiple network connections
4. **Improved Troubleshooting**: Know which interface is used to reach each host
