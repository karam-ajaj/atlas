from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from fastapi.responses import StreamingResponse
import sqlite3
import subprocess
import logging
import os
import subprocess
import time


app = FastAPI()

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can restrict this to specific domains in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === ROUTES ===

# Get both normal and docker hosts
@app.get("/hosts")
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

@app.get("/external")
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


# POST /scripts/run/{script_name} to safely run whitelisted scripts
@app.post("/scripts/run/{script_name}")
def run_named_script(script_name: str):
    allowed_scripts = {
        "scan-hosts-fast": "/config/bin/atlas fastscan",
        "scan-hosts-deep": "/config/bin/atlas deepscan",
        "scan-docker": "/config/bin/atlas dockerscan"
    }

    if script_name not in allowed_scripts:
        raise HTTPException(status_code=400, detail="Invalid script name")

    try:
        command = allowed_scripts[script_name].split()
        logging.debug(f"Running: {command}")
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )
        return JSONResponse(content={"status": "success", "output": result.stdout})
    except subprocess.CalledProcessError as e:
        return JSONResponse(status_code=500, content={"status": "error", "output": e.stderr})

@app.get("/scripts/last-scan-status")
def last_scan_status():
    conn = sqlite3.connect("/config/db/atlas.db")
    cur = conn.cursor()

    def get_latest(table):
        cur.execute(f"SELECT MAX(last_seen) FROM {table}")
        result = cur.fetchone()
        return result[0] if result and result[0] else None

    return {
        "fast": get_latest("hosts"),
        "deep": get_latest("hosts"),  # Reuse for now
        "docker": get_latest("docker_hosts")
    }


LOGS_DIR = "/config/logs"

@app.get("/logs/list")
def list_logs():
    files = []
    for name in os.listdir("/config/logs"):
        if name.endswith(".log"):
            files.append(name)

    # Append container names with a prefix
    try:
        containers = subprocess.check_output(["docker", "ps", "--format", "{{.Names}}"], text=True).splitlines()
        files += [f"container:{c}" for c in containers]
    except Exception as e:
        pass

    return files


@app.get("/logs/{filename}")
def read_log(filename: str):
    if filename.startswith("container:"):
        container = filename.split("container:")[1]
        try:
            result = subprocess.run(["docker", "logs", "--tail", "500", container], capture_output=True, text=True)
            return {"content": result.stdout}
        except Exception as e:
            return {"content": f"[ERROR] Failed to get logs for container '{container}': {str(e)}"}

    filepath = f"/config/logs/{filename}"
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")

    with open(filepath, "r") as f:
        return {"content": f.read()}


@app.get("/logs/{filename}/download")
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

    filepath = f"/config/logs/{filename}"
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(filepath, filename=filename)


@app.get("/containers")
def list_containers():
    try:
        output = subprocess.check_output(["docker", "ps", "--format", "{{.Names}}"], text=True)
        return output.strip().split("\n")
    except Exception as e:
        return []


@app.get("/logs/container/{container_name}")
def get_container_logs(container_name: str):
    try:
        result = subprocess.run(
            ["docker", "logs", "--tail", "1000", container_name],
            capture_output=True,
            text=True,
            check=True
        )
        return {"logs": result.stdout}
    except subprocess.CalledProcessError as e:
        return {"logs": f"[ERROR] Failed to get logs: {e.stderr}"}


@app.get("/logs/{filename}/stream")
def stream_log(filename: str):
    def event_generator():
        if filename.startswith("container:"):
            container = filename.split("container:")[1]
            cmd = ["docker", "logs", "-f", "--tail", "10", container]
        else:
            filepath = f"/config/logs/{filename}"
            if not os.path.exists(filepath):
                yield f"data: [ERROR] File not found: {filepath}\n\n"
                return
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