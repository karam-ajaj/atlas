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
    var ip, name string
    for _, line := range strings.Split(string(out), "\n") {
        if strings.HasPrefix(line, "Nmap scan report for") {
            parts := strings.Fields(line)
            if len(parts) == 5 {
                name = parts[4]
                ip = strings.Trim(parts[5], "()")
            } else {
                name = "NoName"
                ip = parts[4]
            }
            hosts[ip] = name
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

    return updateSQLiteDB(hosts)
}
