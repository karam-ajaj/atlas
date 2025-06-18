package main

import (
    "fmt"
    "log"
    "os"

    "atlas/internal/scan"
)

func main() {
    if len(os.Args) < 2 {
        log.Fatalf("Usage: ./atlas <command>\nAvailable commands: fastscan")
    }

    switch os.Args[1] {
    case "fastscan":
        fmt.Println("🚀 Running fast scan...")
        err := scan.FastScan()
        if err != nil {
            log.Fatalf("❌ Fast scan failed: %v", err)
        }
        fmt.Println("✅ Fast scan complete.")
    default:
        log.Fatalf("Unknown command: %s", os.Args[1])
    }
}
