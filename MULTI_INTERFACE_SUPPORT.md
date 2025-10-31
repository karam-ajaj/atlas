# Multi-Interface Scanning Support

## Overview

Atlas now supports scanning all physical network interfaces on the host machine, allowing it to discover and monitor devices on multiple networks simultaneously.

## What Changed

### 1. Database Schema
- Added `interface_name` field to the `hosts` table
- Updated unique constraint from `ip` to `(ip, interface_name)` combination
- This allows the same IP address to exist on different network interfaces

### 2. Network Interface Detection
- New utility function `GetAllInterfaces()` detects all non-loopback network interfaces
- Automatically discovers interface names, IP addresses, and subnets
- Replaces the previous single-interface detection logic

### 3. Scanning Changes

#### Fast Scan (`fastscan.go`)
- Now scans all detected network interfaces
- Each host is associated with its network interface
- Hosts are marked offline per-interface before scanning

#### Deep Scan (`deep_scan.go`)
- Scans all detected network interfaces
- Deep port and OS detection for hosts on all interfaces
- Associates scan results with specific interfaces

### 4. UI Updates

#### Network Map
- Hosts on multiple interfaces appear as separate nodes
- Node labels include interface name (e.g., "server1 (eth0)")
- Tooltips show interface information
- Unique node IDs include interface name to prevent conflicts

#### Hosts Table
- New "Interface" column showing which interface each host is on
- Interface column is included in "Basic" view
- Can filter and search by interface name

## Database Structure

### Hosts Table Schema
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
    interface_name TEXT,           -- NEW FIELD
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    online_status TEXT DEFAULT 'online'
);

CREATE UNIQUE INDEX idx_hosts_ip_interface ON hosts(ip, interface_name);
```

## Example Scenarios

### Scenario 1: Server with Multiple NICs
A server with two network interfaces:
- `eth0` connected to 192.168.1.0/24 (production network)
- `eth1` connected to 10.0.0.0/24 (management network)

Atlas will:
1. Detect both interfaces
2. Scan both networks
3. Display the server twice in the UI (once per interface)
4. Show containers connected to the appropriate host instance

### Scenario 2: Multi-Homed Host
A host accessible on multiple networks will appear as:
- `192.168.1.10 (eth0)` - Production network
- `192.168.1.10 (eth1)` - Backup network

## Configuration

### Automatic Detection (Default)
Atlas automatically detects all network interfaces:
```bash
# No configuration needed - scans all interfaces
docker run atlas
```

### Manual Override
You can still manually specify subnets via environment variable:
```bash
docker run -e SCAN_SUBNETS="192.168.1.0/24,10.0.0.0/24" atlas
```

Note: When using `SCAN_SUBNETS`, interface names are inferred from the detected interfaces that match those subnets.

## Future Enhancements

### Agent Support (Planned)
The schema is designed to support future agent-based monitoring:
- Remote agents can report hosts from their local interfaces
- Central Atlas server aggregates data from multiple agents
- Each agent's interface information is preserved
- Enables visualization of complex multi-site networks

### Visualization Improvements (Planned)
- Grouping hosts by interface
- Interface-level health metrics
- Network topology per interface
- Interface-specific filtering in network map

## Testing

### Test Interface Detection
```bash
cd /home/runner/work/atlas/atlas/config/atlas_go
./atlas fastscan
# Should show "Scanning subnet: X.X.X.0/24 on interface ethX" for each interface
```

### Verify Database
```bash
sqlite3 /config/db/atlas.db "SELECT ip, name, interface_name FROM hosts ORDER BY ip, interface_name;"
```

### Check UI
1. Open Atlas web UI
2. Go to Hosts Table
3. Verify "Interface" column appears with interface names
4. Go to Network Map
5. Verify hosts appear with interface names in labels

## Migration Notes

### No Migration Needed
Since the database is rebuilt on container startup (non-persistent), no migration is required. The new schema will be created automatically.

### For Persistent Deployments
If you've modified Atlas to use persistent storage:
```sql
-- Add the interface_name column
ALTER TABLE hosts ADD COLUMN interface_name TEXT;

-- Drop old index
DROP INDEX IF EXISTS idx_hosts_ip;

-- Create new composite unique index
CREATE UNIQUE INDEX idx_hosts_ip_interface ON hosts(ip, interface_name);

-- Update existing records to have a default interface
UPDATE hosts SET interface_name = 'eth0' WHERE interface_name IS NULL;
```

## Troubleshooting

### No Interfaces Detected
If no interfaces are detected:
1. Check container has access to host network: `docker run --network host`
2. Verify `ip` command is available in container
3. Check logs for interface detection errors

### Duplicate Hosts in UI
This is expected behavior when a host has multiple network interfaces. Each instance represents the host on a different network.

### Missing Interface Names
If interface_name shows "N/A":
- Older data before this update
- Interface detection failed
- Manual subnet configuration was used

## Benefits

1. **Complete Network Visibility**: See all networks your host is connected to
2. **Multi-Network Monitoring**: Monitor devices on multiple subnets simultaneously
3. **Better Network Understanding**: Understand network topology across interfaces
4. **Agent Readiness**: Schema prepared for future distributed monitoring
5. **Flexible Configuration**: Works automatically or with manual configuration
