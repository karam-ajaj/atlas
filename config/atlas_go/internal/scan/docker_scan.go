package scan

import (
    "database/sql"
    "encoding/json"
    "fmt"
    "os/exec"
    "sort"
    "strings"
    "time"

    _ "github.com/mattn/go-sqlite3"
)

import "atlas/internal/utils"

type DockerContainer struct {
    ID      string
    Name    string
    Image   string
    OS      string
    IP      string
    MAC     string
    Ports   string
    NetName string
    NextHop string
}

func runCmd(cmd string, args ...string) ([]byte, error) {
    return exec.Command(cmd, args...).CombinedOutput()
}

func getDockerContainers() ([]string, error) {
    out, err := runCmd("docker", "ps", "-q")
    if err != nil {
        return nil, err
    }
    ids := strings.Fields(string(out))
    return ids, nil
}

func inspectContainer(id string) ([]DockerContainer, error) {
    out, err := runCmd("docker", "inspect", id)
    if err != nil {
        return nil, err
    }

    var data []map[string]interface{}
    if err := json.Unmarshal(out, &data); err != nil {
        return nil, err
    }
    if len(data) == 0 {
        return nil, fmt.Errorf("no inspect data for container %s", id)
    }

    var results []DockerContainer
    info := data[0]

    // Name
    name := ""
    if n, ok := info["Name"].(string); ok {
        name = strings.TrimPrefix(n, "/")
    }

    // Image
    image := ""
    if cfg, ok := info["Config"].(map[string]interface{}); ok {
        if img, ok := cfg["Image"].(string); ok {
            image = img
        }
    }

    // Networks
    networks := map[string]interface{}{}
    if ns, ok := info["NetworkSettings"].(map[string]interface{}); ok {
        if nets, ok := ns["Networks"].(map[string]interface{}); ok {
            networks = nets
        }
    }
    for netName, netData := range networks {
        ip := ""
        mac := ""
        netMap, _ := netData.(map[string]interface{})
        if v, ok := netMap["IPAddress"].(string); ok {
            ip = v
        }
        if v, ok := netMap["MacAddress"].(string); ok {
            mac = v
        }

        // OS
        osOut, _ := runCmd("docker", "image", "inspect", image, "--format", "{{.Os}}")
        osName := strings.TrimSpace(string(osOut))
        if osName == "" {
            osName = "unknown"
        }

        // Ports
        portOut, _ := runCmd("docker", "inspect", id)
        var portData []map[string]interface{}
        json.Unmarshal(portOut, &portData)
        ports := []string{}
        if len(portData) > 0 {
            if ns, ok := portData[0]["NetworkSettings"].(map[string]interface{}); ok {
                if pmap, ok := ns["Ports"].(map[string]interface{}); ok {
                    for port, val := range pmap {
                        if val == nil {
                            ports = append(ports, fmt.Sprintf("%s (internal)", port))
                        } else {
                            arr, arrOK := val.([]interface{})
                            if arrOK && len(arr) > 0 {
                                entry, entryOK := arr[0].(map[string]interface{})
                                if entryOK {
                                    hIp, hIpOK := entry["HostIp"].(string)
                                    hPort, hPortOK := entry["HostPort"].(string)
                                    if hIpOK && hPortOK {
                                        ports = append(ports, fmt.Sprintf("%s -> %s:%s", port, hIp, hPort))
                                    } else {
                                        ports = append(ports, fmt.Sprintf("%s (internal)", port))
                                    }
                                } else {
                                    ports = append(ports, fmt.Sprintf("%s (internal)", port))
                                }
                            } else {
                                ports = append(ports, fmt.Sprintf("%s (internal)", port))
                            }
                        }
                    }
                }
            }
        }
        sort.Strings(ports)
        portStr := "no_ports"
        if len(ports) > 0 {
            portStr = strings.Join(ports, ",")
        }

        nextHop := getGateway(netName, ip)

        results = append(results, DockerContainer{
            ID:      id,
            Name:    name,
            Image:   image,
            OS:      osName,
            IP:      ip,
            MAC:     mac,
            Ports:   portStr,
            NetName: netName,
            NextHop: nextHop,
        })
    }

    return results, nil
}

var gatewayCache = make(map[string]string)

func getGateway(network, ip string) string {
    out, err := runCmd("hostname", "-I")
    if err != nil {
        return "unavailable"
    }
    fields := strings.Fields(string(out))
    for _, addr := range fields {
        if strings.HasPrefix(addr, "192.168.") {
            return addr
        }
    }
    if len(fields) > 0 {
        return fields[0]
    }
    return "unavailable"
}

func updateDockerDB(containers []DockerContainer) error {
    db, err := sql.Open("sqlite3", "/config/db/atlas.db")
    if err != nil {
        return err
    }
    defer db.Close()

    knownIPs := []string{}
    for _, c := range containers {
        knownIPs = append(knownIPs, c.IP)

        status := utils.PingHost(c.IP)

        _, err = db.Exec(`
            INSERT INTO docker_hosts (ip, name, os_details, mac_address, open_ports, next_hop, network_name, last_seen, online_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'online')
            ON CONFLICT(ip) DO UPDATE SET
                name=excluded.name,
                os_details=excluded.os_details,
                mac_address=excluded.mac_address,
                open_ports=excluded.open_ports,
                next_hop=excluded.next_hop,
                network_name=excluded.network_name,
                last_seen=excluded.last_seen,
                online_status=excluded.online_status
        `, c.IP, c.Name, c.OS, c.MAC, c.Ports, c.NextHop, c.NetName, time.Now().Format("2006-01-02 15:04:05"), status)
        if err != nil {
            fmt.Printf("Insert/update failed for %s: %v\n", c.IP, err)
        }
    }

    // Clean up old records
    ipList := "'" + strings.Join(knownIPs, "','") + "'"
    _, err = db.Exec(fmt.Sprintf("DELETE FROM docker_hosts WHERE ip NOT IN (%s);", ipList))
    return err
}

func DockerScan() error {
    ids, err := getDockerContainers()
    if err != nil {
        return err
    }

    var allContainers []DockerContainer
    for _, id := range ids {
        containers, err := inspectContainer(id)
        if err != nil {
            fmt.Printf("Skipping container %s: %v\n", id, err)
            continue
        }
        allContainers = append(allContainers, containers...)
    }

    return updateDockerDB(allContainers)
}