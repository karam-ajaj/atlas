package scan

import (
	"bufio"
	"database/sql"
	"fmt"
	"net"
	"os"
	"os/exec"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

var commonPorts = []int{22, 80, 443, 445, 139, 3306, 8080, 8443, 3000, 9091, 3389}

func getAliveHosts() ([]string, error) {
	fmt.Println("🔍 Discovering live hosts...")
	out, err := exec.Command("nmap", "-sn", "192.168.2.0/24").Output()
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

func scanOpenPorts(ip string) []string {
	const maxConcurrent = 30 // max number of concurrent port dials
	type result struct {
		port int
		open bool
	}

	semaphoreChan := make(chan struct{}, maxConcurrent)
	results := make(chan result, len(commonPorts))

	for _, port := range commonPorts {
		semaphoreChan <- struct{}{}
		go func(p int) {
			defer func() { <-semaphoreChan }()
			address := fmt.Sprintf("%s:%d", ip, p)
			conn, err := net.DialTimeout("tcp", address, 500*time.Millisecond)
			if err == nil {
				conn.Close()
				results <- result{p, true}
			} else {
				results <- result{p, false}
			}
		}(port)
	}

	openPorts := []string{}
	for i := 0; i < len(commonPorts); i++ {
		r := <-results
		if r.open {
			openPorts = append(openPorts, fmt.Sprintf("%d/tcp", r.port))
		}
	}
	return openPorts
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

func getHostName(ip string) string {
	names, err := net.LookupAddr(ip)
	if err != nil || len(names) == 0 {
		return "NoName"
	}
	return strings.TrimSuffix(names[0], ".")
}

func getOSFingerprint(ip string) string {
	out, err := exec.Command("nmap", "-O", ip).Output()
	if err != nil {
		return "Unknown"
	}
	for _, line := range strings.Split(string(out), "\n") {
		if strings.HasPrefix(line, "OS details:") {
			return strings.TrimSpace(strings.TrimPrefix(line, "OS details:"))
		}
		if strings.HasPrefix(line, "OS guesses:") {
			return strings.TrimSpace(strings.TrimPrefix(line, "OS guesses:"))
		}
	}
	return "Unknown"
}

func insertHostInfo(ip, name, osDetails, mac string, ports []string) {
	dbPath := "/config/db/atlas.db"
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		fmt.Println("❌ DB error:", err)
		return
	}
	defer db.Close()

	portList := "Unknown"
	if len(ports) > 0 {
		portList = strings.Join(ports, ",")
	}

	_, err = db.Exec(`
		INSERT INTO hosts (ip, name, os_details, mac_address, open_ports, next_hop, network_name, last_seen)
		VALUES (?, ?, ?, ?, ?, '', '', CURRENT_TIMESTAMP)
		ON CONFLICT(ip) DO UPDATE SET
			name=excluded.name,
			os_details=excluded.os_details,
			mac_address=excluded.mac_address,
			open_ports=excluded.open_ports,
			last_seen=CURRENT_TIMESTAMP
	`, ip, name, osDetails, mac, portList)

	if err != nil {
		fmt.Printf("❌ Insert/update failed for %s: %v\n", ip, err)
	} else {
		fmt.Printf("✅ Recorded %s (%s)\n", ip, name)
	}
}

func DeepScan() error {
	ips, err := getAliveHosts()
	if err != nil {
		return fmt.Errorf("failed to get alive hosts: %v", err)
	}

	for _, ip := range ips {
		name := getHostName(ip)
		mac := getMacAddress(ip)
		ports := scanOpenPorts(ip)

		var osDetails string
		if len(ports) > 0 {
			osDetails = getOSFingerprint(ip)
		} else {
			osDetails = "Unknown"
		}

		insertHostInfo(ip, name, osDetails, mac, ports)
	}

	return nil
}
