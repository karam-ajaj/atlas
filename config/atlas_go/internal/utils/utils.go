package utils

import (
	"os/exec"
	"strings"
	"fmt"
)

// Shared function for subnet detection
func GetLocalSubnet() (string, error) {
	out, err := exec.Command("ip", "-o", "-f", "inet", "addr", "show").Output()
	if err != nil {
		return "", err
	}
	for _, line := range strings.Split(string(out), "\n") {
		fields := strings.Fields(line)
		for i, f := range fields {
			if f == "inet" && i+1 < len(fields) {
				subnet := fields[i+1]
				if !strings.HasPrefix(subnet, "127.") {
					parts := strings.Split(subnet, "/")
					if len(parts) == 2 {
						return parts[0] + "/24", nil
					}
				}
			}
		}
	}
	return "", fmt.Errorf("no valid non-loopback subnet found")
}