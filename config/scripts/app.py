# pip install fastapi uvicorn sqlite3

# app.py
from fastapi import FastAPI
import sqlite3

# from fastapi.middleware.cors
# import CORSMiddleware

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

@app.get("/hosts")
def get_hosts():
    conn = sqlite3.connect("/config/db/atlas.db")
    cursor1 = conn.cursor()
    cursor2 = conn.cursor()
    cursor1.execute("SELECT * FROM hosts")
    cursor2.execute("SELECT * FROM docker_hosts")
    # cursor.execute("SELECT * FROM docker_hosts")
    rows1 = cursor1.fetchall()
    rows2 = cursor2.fetchall()
    conn.close()
    return [rows1, rows2]

# @app.get("/docker_hosts")
# def get_docker_hosts():
#     conn = sqlite3.connect("/config/db/atlas.db")
#     cursor = conn.cursor()
#     cursor.execute("SELECT * FROM docker_hosts")
#     rows = cursor.fetchall()
#     conn.close()
#     return rows

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify specific domains like ["http://localhost"]
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods like GET, POST, etc.
    allow_headers=["*"],  # Allow all headers
)
