package main

import (
    "fmt"
    "log"
    "os"

    "atlas/internal/scan"
    "atlas/internal/db"
    "atlas/internal/scheduler"
)

func main() {
    if len(os.Args) < 2 {
        log.Fatalf("Usage: ./atlas <command>\nAvailable commands: fastscan, dockerscan, deepscan, initdb, scheduler")
    }

    switch os.Args[1] {
    case "fastscan":
        fmt.Println("🚀 Running fast scan...")
        err := scan.FastScan()
        if err != nil {
            log.Fatalf("❌ Fast scan failed: %v", err)
        }
        fmt.Println("✅ Fast scan complete.")
    case "dockerscan":
        fmt.Println("🐳 Running Docker scan...")
        err := scan.DockerScan()
        if err != nil {
            log.Fatalf("❌ Docker scan failed: %v", err)
        }
        fmt.Println("✅ Docker scan complete.")
    case "deepscan":
        fmt.Println("🚀 Running deep scan...")
        err := scan.DeepScan()
        if err != nil {
            log.Fatalf("❌ Deep scan failed: %v", err)
        }
        fmt.Println("✅ Deep scan complete.")
    case "initdb":
        fmt.Println("📦 Initializing database...")
        err := db.InitDB()
        if err != nil {
            log.Fatalf("❌ DB init failed: %v", err)
        }
        fmt.Println("✅ Database initialized.")
    case "scheduler":
        fmt.Println("🕐 Starting scheduler service...")
        scheduler.Start()
    default:
        log.Fatalf("Unknown command: %s", os.Args[1])
    }
}
