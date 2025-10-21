package utils

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
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
						return subnet, nil
					} else {
						return parts[0] + "/24", nil
					}
				}
			}
		}
	}
	return "", fmt.Errorf("no valid non-loopback subnet found")
}

// GetSubnetsToScan returns subnets to scan from environment variable or auto-detected local subnet
// Environment variable SCAN_SUBNETS can contain comma-separated subnets, e.g., "192.168.1.0/24,10.0.0.0/24"
func GetSubnetsToScan() ([]string, error) {
	// Check if SCAN_SUBNETS environment variable is set
	if subnetsEnv := os.Getenv("SCAN_SUBNETS"); subnetsEnv != "" {
		// Split by comma and trim whitespace
		subnets := strings.Split(subnetsEnv, ",")
		var result []string
		for _, subnet := range subnets {
			trimmed := strings.TrimSpace(subnet)
			if trimmed != "" {
				result = append(result, trimmed)
			}
		}
		if len(result) > 0 {
			return result, nil
		}
	}
	
	// Fall back to auto-detection if no environment variable is set
	subnet, err := GetLocalSubnet()
	if err != nil {
		return nil, err
	}
	return []string{subnet}, nil
}
