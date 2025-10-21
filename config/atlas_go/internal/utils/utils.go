package utils

import (
	"fmt"
	"os/exec"
	"strings"
)

// NetworkInterface represents a network interface with its subnet
type NetworkInterface struct {
	Name   string
	Subnet string
}

// GetAllNetworkInterfaces returns all non-loopback network interfaces with their subnets
func GetAllNetworkInterfaces() ([]NetworkInterface, error) {
	out, err := exec.Command("ip", "-o", "-f", "inet", "addr", "show").Output()
	if err != nil {
		return nil, err
	}
	
	var interfaces []NetworkInterface
	seen := make(map[string]bool) // To avoid duplicates
	
	for _, line := range strings.Split(string(out), "\n") {
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		
		// fields[1] is the interface name (e.g., "eth0", "ens160")
		// fields[3] is the IP/subnet (e.g., "192.168.1.5/24")
		ifaceName := fields[1]
		subnet := fields[3]
		
		// Skip loopback
		if strings.HasPrefix(subnet, "127.") || ifaceName == "lo" {
			continue
		}
		
		// Ensure subnet has CIDR notation
		if !strings.Contains(subnet, "/") {
			subnet = subnet + "/24"
		}
		
		// Use combination of interface and subnet as key to avoid duplicates
		key := ifaceName + ":" + subnet
		if !seen[key] {
			interfaces = append(interfaces, NetworkInterface{
				Name:   ifaceName,
				Subnet: subnet,
			})
			seen[key] = true
		}
	}
	
	if len(interfaces) == 0 {
		return nil, fmt.Errorf("no valid non-loopback network interfaces found")
	}
	
	return interfaces, nil
}

// GetLocalSubnet returns the first non-loopback subnet (for backward compatibility)
func GetLocalSubnet() (string, error) {
	interfaces, err := GetAllNetworkInterfaces()
	if err != nil {
		return "", err
	}
	if len(interfaces) > 0 {
		return interfaces[0].Subnet, nil
	}
	return "", fmt.Errorf("no valid non-loopback subnet found")
}
