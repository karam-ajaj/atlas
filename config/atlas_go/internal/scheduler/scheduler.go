package scheduler

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"atlas/internal/scan"

	_ "github.com/mattn/go-sqlite3"
)

const dbPath = "/config/db/atlas.db"

type SchedulerConfig struct {
	ID                  int
	ScanIntervalMinutes int
	Enabled             bool
	LastRun             *time.Time
}

// GetConfig retrieves the scheduler configuration from the database
func GetConfig() (*SchedulerConfig, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open DB: %v", err)
	}
	defer db.Close()

	var config SchedulerConfig
	var enabled int
	var lastRun sql.NullTime

	err = db.QueryRow("SELECT id, scan_interval_minutes, enabled, last_run FROM scheduler_config WHERE id = 1").
		Scan(&config.ID, &config.ScanIntervalMinutes, &enabled, &lastRun)

	if err != nil {
		return nil, fmt.Errorf("failed to get scheduler config: %v", err)
	}

	config.Enabled = enabled == 1
	if lastRun.Valid {
		config.LastRun = &lastRun.Time
	}

	return &config, nil
}

// UpdateConfig updates the scheduler configuration in the database
func UpdateConfig(intervalMinutes int, enabled bool) error {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open DB: %v", err)
	}
	defer db.Close()

	enabledInt := 0
	if enabled {
		enabledInt = 1
	}

	_, err = db.Exec(
		"UPDATE scheduler_config SET scan_interval_minutes = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
		intervalMinutes, enabledInt,
	)

	if err != nil {
		return fmt.Errorf("failed to update scheduler config: %v", err)
	}

	return nil
}

// UpdateLastRun updates the last run timestamp
func UpdateLastRun() error {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open DB: %v", err)
	}
	defer db.Close()

	_, err = db.Exec("UPDATE scheduler_config SET last_run = CURRENT_TIMESTAMP WHERE id = 1")
	if err != nil {
		return fmt.Errorf("failed to update last_run: %v", err)
	}

	return nil
}

// RunScans executes all three scans in sequence
func RunScans() error {
	log.Println("⚡ Running scheduled fast scan...")
	if err := scan.FastScan(); err != nil {
		log.Printf("❌ Fast scan failed: %v\n", err)
	} else {
		log.Println("✅ Fast scan complete.")
	}

	log.Println("🐳 Running scheduled Docker scan...")
	if err := scan.DockerScan(); err != nil {
		log.Printf("❌ Docker scan failed: %v\n", err)
	} else {
		log.Println("✅ Docker scan complete.")
	}

	log.Println("🔍 Running scheduled deep scan...")
	if err := scan.DeepScan(); err != nil {
		log.Printf("❌ Deep scan failed: %v\n", err)
	} else {
		log.Println("✅ Deep scan complete.")
	}

	return UpdateLastRun()
}

// Start begins the scheduler loop
func Start() {
	log.Println("🕐 Starting Atlas scheduler service...")

	// Check for environment variable override
	envInterval := os.Getenv("ATLAS_SCAN_INTERVAL")
	if envInterval != "" {
		if minutes, err := strconv.Atoi(envInterval); err == nil && minutes > 0 {
			log.Printf("📝 Using ATLAS_SCAN_INTERVAL from environment: %d minutes\n", minutes)
			if err := UpdateConfig(minutes, true); err != nil {
				log.Printf("⚠️ Failed to update config from environment: %v\n", err)
			}
		}
	}

	ticker := time.NewTicker(1 * time.Minute) // Check every minute
	defer ticker.Stop()

	for {
		config, err := GetConfig()
		if err != nil {
			log.Printf("❌ Failed to get scheduler config: %v\n", err)
			<-ticker.C
			continue
		}

		if !config.Enabled {
			log.Println("⏸️ Scheduler is disabled")
			<-ticker.C
			continue
		}

		shouldRun := false
		if config.LastRun == nil {
			// Never run before, run immediately
			shouldRun = true
			log.Println("🎯 First scheduled run")
		} else {
			// Check if enough time has passed
			elapsed := time.Since(*config.LastRun)
			intervalDuration := time.Duration(config.ScanIntervalMinutes) * time.Minute

			if elapsed >= intervalDuration {
				shouldRun = true
				log.Printf("🎯 Scheduled run (interval: %d min, elapsed: %.1f min)\n",
					config.ScanIntervalMinutes, elapsed.Minutes())
			}
		}

		if shouldRun {
			if err := RunScans(); err != nil {
				log.Printf("❌ Scheduled scan run failed: %v\n", err)
			}
		}

		<-ticker.C
	}
}
