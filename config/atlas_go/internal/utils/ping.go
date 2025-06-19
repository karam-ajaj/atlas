package utils

import (
	"os/exec"
	"strings"
)

// PingOrLocalCheck returns online if the IP is on the host or responds to ping.
func PingHost(ip string) string {
	// 1. Try ping
	out, err := exec.Command("ping", "-c", "1", "-W", "1", ip).CombinedOutput()
	if err == nil && strings.Contains(string(out), "1 received") {
		return "online"
	}

	// 2. Try checking if IP belongs to host (for overlay/docker gateways)
	hostIPs, err := exec.Command("hostname", "-I").Output()
	if err == nil && strings.Contains(string(hostIPs), ip) {
		return "online"
	}

	// 3. Fallback: assume offline
	return "offline"
}
