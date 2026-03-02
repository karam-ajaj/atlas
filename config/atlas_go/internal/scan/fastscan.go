package scan

import (
    "database/sql"
    "fmt"
    "os"
    "os/exec"
    "strings"
    "time"

    _ "modernc.org/sqlite"
    "atlas/internal/utils"
)

// POINT 1: Get the default gateway IP (internal)
func getDefaultGateway() (string, error) {
    out, err := exec.Command("ip", "route").Output()
    if err != nil {
        return "", err
    }
    for _, line := range strings.Split(string(out), "\n") {
        if strings.HasPrefix(line, "default") {
            fields := strings.Fields(line)
            for i, f := range fields {
                if f == "via" && i+1 < len(fields) {
                    return fields[i+1], nil
                }
            }
        }
    }
    return "", fmt.Errorf("no default gateway found")
}

func runNmap(subnet string) (map[string]string, error) {
    out, err := exec.Command("nmap", "-sn", subnet).Output()
    if err != nil {
        return nil, err
    }

    hosts := make(map[string]string)
    for _, line := range strings.Split(string(out), "\n") {
        if strings.HasPrefix(line, "Nmap scan report for") {
            fields := strings.Fields(line)
            if len(fields) == 6 && strings.HasPrefix(fields[5], "(") {
                name := fields[4]
                ip := strings.Trim(fields[5], "()")
                hosts[ip] = name
            } else if len(fields) == 5 {
                ip := fields[4]
                name := "NoName"
                hosts[ip] = name
            }
        }
    }
    return hosts, nil
}

// POINT 2: Assign next_hop for LAN hosts to the gateway IP
func updateSQLiteDB(hosts map[string]string, gatewayIP string, interfaceName string) error {
    dbPath := "/config/db/atlas.db"
    db, err := sql.Open("sqlite", dbPath)
    if err != nil {
        return err
    }
    defer db.Close()

    // Mark all hosts as offline before scanning (only for this specific interface)
    _, err = db.Exec("UPDATE hosts SET online_status = 'offline' WHERE interface_name = ?", interfaceName)
    if err != nil {
        fmt.Printf("Failed to mark hosts as offline for interface %s: %v\n", interfaceName, err)
    }

    for ip, name := range hosts {
        _, err = db.Exec(`
            INSERT INTO hosts (ip, name, os_details, mac_address, open_ports, next_hop, network_name, interface_name, last_seen, online_status)
            VALUES (?, ?, 'Unknown', 'Unknown', 'Unknown', ?, 'LAN', ?, CURRENT_TIMESTAMP, 'online')
            ON CONFLICT(ip, interface_name) DO UPDATE SET
                name=excluded.name,
                last_seen=excluded.last_seen,
                online_status=excluded.online_status,
                next_hop=excluded.next_hop
        `, ip, name, gatewayIP, interfaceName, time.Now().Format("2006-01-02 15:04:05"))
        if err != nil {
            fmt.Printf("Insert/update failed for %s on interface %s: %v\n", ip, interfaceName, err)
        }
    }

    return nil
}

func updateExternalIPInDB(dbPath string) {
    urls := []string{
        "https://ifconfig.me",
        "https://api.ipify.org",
    }

    var ip string
    for _, url := range urls {
        out, err := exec.Command("curl", "-s", url).Output()
        if err == nil && len(out) > 0 {
            ip = strings.TrimSpace(string(out))
            break
        }
    }

    if ip == "" {
        fmt.Println("⚠️ Could not determine external IP")
        return
    }

    db, err := sql.Open("sqlite", dbPath)
    if err != nil {
        fmt.Println("❌ Failed to open DB:", err)
        return
    }
    defer db.Close()

    _, _ = db.Exec(`
        INSERT OR IGNORE INTO external_networks (public_ip)
        VALUES (?)
    `, ip)

    _, _ = db.Exec(`
        UPDATE external_networks
        SET last_seen = CURRENT_TIMESTAMP
        WHERE public_ip = ?
    `, ip)

    fmt.Println("🌐 External IP recorded:", ip)
}

func FastScan() error {
    // progress log similar to deep scan
    logFile := "/config/logs/fast_scan_progress.log"
    lf, _ := os.Create(logFile)
    if lf == nil {
        // fallback to stdout only
        return fastScanCore(nil)
    }
    defer lf.Close()
    start := time.Now()
    fmt.Fprintf(lf, "🚀 Fast scan started at %s\n", start.Format(time.RFC3339))
    err := fastScanCore(lf)
    fmt.Fprintf(lf, "Fast scan complete in %s\n", time.Since(start))
    return err
}

func fastScanCore(lf *os.File) error {
    logf := func(format string, args ...any) {
        msg := fmt.Sprintf(format, args...)
        fmt.Println(msg)
        if lf != nil {
            fmt.Fprintln(lf, msg)
        }
    }

    // Get all network interfaces
    interfaces, err := utils.GetAllInterfaces()
    if err != nil {
        return fmt.Errorf("failed to detect network interfaces: %v", err)
    }

    gatewayIP, err := getDefaultGateway()
    if err != nil {
        logf("⚠️ Could not determine gateway: %v", err)
        gatewayIP = ""
    }

    totalHosts := 0
    // Scan each interface separately
    for _, iface := range interfaces {
        logf("Discovering live hosts on %s (interface: %s)...", iface.Subnet, iface.Name)
        hosts, err := runNmap(iface.Subnet)
        if err != nil {
            logf("⚠️ Failed to scan subnet %s on interface %s: %v", iface.Subnet, iface.Name, err)
            continue
        }
        logf("Discovered %d hosts on %s", len(hosts), iface.Subnet)
        totalHosts += len(hosts)

        // Update database with hosts from this interface
        err = updateSQLiteDB(hosts, gatewayIP, iface.Name)
        if err != nil {
            logf("⚠️ Failed to update database for interface %s: %v", iface.Name, err)
            continue
        }
    }

    updateExternalIPInDB("/config/db/atlas.db")
    logf("Total hosts updated: %d", totalHosts)
    return nil
}