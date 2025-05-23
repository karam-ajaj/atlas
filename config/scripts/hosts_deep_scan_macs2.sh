#!/usr/bin/env bash
#
# hosts_deep_scan_macs.sh
# A more robust deep scan + MAC/OS grab for Atlas

set -euo pipefail
IFS=$'\n\t'

### User-configurable paths & retention
LOG_DIR="/config/logs"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_SETUP="$SCRIPT_DIR/db_setup.sh"
PARSER="$SCRIPT_DIR/parse_nmap.py"
LOCKFILE="/tmp/hosts_deep_scan.lock"
RETENTION_DAYS=7

### Initialize environment
mkdir -p "$LOG_DIR"
exec 3>>"$LOG_DIR/scan_audit.log"     # FD 3 for our audit log

log() { echo "[$(date --iso-8601=seconds)] $*" >&3; }

cleanup() {
  rm -f "$LOCKFILE"
  log "Cleanup complete, exiting."
}
trap cleanup EXIT

# Prevent double‐runs
if ! ln -s "$$" "$LOCKFILE" 2>/dev/null; then
  echo "Another scan ($(<"$LOCKFILE")) is already running; aborting." >&2
  exit 1
fi

log "=== Starting deep MAC/OS scan ==="

### System snapshot
log "Collecting system info"
uname -a > "$LOG_DIR/uname.log"
ip -4 addr show | grep -E 'inet ' > "$LOG_DIR/ip.log"
arp -an > "$LOG_DIR/arp.log"

### Detect default interface + subnet
log "Detecting default interface and subnet"
DEFAULT_IF=$(ip route show default | awk '/default/ {print $5; exit}')
CIDR=$(ip -4 -o addr show dev "$DEFAULT_IF" \
       | awk '{print $4}' | head -n1)

log "Using interface: $DEFAULT_IF (subnet: $CIDR)"

### Quick “ping” scan to harvest MACs
log "Running quick ping scan for MAC addresses"
nmap -sn "$CIDR" -oX "$LOG_DIR/nmap_mac.xml"

### Full TCP scan + OS detection
log "Running full TCP/OS scan (may take a while)"
nmap -O -sS -p- "$CIDR" -oX "$LOG_DIR/nmap_full.xml"

### Ensure database table exists
log "Ensuring database schema is ready"
bash "$DB_SETUP"

### Parse results & load into DB
log "Parsing scan output and writing to DB"
if [[ -x "$PARSER" ]]; then
  python3 "$PARSER" \
    --mac-xml "$LOG_DIR/nmap_mac.xml" \
    --full-xml "$LOG_DIR/nmap_full.xml" \
    >> "$LOG_DIR/parse.log" 2>&1
  log "Parse script completed"
else
  log "Warning: parser not found or not executable: $PARSER"
fi

### Collect disk‐usage snapshot
log "Saving disk usage stats"
df -h > "$LOG_DIR/df.log"

### Rotate old logs
log "Cleaning up logs older than $RETENTION_DAYS days"
find "$LOG_DIR" -type f -mtime +"$RETENTION_DAYS" -print -delete

log "=== Scan finished successfully ==="
