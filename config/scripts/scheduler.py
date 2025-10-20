#!/usr/bin/env python3
"""
Scheduler module for Atlas scans.
Manages periodic execution of fastscan, dockerscan, and deepscan.
"""
import os
import time
import subprocess
import logging
import threading
import json
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Default intervals in seconds (can be overridden by environment variables)
DEFAULT_INTERVALS = {
    "fastscan": 3600,    # 1 hour
    "dockerscan": 3600,  # 1 hour
    "deepscan": 7200,    # 2 hours
}

# Configuration file path
CONFIG_FILE = "/config/db/scheduler_config.json"
LOGS_DIR = "/config/logs"


class ScanScheduler:
    """Manages scheduled execution of scan scripts."""
    
    def __init__(self):
        self.intervals = self._load_intervals()
        self.running = False
        self.threads = {}
        self.stop_events = {}
        
    def _load_intervals(self):
        """Load intervals from config file, environment variables, or defaults."""
        intervals = DEFAULT_INTERVALS.copy()
        
        # Load from environment variables first
        if os.getenv("FASTSCAN_INTERVAL"):
            try:
                intervals["fastscan"] = int(os.getenv("FASTSCAN_INTERVAL"))
            except ValueError:
                logger.warning(f"Invalid FASTSCAN_INTERVAL, using default: {DEFAULT_INTERVALS['fastscan']}")
        
        if os.getenv("DOCKERSCAN_INTERVAL"):
            try:
                intervals["dockerscan"] = int(os.getenv("DOCKERSCAN_INTERVAL"))
            except ValueError:
                logger.warning(f"Invalid DOCKERSCAN_INTERVAL, using default: {DEFAULT_INTERVALS['dockerscan']}")
        
        if os.getenv("DEEPSCAN_INTERVAL"):
            try:
                intervals["deepscan"] = int(os.getenv("DEEPSCAN_INTERVAL"))
            except ValueError:
                logger.warning(f"Invalid DEEPSCAN_INTERVAL, using default: {DEFAULT_INTERVALS['deepscan']}")
        
        # Override with config file if it exists
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, 'r') as f:
                    saved_intervals = json.load(f)
                    intervals.update(saved_intervals)
                    logger.info(f"Loaded intervals from config file: {intervals}")
            except Exception as e:
                logger.warning(f"Failed to load config file: {e}")
        
        return intervals
    
    def save_intervals(self):
        """Save current intervals to config file."""
        try:
            os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
            with open(CONFIG_FILE, 'w') as f:
                json.dump(self.intervals, f, indent=2)
            logger.info(f"Saved intervals to config file: {self.intervals}")
        except Exception as e:
            logger.error(f"Failed to save config file: {e}")
    
    def get_intervals(self):
        """Return current scan intervals."""
        return self.intervals.copy()
    
    def update_interval(self, scan_type, interval):
        """Update interval for a specific scan type."""
        if scan_type not in self.intervals:
            raise ValueError(f"Unknown scan type: {scan_type}")
        
        if interval < 60:  # Minimum 1 minute
            raise ValueError("Interval must be at least 60 seconds")
        
        self.intervals[scan_type] = interval
        self.save_intervals()
        
        # Restart the thread for this scan type if running
        if self.running and scan_type in self.threads:
            logger.info(f"Restarting {scan_type} thread with new interval: {interval}s")
            self._stop_scan_thread(scan_type)
            self._start_scan_thread(scan_type)
    
    def _run_scan(self, scan_type):
        """Execute a single scan."""
        atlas_bin = "/config/bin/atlas"
        log_file = os.path.join(LOGS_DIR, f"scan_audit.log")
        
        if not os.path.exists(atlas_bin):
            logger.error(f"Atlas binary not found: {atlas_bin}")
            return False
        
        try:
            logger.info(f"⚡ Running {scan_type}...")
            
            # Run the scan and append output to log
            with open(log_file, "a") as log:
                result = subprocess.run(
                    [atlas_bin, scan_type],
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    text=True,
                    timeout=3600  # 1 hour timeout for any scan
                )
            
            if result.returncode == 0:
                logger.info(f"✅ {scan_type} complete.")
                return True
            else:
                logger.error(f"❌ {scan_type} failed with exit code {result.returncode}")
                return False
        except subprocess.TimeoutExpired:
            logger.error(f"❌ {scan_type} timed out after 1 hour")
            return False
        except Exception as e:
            logger.error(f"❌ {scan_type} failed: {e}")
            return False
    
    def _scan_loop(self, scan_type):
        """Loop that runs a scan at the configured interval."""
        stop_event = self.stop_events[scan_type]
        interval = self.intervals[scan_type]
        
        logger.info(f"Starting {scan_type} scheduler (interval: {interval}s)")
        
        # Run immediately on first start
        self._run_scan(scan_type)
        
        while not stop_event.is_set():
            # Wait for the interval, but check stop_event periodically
            for _ in range(interval):
                if stop_event.wait(1):  # Check every second
                    logger.info(f"Stopping {scan_type} scheduler")
                    return
            
            # Run the scan
            self._run_scan(scan_type)
    
    def _start_scan_thread(self, scan_type):
        """Start a thread for a specific scan type."""
        if scan_type in self.threads and self.threads[scan_type].is_alive():
            logger.warning(f"{scan_type} thread already running")
            return
        
        stop_event = threading.Event()
        self.stop_events[scan_type] = stop_event
        
        thread = threading.Thread(
            target=self._scan_loop,
            args=(scan_type,),
            daemon=True,
            name=f"scheduler-{scan_type}"
        )
        thread.start()
        self.threads[scan_type] = thread
        logger.info(f"Started {scan_type} thread")
    
    def _stop_scan_thread(self, scan_type):
        """Stop a thread for a specific scan type."""
        if scan_type in self.stop_events:
            self.stop_events[scan_type].set()
        
        if scan_type in self.threads:
            thread = self.threads[scan_type]
            if thread.is_alive():
                thread.join(timeout=5)
            del self.threads[scan_type]
            logger.info(f"Stopped {scan_type} thread")
    
    def start(self):
        """Start all scan schedulers."""
        if self.running:
            logger.warning("Scheduler already running")
            return
        
        self.running = True
        logger.info("Starting scan schedulers...")
        
        # Ensure logs directory exists
        os.makedirs(LOGS_DIR, exist_ok=True)
        
        # Start a thread for each scan type
        for scan_type in self.intervals.keys():
            self._start_scan_thread(scan_type)
        
        logger.info("All schedulers started")
    
    def stop(self):
        """Stop all scan schedulers."""
        if not self.running:
            logger.warning("Scheduler not running")
            return
        
        self.running = False
        logger.info("Stopping all schedulers...")
        
        for scan_type in list(self.threads.keys()):
            self._stop_scan_thread(scan_type)
        
        logger.info("All schedulers stopped")
    
    def is_running(self):
        """Check if scheduler is running."""
        return self.running


# Global scheduler instance
_scheduler = None


def get_scheduler():
    """Get or create the global scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = ScanScheduler()
    return _scheduler


def main():
    """Run the scheduler as a standalone script."""
    scheduler = get_scheduler()
    
    try:
        scheduler.start()
        logger.info("Scheduler running. Press Ctrl+C to stop.")
        
        # Keep main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
    finally:
        scheduler.stop()
        logger.info("Scheduler stopped")


if __name__ == "__main__":
    main()
