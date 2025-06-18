package scan

import (
    "database/sql"
    "fmt"
    "os/exec"
    "regexp"
    "strings"
    "time"

    _ "github.com/mattn/go-sqlite3"
)

func getLocalSubnet() (string, error) {
    out, err := exec.Command("ip", "-o", "-f", "inet", "addr", "show").Output()
    if err != nil {
        return "", err
    }

    re := regexp.MustCompile(`(?m)^\d+: (\w+).*?inet (\d+\.\d+\.\d+\.\d+/\d+)`)
    matches := re.FindAllStringSubmatch(string(out), -1)

    for _, match := range matches {
        iface := match[1]
        subnet := match[2]
        if iface != "lo" {
            return subnet, nil
        }
    }

    return "", fmt.Errorf("no valid non-loopback subnet found")
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

func updateSQLiteDB(hosts map[string]string) error {
    dbPath := "/config/db/atlas.db"
    db, err := sql.Open("sqlite3", dbPath)
    if err != nil {
        return err
    }
    defer db.Close()

    for ip, name := range hosts {
        _, err = db.Exec(`
            INSERT INTO hosts (ip, name, os_details, mac_address, open_ports, next_hop, network_name, last_seen)
            VALUES (?, ?, 'Unknown', 'Unknown', 'Unknown', '', '', ?)
            ON CONFLICT(ip) DO UPDATE SET
                name=excluded.name,
                last_seen=excluded.last_seen
        `, ip, name, time.Now().Format("2006-01-02 15:04:05"))
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
    subnet, err := getLocalSubnet()
    if err != nil {
        return err
    }
    fmt.Printf("Scanning subnet: %s\n", subnet)

    hosts, err := runNmap(subnet)
    if err != nil {
        return err
    }

    err = updateSQLiteDB(hosts)
    if err != nil {
        return err
    }

    updateExternalIPInDB("/config/db/atlas.db")
    return nil
}
