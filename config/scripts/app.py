from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import subprocess
import logging
import os
import re
from scripts.scheduler import get_scheduler

app = FastAPI(
    title="Atlas Network API",
    description="Scan automation, infrastructure discovery, and visualization backend for Atlas",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    root_path="/api",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request/response
class IntervalUpdate(BaseModel):
    interval: int

# Initialize scheduler on startup
scheduler = get_scheduler()

@app.on_event("startup")
async def startup_event():
    """Start the scheduler when the API starts."""
    logging.info("Starting scan scheduler...")
    scheduler.start()

LOGS_DIR = "/config/logs"
os.makedirs(LOGS_DIR, exist_ok=True)

# Scripts and their log files (used for POST tee + stream)
ALLOWED_SCRIPTS = {
    "scan-hosts-fast": {
        "cmd": "/config/bin/atlas fastscan",
        "log": os.path.join(LOGS_DIR, "scan-hosts-fast.log"),
    },
    "scan-hosts-deep": {
        "cmd": "/config/bin/atlas deepscan",
        "log": os.path.join(LOGS_DIR, "scan-hosts-deep.log"),
    },
    "scan-docker": {
        "cmd": "/config/bin/atlas dockerscan",
        "log": os.path.join(LOGS_DIR, "scan-docker.log"),
    },
}

@app.get("/health", tags=["Meta"])
def health():
    # Basic DB sanity: ensure hosts table exists
    db_ok = True
    try:
        conn = sqlite3.connect("/config/db/atlas.db")
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='hosts'")
        exists = cur.fetchone() is not None
        conn.close()
        if not exists:
            db_ok = False
    except Exception:
        db_ok = False

    return {
        "status": "ok",
        "db": "ok" if db_ok else "init_pending",
        "version": "1.0.0",
    }

@app.get("/hosts", tags=["Hosts"])
def get_hosts():
    conn = sqlite3.connect("/config/db/atlas.db")
    cursor1 = conn.cursor()
    cursor2 = conn.cursor()
    cursor1.execute("SELECT * FROM hosts")
    cursor2.execute("SELECT * FROM docker_hosts")
    rows1 = cursor1.fetchall()
    rows2 = cursor2.fetchall()
    conn.close()
    return [rows1, rows2]

@app.get("/external", tags=["Hosts"])
def get_external_networks():
    try:
        conn = sqlite3.connect("/config/db/atlas.db")
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM external_networks ORDER BY last_seen DESC LIMIT 1")
        row = cursor.fetchone()
        conn.close()
        return row if row else {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# POST still supported; now tees output to a persistent log file too
@app.post("/scripts/run/{script_name}", tags=["Scripts"])
def run_named_script(script_name: str):
    if script_name not in ALLOWED_SCRIPTS:
        raise HTTPException(status_code=400, detail="Invalid script name")

    cmd = ALLOWED_SCRIPTS[script_name]["cmd"]
    log_file = ALLOWED_SCRIPTS[script_name]["log"]
    os.makedirs(LOGS_DIR, exist_ok=True)
    open(log_file, "a").close()  # ensure exists

    try:
        shell_cmd = f'{cmd} 2>&1 | tee -a "{log_file}"'
        logging.debug(f"Running (tee to log): {shell_cmd}")
        result = subprocess.run(["bash", "-lc", shell_cmd], capture_output=True, text=True, check=True)
        return JSONResponse(content={"status": "success", "output": result.stdout})
    except subprocess.CalledProcessError as e:
        # also persist error output
        try:
            with open(log_file, "a") as f:
                if e.stdout: f.write(e.stdout)
                if e.stderr: f.write(e.stderr)
        except Exception:
            pass
        return JSONResponse(status_code=500, content={"status": "error", "output": e.stderr})

# NEW: proper live stream endpoint that ends when the process exits
@app.get("/scripts/run/{script_name}/stream", tags=["Scripts"])
def stream_named_script(script_name: str):
    if script_name not in ALLOWED_SCRIPTS:
        raise HTTPException(status_code=400, detail="Invalid script name")

    cmd = ALLOWED_SCRIPTS[script_name]["cmd"]
    log_file = ALLOWED_SCRIPTS[script_name]["log"]
    os.makedirs(LOGS_DIR, exist_ok=True)
    open(log_file, "a").close()

    def event_generator():
        # Use bash -lc so pipes/aliases work if needed
        process = subprocess.Popen(
            ["bash", "-lc", cmd],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        try:
            with open(log_file, "a", buffering=1) as lf:
                for line in iter(process.stdout.readline, ''):
                    lf.write(line)
                    yield f"data: {line.rstrip()}\n\n"
            rc = process.wait()
            # Let the client know we are done; then the HTTP connection is closed
            yield f"data: [exit {rc}]\n\n"
        except GeneratorExit:
            # Client closed connection; stop the process
            try: process.kill()
            except Exception: pass
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/scripts/last-scan-status", tags=["Scripts"])
def last_scan_status():
    conn = sqlite3.connect("/config/db/atlas.db")
    cur = conn.cursor()

    def get_latest(table):
        cur.execute(f"SELECT MAX(last_seen) FROM {table}")
        result = cur.fetchone()
        return result[0] if result and result[0] else None

    return {
        "fast": get_latest("hosts"),
        "deep": get_latest("hosts"),
        "docker": get_latest("docker_hosts")
    }

@app.get("/logs/list", tags=["Logs"])
def list_logs():
    files = []
    for name in os.listdir(LOGS_DIR):
        if not name.endswith(".log"):
            continue
        # Hide verbose per-host nmap logs from the UI list
        if name.startswith("nmap_tcp_") or name.startswith("nmap_udp_"):
            continue
        files.append(name)
    try:
        containers = subprocess.check_output(["docker", "ps", "--format", "{{.Names}}"], text=True).splitlines()
        files += [f"container:{c}" for c in containers]
    except Exception:
        pass
    return files

@app.get("/logs/{filename}", tags=["Logs"])
def read_log(filename: str):
    if filename.startswith("container:"):
        container = filename.split("container:")[1]
        try:
            result = subprocess.run(["docker", "logs", "--tail", "500", container], capture_output=True, text=True)
            return {"content": result.stdout}
        except Exception as e:
            return {"content": f"[ERROR] Failed to get logs for container '{container}': {str(e)}"}

    filepath = f"{LOGS_DIR}/{filename}"
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")

    with open(filepath, "r") as f:
        return {"content": f.read()}

@app.get("/logs/{filename}/download", tags=["Logs"])
def download_log(filename: str):
    if filename.startswith("container:"):
        container = filename.split("container:")[1]
        try:
            logs = subprocess.check_output(["docker", "logs", container], text=True)
            return Response(
                content=logs,
                media_type="text/plain",
                headers={"Content-Disposition": f"attachment; filename={container}.log"}
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get container logs: {str(e)}")

    filepath = f"{LOGS_DIR}/{filename}"
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath, filename=filename)

@app.get("/containers", tags=["Docker"])
def list_containers():
    try:
        output = subprocess.check_output(["docker", "ps", "--format", "{{.Names}}"], text=True)
        return output.strip().split("\n")
    except Exception:
        return []

def validate_container_name(name: str) -> str:
    """
    Validate a Docker container name to avoid passing arbitrary user input
    directly to subprocess calls.
    Only allow a restricted set of characters and a reasonable length.
    """
    # Allow common Docker name characters only and enforce a reasonable length
    if not name or len(name) > 128:
        raise HTTPException(status_code=400, detail="Invalid container name length")
    if not re.fullmatch(r"[a-zA-Z0-9._-]+", name):
        raise HTTPException(status_code=400, detail="Invalid container name format")
    return name

def validate_log_filename(name: str) -> str:
    """
    Validate a log filename so it can be safely used to construct a path and
    passed as an argument to subprocess calls.

    NOTE: This validator only allows simple filenames (no directories). The
    allowed character set is restricted to alphanumerics plus dot, underscore,
    and hyphen, and any path separators are rejected.
    """
    if not name or len(name) > 255:
        raise HTTPException(status_code=400, detail="Invalid log filename length")
    # Disallow any path separators and restrict to a safe character set
    if "/" in name or "\\" in name:
        raise HTTPException(status_code=400, detail="Invalid log filename format")
    if not re.fullmatch(r"[a-zA-Z0-9._-]+", name):
        raise HTTPException(status_code=400, detail="Invalid log filename format")
    return name

@app.get("/logs/container/{container_name}", tags=["Docker"])
def get_container_logs(container_name: str):
    try:
        safe_name = validate_container_name(container_name)
        result = subprocess.run(
            ["docker", "logs", "--tail", "1000", safe_name],
            capture_output=True,
            text=True,
            check=True,
        )
        return {"logs": result.stdout}
    except subprocess.CalledProcessError as e:
        return {"logs": f"[ERROR] Failed to get logs: {e.stderr}"}

@app.get("/logs/{filename}/stream", tags=["Logs"])
def stream_log(filename: str):
    def event_generator():
        if filename.startswith("container:"):
            container = filename.split("container:")[1]
            safe_container = validate_container_name(container)
            cmd = ["docker", "logs", "-f", "--tail", "10", safe_container]
        else:
            safe_filename = validate_log_filename(filename)
            base_dir = os.path.abspath(LOGS_DIR)
            filepath = os.path.normpath(os.path.join(base_dir, safe_filename))
            # Ensure the resolved path stays within the logs directory
            if os.path.commonpath([base_dir, filepath]) != base_dir:
                yield "data: [ERROR] Invalid log file path\n\n"
                return
            if not os.path.exists(filepath):
                yield f"data: [ERROR] File not found: {filepath}\n\n"
                return
            # NOTE: -F follows forever; the client must close this
            cmd = ["tail", "-n", "10", "-F", filepath]

        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        try:
            for line in process.stdout:
                yield f"data: {line.rstrip()}\n\n"
        except GeneratorExit:
            process.kill()
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/scheduler/intervals", tags=["Scheduler"])
def get_scheduler_intervals():
    """Get current scan intervals for all scan types."""
    return scheduler.get_intervals()

@app.put("/scheduler/intervals/{scan_type}", tags=["Scheduler"])
def update_scheduler_interval(scan_type: str, data: IntervalUpdate):
    """Update the interval for a specific scan type."""
    try:
        scheduler.update_interval(scan_type, data.interval)
        return {"status": "success", "scan_type": scan_type, "interval": data.interval}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/scheduler/status", tags=["Scheduler"])
def get_scheduler_status():
    """Get scheduler status."""
    return {
        "running": scheduler.is_running(),
        "intervals": scheduler.get_intervals()
    }