from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import subprocess

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

# POST /scripts/run/{script_name} to safely run whitelisted scripts
@app.post("/scripts/run/{script_name}")
def run_named_script(script_name: str):
    allowed_scripts = {
        "scan-full": "/config/scripts/check.sh",
        "scan-hosts-fast": "/config/scripts/hosts_fast_scan.sh",
        "scan-hosts-deep": "/config/scripts/hosts_deep_scan_macs.sh",
        "scan-docker": "/config/scripts/new_docker_script_multips_ips.sh"
    }

    if script_name not in allowed_scripts:
        raise HTTPException(status_code=400, detail="Invalid script name")

    try:
        result = subprocess.run(
            [allowed_scripts[script_name]],
            capture_output=True,
            text=True,
            check=True
        )
        return JSONResponse(content={"status": "success", "output": result.stdout})
    except subprocess.CalledProcessError as e:
        return JSONResponse(status_code=500, content={"status": "error", "output": e.stderr})
