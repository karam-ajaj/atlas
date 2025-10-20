package utils

import (
	"fmt"
	"os/exec"
	"strings"
)

// InterfaceInfo contains information about a network interface
type InterfaceInfo struct {
	Name   string
	Subnet string
}

// GetLocalSubnets returns all non-loopback subnets with their interface names
func GetLocalSubnets() ([]InterfaceInfo, error) {
	out, err := exec.Command("ip", "-o", "-f", "inet", "addr", "show").Output()
	if err != nil {
		return nil, err
	}
	
	var interfaces []InterfaceInfo
	for _, line := range strings.Split(string(out), "\n") {
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		
		// fields[1] is the interface name (e.g., eth0, ens160)
		ifaceName := fields[1]
		
		for i, f := range fields {
			if f == "inet" && i+1 < len(fields) {
				subnet := fields[i+1]
				// Skip loopback and docker bridge by default
				if !strings.HasPrefix(subnet, "127.") && !strings.HasPrefix(ifaceName, "docker") && !strings.HasPrefix(ifaceName, "br-") {
					parts := strings.Split(subnet, "/")
					if len(parts) == 2 {
						interfaces = append(interfaces, InterfaceInfo{
							Name:   ifaceName,
							Subnet: subnet,
						})
					} else {
						interfaces = append(interfaces, InterfaceInfo{
							Name:   ifaceName,
							Subnet: parts[0] + "/24",
						})
					}
				}
			}
		}
	}
	
	if len(interfaces) == 0 {
		return nil, fmt.Errorf("no valid non-loopback subnet found")
	}
	
	return interfaces, nil
}

// GetLocalSubnet returns the first non-loopback subnet (for backward compatibility)
func GetLocalSubnet() (string, error) {
	interfaces, err := GetLocalSubnets()
	if err != nil {
		return "", err
	}
	if len(interfaces) == 0 {
		return "", fmt.Errorf("no valid non-loopback subnet found")
	}
	return interfaces[0].Subnet, nil
}
