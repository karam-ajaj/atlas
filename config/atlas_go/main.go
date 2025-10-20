package main

import (
    "fmt"
    "log"
    "os"
    "os/signal"
    "strconv"
    "syscall"
    "time"

    "atlas/internal/scan"
    "atlas/internal/db"
)

func main() {
    if len(os.Args) < 2 {
        log.Fatalf("Usage: ./atlas <command>\nAvailable commands: fastscan, dockerscan, deepscan, initdb, schedule")
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
    case "schedule":
        runScheduler()
    default:
        log.Fatalf("Unknown command: %s", os.Args[1])
    }
}

func runScheduler() {
    // Get scan interval from environment variable, default to 30 minutes
    intervalMinutes := 30
    if envInterval := os.Getenv("SCAN_INTERVAL_MINUTES"); envInterval != "" {
        if parsed, err := strconv.Atoi(envInterval); err == nil && parsed > 0 {
            intervalMinutes = parsed
        } else {
            log.Printf("⚠️ Invalid SCAN_INTERVAL_MINUTES value '%s', using default: 30 minutes", envInterval)
        }
    }

    interval := time.Duration(intervalMinutes) * time.Minute
    fmt.Printf("🕐 Starting scheduler with interval: %d minutes\n", intervalMinutes)

    // Run initial scan immediately
    runAllScans()

    // Set up ticker for periodic scans
    ticker := time.NewTicker(interval)
    defer ticker.Stop()

    // Set up signal handler for graceful shutdown
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

    fmt.Printf("✅ Scheduler started. Next scan in %d minutes.\n", intervalMinutes)
    fmt.Println("Press Ctrl+C to stop.")

    for {
        select {
        case <-ticker.C:
            fmt.Printf("\n⏰ Running scheduled scan at %s\n", time.Now().Format("2006-01-02 15:04:05"))
            runAllScans()
            fmt.Printf("✅ Scheduled scan complete. Next scan in %d minutes.\n", intervalMinutes)
        case sig := <-sigChan:
            fmt.Printf("\n🛑 Received signal %v. Shutting down scheduler...\n", sig)
            return
        }
    }
}

func runAllScans() {
    fmt.Println("⚡ Running fast scan...")
    if err := scan.FastScan(); err != nil {
        log.Printf("❌ Fast scan failed: %v", err)
    } else {
        fmt.Println("✅ Fast scan complete.")
    }

    fmt.Println("🐳 Running Docker scan...")
    if err := scan.DockerScan(); err != nil {
        log.Printf("❌ Docker scan failed: %v", err)
    } else {
        fmt.Println("✅ Docker scan complete.")
    }

    fmt.Println("🔍 Running deep scan...")
    if err := scan.DeepScan(); err != nil {
        log.Printf("❌ Deep scan failed: %v", err)
    } else {
        fmt.Println("✅ Deep scan complete.")
    }
}
