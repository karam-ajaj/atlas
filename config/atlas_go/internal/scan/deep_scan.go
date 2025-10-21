package scan

import (
	"bufio"
	"database/sql"
	"fmt"
	"net"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"atlas/internal/utils"
)

// Use - for all ports (TCP/UDP)
const tcpPortArg = "-"
// const udpPortArg = "-" // UDP scan commented 

type HostInfo struct {
	IP   string
	Name string
}

// Try NetBIOS (nbtscan) for hostname resolution
func getNetBIOSName(ip string) string {
	out, err := exec.Command("nbtscan", ip).Output()
	if err != nil {
		return ""
	}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		fields := strings.Fields(line)
		// nbtscan output format: IP Name <other info>
		if len(fields) >= 2 && fields[0] == ip {
			return fields[1]
		}
	}
	return ""
}

// Returns best available host name using nmap, reverse DNS, NetBIOS
func bestHostName(ip string, nmapName string) string {
	if nmapName != "" && nmapName != "NoName" {
		return nmapName
	}
	name := getHostName(ip)
	if name != "" && name != "NoName" {
		return name
	}
	name = getNetBIOSName(ip)
	if name != "" {
		return name
	}
	return "NoName"
}

func discoverLiveHosts(subnet string) ([]HostInfo, error) {
	out, err := exec.Command("nmap", "-sn", subnet).Output()
	if err != nil {
		return nil, err
	}
	var hosts []HostInfo
	for _, line := range strings.Split(string(out), "\n") {
		if strings.HasPrefix(line, "Nmap scan report for") {
			fields := strings.Fields(line)
			if len(fields) == 6 && strings.HasPrefix(fields[5], "(") {
				name := fields[4]
				ip := strings.Trim(fields[5], "()")
				hosts = append(hosts, HostInfo{IP: ip, Name: name})
			} else if len(fields) == 5 {
				ip := fields[4]
				hosts = append(hosts, HostInfo{IP: ip, Name: "NoName"})
			}
		}
	}
	return hosts, nil
}

// Parse nmap port string to human-readable form (show only open/filtered)
func parseNmapPorts(s string) string {
	parts := strings.Split(s, ",")
	var readable []string
	for _, p := range parts {
		fields := strings.Split(p, "/")
		if len(fields) < 5 {
			continue
		}
		state := fields[1]
		proto := fields[2]
		service := fields[4]
		port := fields[0]
		if state == "open" || state == "filtered" {
			if service != "" {
				readable = append(readable, fmt.Sprintf("%s/%s (%s)", port, proto, service))
			} else {
				readable = append(readable, fmt.Sprintf("%s/%s", port, proto))
			}
		}
	}
	if len(readable) == 0 {
		return "Unknown"
	}
	return strings.Join(readable, ", ")
}

func scanAllTcp(ip string, logProgress *os.File) (string, string) {
	logFile := fmt.Sprintf("/config/logs/nmap_tcp_%s.log", strings.ReplaceAll(ip, ".", "_"))
	nmapArgs := []string{"-O", "-p-", ip, "-oG", logFile}
	start := time.Now()
	cmd := exec.Command("nmap", nmapArgs...)
	cmd.Run()
	elapsed := time.Since(start)
	fmt.Fprintf(logProgress, "TCP scan for %s finished in %s\n", ip, elapsed)

	file, err := os.Open(logFile)
	if err != nil {
		return "Unknown", "Unknown"
	}
	defer file.Close()

	var ports string
	var osInfo string
	// Match all text between Ports: and Ignored State: 
	rePorts := regexp.MustCompile(`Ports: ([^\n]*?)Ignored State:`)
	reOS := regexp.MustCompile(`OS: (.*)`)

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if m := rePorts.FindStringSubmatch(line); m != nil {
			ports = parseNmapPorts(m[1])
		}
		if m := reOS.FindStringSubmatch(line); m != nil {
			rawOs := m[1]
			osInfo = strings.SplitN(rawOs, "\t", 2)[0]
			if idx := strings.Index(osInfo, "Seq Index:"); idx != -1 {
				osInfo = strings.TrimSpace(osInfo[:idx])
			}
			osInfo = strings.TrimSpace(osInfo)
		}
	}
	if ports == "" {
		ports = "Unknown"
	}
	return ports, osInfo
}

// func scanAllUdp(ip string, logProgress *os.File) string {
// 	nmapArgs := []string{"-sU", "-p-", ip, "-oG", "/config/logs/nmap_udp.log"}
// 	start := time.Now()
// 	cmd := exec.Command("nmap", nmapArgs...)
// 	cmd.Run()
// 	elapsed := time.Since(start)
// 	fmt.Fprintf(logProgress, "UDP scan for %s finished in %s\n", ip, elapsed)

// 	file, err := os.Open("/config/logs/nmap_udp.log")
// 	if err != nil {
// 		return "Unknown"
// 	}
// 	defer file.Close()

// 	var ports string
// 	rePorts := regexp.MustCompile(`Ports: ([^ ]+)`)

// 	scanner := bufio.NewScanner(file)
// 	for scanner.Scan() {
// 		line := scanner.Text()
// 		if m := rePorts.FindStringSubmatch(line); m != nil {
// 			ports = parseNmapPorts(m[1])
// 		}
// 	}
// 	return ports
// }

func getHostName(ip string) string {
	names, err := net.LookupAddr(ip)
	if err != nil || len(names) == 0 {
		return "NoName"
	}
	return strings.TrimSuffix(names[0], ".")
}

func getMacAddress(ip string) string {
	file, err := os.Open("/proc/net/arp")
	if err != nil {
		return "Unknown"
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	scanner.Scan() // Skip header
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) >= 4 && fields[0] == ip {
			return fields[3]
		}
	}
	return "Unknown"
}

func DeepScan() error {
	subnets, err := utils.GetSubnetsToScan()
	if err != nil {
		// Fallback to default subnet if auto-detection fails
		subnets = []string{"192.168.2.0/24"}
		fmt.Printf("⚠️ Could not auto-detect subnets, using default: %v\n", subnets)
	}
	
	startTime := time.Now()
	logFile := "/config/logs/deep_scan_progress.log"
	lf, _ := os.Create(logFile)
	defer lf.Close()

	var hostInfos []HostInfo
	
	// Discover live hosts on all configured subnets
	for _, subnet := range subnets {
		fmt.Fprintf(lf, "Discovering live hosts on %s...\n", subnet)
		hosts, err := discoverLiveHosts(subnet)
		if err != nil {
			fmt.Fprintf(lf, "Failed to discover hosts on %s: %v\n", subnet, err)
			continue
		}
		fmt.Fprintf(lf, "Discovered %d hosts on %s\n", len(hosts), subnet)
		hostInfos = append(hostInfos, hosts...)
	}
	
	total := len(hostInfos)
	fmt.Fprintf(lf, "Total discovered: %d hosts in %s\n", total, time.Since(startTime))

	dbPath := "/config/db/atlas.db"
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		fmt.Fprintf(lf, "Failed to open DB: %v\n", err)
		return err
	}
	defer db.Close()

	// Mark all hosts as offline before scanning
	_, err = db.Exec("UPDATE hosts SET online_status = 'offline'")
	if err != nil {
		fmt.Fprintf(lf, "Failed to mark hosts as offline: %v\n", err)
	}

	var wg sync.WaitGroup
	for idx, host := range hostInfos {
		wg.Add(1)
		go func(idx int, host HostInfo) {
			defer wg.Done()
			hostStart := time.Now()
			ip := host.IP
			// Use bestHostName for all fallback methods
			name := bestHostName(ip, host.Name)
			fmt.Fprintf(lf, "Scanning host %d/%d: %s\n", idx+1, total, ip)

			tcpPorts, osInfo := scanAllTcp(ip, lf)
			mac := getMacAddress(ip)
			status := utils.PingHost(ip)
			elapsed := time.Since(startTime)
			hostsLeft := total - (idx + 1)
			estLeft := time.Duration(0)
			if idx+1 > 0 {
				estLeft = (elapsed / time.Duration(idx+1)) * time.Duration(hostsLeft)
			}
			fmt.Fprintf(lf, "Host %s: TCP ports: %s, OS: %s\n", ip, tcpPorts, osInfo)
			fmt.Fprintf(lf, "Progress: %d/%d hosts, elapsed: %s, estimated left: %s\n", idx+1, total, elapsed, estLeft)

			openPorts := tcpPorts
			if openPorts == "" {
				openPorts = "Unknown"
			}

			_, err = db.Exec(`
				INSERT INTO hosts (ip, name, os_details, mac_address, open_ports, next_hop, network_name, last_seen, online_status)
				VALUES (?, ?, ?, ?, ?, '', 'LAN', CURRENT_TIMESTAMP, ?)
				ON CONFLICT(ip) DO UPDATE SET
					name=excluded.name,
					os_details=excluded.os_details,
					mac_address=excluded.mac_address,
					open_ports=excluded.open_ports,
					last_seen=CURRENT_TIMESTAMP,
					online_status=excluded.online_status
			`, ip, name, osInfo, mac, openPorts, status)
			if err != nil {
				fmt.Fprintf(lf, "❌ Update failed for %s: %v\n", ip, err)
			}
			fmt.Fprintf(lf, "Host %s scanned in %s\n", ip, time.Since(hostStart))
		}(idx, host)
	}
	wg.Wait()

	fmt.Fprintf(lf, "Deep scan complete in %s\n", time.Since(startTime))
	return nil
}