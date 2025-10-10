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

func discoverLiveHosts(subnet string) ([]string, error) {
	out, err := exec.Command("nmap", "-sn", subnet).Output()
	if err != nil {
		return nil, err
	}
	var ips []string
	for _, line := range strings.Split(string(out), "\n") {
		if strings.HasPrefix(line, "Nmap scan report for") {
			fields := strings.Fields(line)
			ip := fields[len(fields)-1]
			ip = strings.Trim(ip, "()")
			ips = append(ips, ip)
		}
	}
	return ips, nil
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
	nmapArgs := []string{"-O", "-p-", ip, "-oG", "/config/logs/nmap_tcp.log"}
	start := time.Now()
	cmd := exec.Command("nmap", nmapArgs...)
	cmd.Run()
	elapsed := time.Since(start)
	fmt.Fprintf(logProgress, "TCP scan for %s finished in %s\n", ip, elapsed)

	file, err := os.Open("/config/logs/nmap_tcp.log")
	if err != nil {
		return "Unknown", "Unknown"
	}
	defer file.Close()

	var ports string
	var osInfo string
	rePorts := regexp.MustCompile(`Ports: ([^ ]+)`)
	reOS := regexp.MustCompile(`OS: (.*)`)

	// FIX: Accumulate all open ports in case there are multiple lines
	var portList []string

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if m := rePorts.FindStringSubmatch(line); m != nil {
			parsed := parseNmapPorts(m[1])
			if parsed != "Unknown" {
				portList = append(portList, parsed)
			}
		}
		if m := reOS.FindStringSubmatch(line); m != nil {
			rawOs := m[1]
			// Only keep part before tab or "Seq Index:"
			osInfo = strings.SplitN(rawOs, "\t", 2)[0]
			if idx := strings.Index(osInfo, "Seq Index:"); idx != -1 {
				osInfo = strings.TrimSpace(osInfo[:idx])
			}
			osInfo = strings.TrimSpace(osInfo)
		}
	}
	// Join all ports found into a comma-separated string
	ports = "Unknown"
	if len(portList) > 0 {
		ports = strings.Join(portList, ", ")
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
	subnet, err := utils.GetLocalSubnet()
	if err != nil {
		subnet = "192.168.2.0/24"
	}
	startTime := time.Now()
	logFile := "/config/logs/deep_scan_progress.log"
	lf, _ := os.Create(logFile)
	defer lf.Close()

	fmt.Fprintf(lf, "Discovering live hosts on %s...\n", subnet)
	liveHosts, err := discoverLiveHosts(subnet)
	if err != nil {
		fmt.Fprintf(lf, "Failed to discover hosts: %v\n", err)
		return err
	}
	total := len(liveHosts)
	fmt.Fprintf(lf, "Discovered %d hosts in %s\n", total, time.Since(startTime))

	dbPath := "/config/db/atlas.db"
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		fmt.Fprintf(lf, "Failed to open DB: %v\n", err)
		return err
	}
	defer db.Close()

	var wg sync.WaitGroup
	for idx, ip := range liveHosts {
		wg.Add(1)
		go func(idx int, ip string) {
			defer wg.Done()
			hostStart := time.Now()
			fmt.Fprintf(lf, "Scanning host %d/%d: %s\n", idx+1, total, ip)

			tcpPorts, osInfo := scanAllTcp(ip, lf)
			// udpPorts := scanAllUdp(ip, lf) // UDP scan commented for now
			name := getHostName(ip)
			mac := getMacAddress(ip)
			status := utils.PingHost(ip)
			elapsed := time.Since(startTime)
			hostsLeft := total - (idx + 1)
			estLeft := time.Duration(0)
			if idx+1 > 0 {
				estLeft = (elapsed / time.Duration(idx+1)) * time.Duration(hostsLeft)
			}
			fmt.Fprintf(lf, "Host %s: TCP ports: %s, OS: %s\n", ip, tcpPorts, osInfo)
			// fmt.Fprintf(lf, "Host %s: UDP ports: %s\n", ip, udpPorts) // UDP scan commented for now
			fmt.Fprintf(lf, "Progress: %d/%d hosts, elapsed: %s, estimated left: %s\n", idx+1, total, elapsed, estLeft)

			openPorts := tcpPorts
			// if udpPorts != "Unknown" {
			//	openPorts += ", UDP: " + udpPorts
			// }
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
		}(idx, ip)
	}
	wg.Wait()

	fmt.Fprintf(lf, "Deep scan complete in %s\n", time.Since(startTime))
	return nil
}