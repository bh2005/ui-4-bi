from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import json
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

app = FastAPI()

SAVE_FILE = Path("saved_graph.json")

class Graph(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    # nextId usw. optional

# Mock Tree (später echte CMK Daten)
@app.get("/tree")
def get_tree():
    return {
        "name": "BI Rules",
        "children": [
            {"name": "Windows Servers", "type": "folder"},
            {"name": "Critical Services", "type": "folder"},
        ]
    }

@app.post("/save")
def save_graph(graph: Graph):
    with SAVE_FILE.open("w", encoding="utf-8") as f:
        json.dump(graph.dict(), f, indent=2)
    return {"status": "saved"}

@app.post("/validate")
def validate_graph(graph: Graph):
    # Einfache Zyklen-Prüfung (Topological Sort oder DFS)
    from collections import defaultdict, deque

    adj = defaultdict(list)
    indegree = defaultdict(int)

    node_ids = {n["id"] for n in graph.nodes}
    for e in graph.edges:
        if e["from"] not in node_ids or e["to"] not in node_ids:
            continue
        adj[e["from"]].append(e["to"])
        indegree[e["to"]] += 1

    # Kahn's Algorithm
    q = deque([nid for nid in node_ids if indegree[nid] == 0])
    count = 0

    while q:
        cur = q.popleft()
        count += 1
        for nei in adj[cur]:
            indegree[nei] -= 1
            if indegree[nei] == 0:
                q.append(nei)

    if count != len(node_ids):
        return {"valid": False, "message": "Zirkuläre Abhängigkeit erkannt!"}
    return {"valid": True, "message": "Alles in Ordnung"}

# Phase 3B: Audit-Log Endpoint
audit_entries: List[Dict[str, Any]] = []  # in-memory, max 1000

@app.post("/audit")
def post_audit(entry: dict):
    audit_entries.insert(0, entry)
    if len(audit_entries) > 1000:
        audit_entries.pop()
    return {"ok": True}

@app.get("/audit")
def get_audit():
    return {"entries": audit_entries}

# uvicorn main:app --reload
