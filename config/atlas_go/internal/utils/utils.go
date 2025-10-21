package utils

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// InterfaceInfo represents a network interface with its subnet
type InterfaceInfo struct {
	Name   string
	Subnet string
	IP     string
}

// GetAllInterfaces returns all non-loopback network interfaces with their subnets
func GetAllInterfaces() ([]InterfaceInfo, error) {
	out, err := exec.Command("ip", "-o", "-f", "inet", "addr", "show").Output()
	if err != nil {
		return nil, err
	}
	
	var interfaces []InterfaceInfo
	seenInterfaces := make(map[string]bool)
	
	for _, line := range strings.Split(string(out), "\n") {
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		// Expected format: 1: eth0 inet 192.168.1.5/24 ...
		if len(fields) < 4 {
			continue
		}
		
		// Interface name is at index 1
		ifName := strings.TrimSuffix(fields[1], ":")
		
		// Find inet keyword and get the subnet
		for i, f := range fields {
			if f == "inet" && i+1 < len(fields) {
				subnet := fields[i+1]
				if !strings.HasPrefix(subnet, "127.") && !strings.HasPrefix(subnet, "127.0.0.1") {
					// Avoid duplicate interfaces
					key := ifName + subnet
					if !seenInterfaces[key] {
						seenInterfaces[key] = true
						
						// Extract IP and ensure subnet has CIDR notation
						parts := strings.Split(subnet, "/")
						ip := parts[0]
						fullSubnet := subnet
						if len(parts) == 1 {
							fullSubnet = ip + "/24"
						}
						
						// Convert IP to subnet format (e.g., 192.168.1.5/24 -> 192.168.1.0/24)
						ipParts := strings.Split(ip, ".")
						if len(ipParts) == 4 {
							subnetBase := fmt.Sprintf("%s.%s.%s.0/%s", ipParts[0], ipParts[1], ipParts[2], strings.Split(fullSubnet, "/")[1])
							interfaces = append(interfaces, InterfaceInfo{
								Name:   ifName,
								Subnet: subnetBase,
								IP:     ip,
							})
						}
					}
				}
			}
		}
	}
	
	if len(interfaces) == 0 {
		return nil, fmt.Errorf("no valid non-loopback interfaces found")
	}
	
	return interfaces, nil
}

// Shared function for subnet detection (kept for backwards compatibility)
func GetLocalSubnet() (string, error) {
	interfaces, err := GetAllInterfaces()
	if err != nil {
		return "", err
	}
	if len(interfaces) > 0 {
		return interfaces[0].Subnet, nil
	}
	return "", fmt.Errorf("no valid non-loopback subnet found")
}

// GetSubnetsToScan returns subnets to scan from environment variable or auto-detected local subnets
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
	
	// Fall back to auto-detection of all interfaces if no environment variable is set
	interfaces, err := GetAllInterfaces()
	if err != nil {
		return nil, err
	}
	
	var subnets []string
	for _, iface := range interfaces {
		subnets = append(subnets, iface.Subnet)
	}
	return subnets, nil
}

// GetInterfaceForSubnet returns the interface name for a given subnet
func GetInterfaceForSubnet(subnet string) (string, error) {
	interfaces, err := GetAllInterfaces()
	if err != nil {
		return "", err
	}
	
	for _, iface := range interfaces {
		if iface.Subnet == subnet {
			return iface.Name, nil
		}
	}
	return "", fmt.Errorf("no interface found for subnet %s", subnet)
}
