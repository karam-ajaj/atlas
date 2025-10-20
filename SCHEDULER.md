# Atlas Auto-Scan Scheduler

## Overview

The Atlas auto-scan scheduler is a built-in feature that automatically runs network scans at configurable intervals. This replaces the previous manual one-time scan mechanism with a persistent, configurable scheduler service.

## Features

### 1. **Automatic Periodic Scanning**
- Runs all three scans sequentially at configured intervals:
  - Fast scan (ARP/ping-based host discovery)
  - Docker scan (container inspection)
  - Deep scan (port scanning and OS fingerprinting)

### 2. **Flexible Configuration**
- **Environment Variable**: Set `ATLAS_SCAN_INTERVAL` at container deployment
- **UI Configuration**: Adjust settings anytime from the Scripts tab
- **Database Persistence**: Configuration survives container restarts

### 3. **Enable/Disable Control**
- Toggle the scheduler on/off without restarting the container
- Changes take effect within 1 minute

## Architecture

### Components

1. **Database Schema** (`config/atlas_go/internal/db/setup.go`)
   ```sql
   CREATE TABLE scheduler_config (
       id INTEGER PRIMARY KEY CHECK (id = 1),
       scan_interval_minutes INTEGER NOT NULL DEFAULT 60,
       enabled INTEGER NOT NULL DEFAULT 1,
       last_run DATETIME,
       updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **Scheduler Service** (`config/atlas_go/internal/scheduler/scheduler.go`)
   - Go-based background service
   - Checks configuration every minute
   - Executes scans when interval expires
   - Updates last_run timestamp after each scan

3. **API Endpoints** (`config/scripts/app.py`)
   - `GET /api/scheduler/config` - Retrieve current configuration
   - `POST /api/scheduler/config` - Update configuration
   ```json
   {
     "scan_interval_minutes": 60,
     "enabled": true
   }
   ```

4. **UI Component** (`data/react-ui/src/components/ScriptsPanel.jsx`)
   - Displays current scheduler status
   - Shows last run timestamp
   - Provides controls to enable/disable and set interval
   - Real-time configuration updates

5. **Startup Integration** (`config/scripts/atlas_check.sh`)
   - Launches scheduler service on container start
   - Runs as background process
   - Logs to `/config/logs/scheduler.log`

## Usage

### Deployment Configuration

Set the scan interval when starting the container:

```bash
docker run -d \
  --name atlas \
  -p 8888:8888 \
  -e ATLAS_SCAN_INTERVAL=120 \
  keinstien/atlas:latest
```

**Parameters:**
- `ATLAS_SCAN_INTERVAL`: Scan interval in minutes (default: 60)
- Minimum: 1 minute
- Maximum: 10080 minutes (1 week)

### Runtime Configuration

1. Open the Atlas UI at `http://localhost:8888`
2. Navigate to the **Scripts** tab
3. Find the "⏰ Auto-Scan Scheduler" section
4. Adjust settings:
   - Check/uncheck "Enable automatic scans"
   - Set interval in minutes
   - Click "Save"

Changes take effect within 1 minute without requiring a container restart.

### Monitoring

- **UI**: Shows last run timestamp in the Scripts tab
- **Logs**: Check `/config/logs/scheduler.log` for scan execution details
- **Database**: Query `scheduler_config` table for current settings

## Migration from Previous Version

### What Changed

**Before:**
- One-time scans executed at container startup
- No automatic recurring scans
- Manual trigger required via UI for subsequent scans

**After:**
- Automatic recurring scans based on configured interval
- First scan runs immediately on container start (unless last_run exists)
- Manual scans still available via UI
- Configurable schedule via environment variable or UI

### Backward Compatibility

- Manual scan buttons remain functional
- Same scan commands (`fastscan`, `dockerscan`, `deepscan`)
- No breaking changes to API or database schema
- Existing data preserved

## Implementation Details

### Scheduler Logic

```
Every minute:
  1. Read configuration from database
  2. Check if scheduler is enabled
  3. If disabled, skip to next iteration
  4. If enabled:
     a. Check last_run timestamp
     b. Calculate elapsed time since last run
     c. If elapsed >= interval:
        - Run fastscan
        - Run dockerscan  
        - Run deepscan
        - Update last_run timestamp
```

### Environment Variable Priority

1. On first start, check for `ATLAS_SCAN_INTERVAL` environment variable
2. If set, update database configuration
3. UI changes override environment variable for subsequent runs
4. Database configuration persists across container restarts

### Error Handling

- Individual scan failures don't stop the scheduler
- Each scan error is logged separately
- last_run timestamp updated even if scans fail
- Scheduler continues running despite errors

## Troubleshooting

### Scheduler Not Running

Check if the scheduler process is active:
```bash
docker exec atlas ps aux | grep atlas | grep scheduler
```

Check scheduler logs:
```bash
docker exec atlas cat /config/logs/scheduler.log
```

### Scans Not Executing

1. Verify scheduler is enabled:
   ```bash
   docker exec atlas sqlite3 /config/db/atlas.db "SELECT * FROM scheduler_config;"
   ```

2. Check if enough time has elapsed since last run

3. Verify atlas binary is executable:
   ```bash
   docker exec atlas ls -l /config/bin/atlas
   ```

### Configuration Not Updating

1. Check API endpoint is accessible:
   ```bash
   curl http://localhost:8888/api/scheduler/config
   ```

2. Verify database permissions:
   ```bash
   docker exec atlas ls -l /config/db/
   ```

## Development

### Building from Source

1. Build Go binary:
   ```bash
   cd config/atlas_go
   go build -o ../bin/atlas .
   ```

2. Build React UI:
   ```bash
   cd data/react-ui
   npm run build
   ```

3. Copy UI to html directory:
   ```bash
   mkdir -p data/html
   cp -r data/react-ui/dist/* data/html/
   ```

4. Build Docker image:
   ```bash
   docker build -t atlas:latest .
   ```

### Testing Scheduler

1. Start container with short interval:
   ```bash
   docker run -d --name atlas-test \
     -e ATLAS_SCAN_INTERVAL=2 \
     -p 8888:8888 \
     atlas:latest
   ```

2. Monitor scheduler activity:
   ```bash
   docker logs -f atlas-test | grep scheduler
   ```

3. Verify scans are executing:
   ```bash
   docker exec atlas-test sqlite3 /config/db/atlas.db \
     "SELECT last_run FROM scheduler_config;"
   ```

## Future Enhancements

Potential improvements for future versions:

- [ ] Separate intervals for each scan type
- [ ] Cron-style scheduling (specific times)
- [ ] Scan history and metrics
- [ ] Email/webhook notifications on scan completion
- [ ] Conditional scanning based on network changes
- [ ] Resource throttling during scans
- [ ] Multi-timezone support for scheduled times

## Support

For issues or questions:
- GitHub Issues: https://github.com/karam-ajaj/atlas/issues
- Documentation: https://github.com/karam-ajaj/atlas/blob/main/README.md
