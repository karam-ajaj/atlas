package scan

import (
    "database/sql"
    "fmt"
    "os/exec"
    "strings"
    "time"

    _ "github.com/mattn/go-sqlite3"
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
func updateSQLiteDB(hosts map[string]string, gatewayIP string) error {
    dbPath := "/config/db/atlas.db"
    db, err := sql.Open("sqlite3", dbPath)
    if err != nil {
        return err
    }
    defer db.Close()

    // Mark all hosts as offline before scanning
    _, err = db.Exec("UPDATE hosts SET online_status = 'offline'")
    if err != nil {
        fmt.Printf("Failed to mark hosts as offline: %v\n", err)
    }

    for ip, name := range hosts {
        _, err = db.Exec(`
            INSERT INTO hosts (ip, name, os_details, mac_address, open_ports, next_hop, network_name, last_seen, online_status)
            VALUES (?, ?, 'Unknown', 'Unknown', 'Unknown', ?, 'LAN', CURRENT_TIMESTAMP, 'online')
            ON CONFLICT(ip) DO UPDATE SET
                name=excluded.name,
                last_seen=excluded.last_seen,
                online_status=excluded.online_status,
                next_hop=excluded.next_hop
        `, ip, name, gatewayIP, time.Now().Format("2006-01-02 15:04:05"))
        if err != nil {
            fmt.Printf("Insert/update failed for %s: %v\n", ip, err)
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

    db, err := sql.Open("sqlite3", dbPath)
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
    subnet, err := utils.GetLocalSubnet()
    if err != nil {
        return err
    }
    fmt.Printf("Scanning subnet: %s\n", subnet)

    hosts, err := runNmap(subnet)
    if err != nil {
        return err
    }

    gatewayIP, err := getDefaultGateway()
    if err != nil {
        fmt.Println("⚠️ Could not determine gateway:", err)
        gatewayIP = ""
    }

    err = updateSQLiteDB(hosts, gatewayIP)
    if err != nil {
        return err
    }

    updateExternalIPInDB("/config/db/atlas.db")
    return nil
}