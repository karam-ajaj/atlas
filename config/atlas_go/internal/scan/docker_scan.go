package scan

import (
    "database/sql"
    "encoding/json"
    "fmt"
    "os/exec"
    "sort"
    "strings"
    "time"
    "strconv"

    _ "github.com/mattn/go-sqlite3"
)

type DockerContainer struct {
    ID      string
    IP      string
    Name    string
    OS      string
    MAC     string
    Ports   string
    NextHop string
    NetName string
    LastSeen   string
    State   string
}

func runCmd(cmd string, args ...string) ([]byte, error) {
    return exec.Command(cmd, args...).CombinedOutput()
}

func getDockerContainers() ([]string, error) {
    out, err := runCmd("docker", "ps", "-a", "-q")
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

    // Container ID
    cid := ""
    if rawId, ok := info["Id"].(string); ok {
        cid = rawId
    } else {
        cid = id
    }

    // State
    state := "unknown"
    if stateObj, ok := info["State"].(map[string]interface{}); ok {
        if s, ok := stateObj["Status"].(string); ok {
            state = s
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

        // OS (show the image name/tag without digest instead of the OS)
        image := ""
        osName := "unknown"
        if cfg, ok := info["Config"].(map[string]interface{}); ok {
            if img, ok := cfg["Image"].(string); ok {
                image = img
        // Only keep name:tag, drop digest if present
        if strings.Contains(image, "@") {
            osName = strings.Split(image, "@")[0]
        } else {
            osName = image
        }
    }
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
            ID:      cid,
            IP:      ip,
            Name:    name,
            OS:      osName,
            MAC:     mac,
            Ports:   portStr,
            NextHop: nextHop,
            NetName: netName,
            LastSeen: "", // will be set in DB update step
            State:   state,
        })
    }

    // If no network found, fallback with blank network
    if len(networks) == 0 {
        results = append(results, DockerContainer{
            ID:      cid,
            IP:      "",
            Name:    name,
            OS:      "unknown",
            MAC:     "",
            Ports:   "no_ports",
            NextHop: "unavailable",
            NetName: "",
            LastSeen: "",
            State:   state,
        })
    }

    return results, nil
}

var gatewayCache = make(map[string]string)

func getGateway(network, ip string) string {
    // Return the host LAN IP (first IP from `hostname -I`)
    out, err := runCmd("hostname", "-I")
    if err != nil {
        return "unavailable"
    }
    ips := strings.Fields(string(out))
    if len(ips) > 0 {
        return ips[0]
    }
    return "unavailable"
}

func isDockerInternalGateway(gateway string) bool {
    // Matches 172.16.0.1 - 172.31.0.1
    if strings.HasPrefix(gateway, "172.") && strings.HasSuffix(gateway, ".0.1") {
        octets := strings.Split(gateway, ".")
        if len(octets) == 4 {
            second, _ := strconv.Atoi(octets[1])
            if second >= 16 && second <= 31 {
                return true
            }
        }
    }
    return false
}

func updateDockerDB(containers []DockerContainer) error {
    db, err := sql.Open("sqlite3", "/config/db/atlas.db")
    if err != nil {
        return err
    }
    defer db.Close()

    knownIDs := []string{}
    for _, c := range containers {
        knownIDs = append(knownIDs, c.ID)

        onlineStatus := "offline"
        if c.State == "running" {
            onlineStatus = "online"
        }

        _, err = db.Exec(`
            INSERT INTO docker_hosts (id, ip, name, os_details, mac_address, open_ports, next_hop, network_name, last_seen, online_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                ip=excluded.ip,
                name=excluded.name,
                os_details=excluded.os_details,
                mac_address=excluded.mac_address,
                open_ports=excluded.open_ports,
                next_hop=excluded.next_hop,
                network_name=excluded.network_name,
                last_seen=excluded.last_seen,
                online_status=excluded.online_status
        `, c.ID, c.IP, c.Name, c.OS, c.MAC, c.Ports, c.NextHop, c.NetName, time.Now().Format("2006-01-02 15:04:05"), onlineStatus)
        if err != nil {
            fmt.Printf("Insert/update failed for %s: %v\n", c.ID, err)
        }
    }

    // Clean up old records by container id
    if len(knownIDs) > 0 {
        idList := "'" + strings.Join(knownIDs, "','") + "'"
        _, err = db.Exec(fmt.Sprintf("DELETE FROM docker_hosts WHERE id NOT IN (%s);", idList))
        if err != nil {
            fmt.Printf("Cleanup failed: %v\n", err)
        }
    }
    return nil
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