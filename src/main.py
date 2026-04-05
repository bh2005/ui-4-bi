import os
import json
import httpx
from pathlib import Path
from collections import defaultdict, deque
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from user_store  import UserStore
from auth_manager import (
    create_token, auth_ldap, auth_checkmk,
    require_auth, require_admin,
    AUTH_ENABLED, LDAP_URL, CMK_URL,
)

app = FastAPI(title="UI4BI Backend", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SAVE_FILE = Path(os.getenv("SAVE_FILE", "saved_graph.json"))
SAVE_FILE.parent.mkdir(parents=True, exist_ok=True)

_users = UserStore()

# ── Modelle ───────────────────────────────────────────────────────────────
class Graph(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username:  str
    password:  str = ""
    role:      str = "user"       # "admin" | "user"
    auth_type: str = "local"      # "local" | "ldap" | "checkmk"
    email:     str = ""

class UserUpdate(BaseModel):
    password:  Optional[str] = None
    role:      Optional[str] = None
    email:     Optional[str] = None
    active:    Optional[bool] = None


# ── Auth: Login ───────────────────────────────────────────────────────────
@app.post("/login")
def login(body: LoginRequest):
    """
    Versucht in dieser Reihenfolge:
      1. Lokale Benutzerdatenbank
      2. LDAP (wenn CMK_URL konfiguriert)
      3. Checkmk REST API (wenn CMK_URL konfiguriert)
    """
    user = None

    # 1. Lokale Auth
    user = _users.verify_local(body.username, body.password)

    # 2. LDAP
    if not user and LDAP_URL:
        ldap_user = auth_ldap(body.username, body.password)
        if ldap_user:
            # LDAP-User in lokaler DB eintragen / aktualisieren (kein Passwort gespeichert)
            existing = _users.get_by_username(body.username)
            if existing:
                _users.update(existing["id"], role=ldap_user["role"], email=ldap_user.get("email",""))
                user = _users.get_by_username(body.username)
            else:
                user, _ = _users.create(
                    username=body.username, password="",
                    role=ldap_user["role"], auth_type="ldap",
                    email=ldap_user.get("email", ""),
                )

    # 3. Checkmk
    if not user and CMK_URL:
        cmk_user = auth_checkmk(body.username, body.password)
        if cmk_user:
            existing = _users.get_by_username(body.username)
            if existing:
                _users.update(existing["id"], role=cmk_user["role"])
                user = _users.get_by_username(body.username)
            else:
                user, _ = _users.create(
                    username=body.username, password="",
                    role=cmk_user["role"], auth_type="checkmk",
                )

    if not user:
        raise HTTPException(401, "Benutzername oder Passwort falsch")
    if not user.get("active", True):
        raise HTTPException(403, "Benutzer ist deaktiviert")

    _users.touch_login(user["id"])
    token = create_token(user)
    return {"token": token, "user": UserStore.safe(user)}


@app.get("/me")
def me(current: dict = Depends(require_auth)):
    """Gibt den aktuell eingeloggten Benutzer zurück."""
    username = current.get("sub") or current.get("username")
    u = _users.get_by_username(username) if username else None
    if u:
        return UserStore.safe(u)
    # Externe User (LDAP/CMK) die nicht (mehr) in der DB sind
    return current

@app.get("/auth/config")
def auth_config():
    """Gibt zurück welche Auth-Methoden aktiv sind (für Login-UI)."""
    return {
        "auth_enabled": AUTH_ENABLED,
        "ldap_enabled": bool(LDAP_URL),
        "cmk_enabled":  bool(CMK_URL),
    }


# ── Benutzerverwaltung (Admin) ────────────────────────────────────────────
@app.get("/users")
def list_users(_: dict = Depends(require_admin)):
    return [UserStore.safe(u) for u in _users.get_all()]


@app.post("/users", status_code=201)
def create_user(body: UserCreate, _: dict = Depends(require_admin)):
    user, err = _users.create(
        username=body.username, password=body.password,
        role=body.role, auth_type=body.auth_type, email=body.email,
    )
    if err:
        status = 409 if "bereits vergeben" in err else 400
        raise HTTPException(status, err)
    return UserStore.safe(user)


@app.put("/users/{user_id}")
def update_user(user_id: str, body: UserUpdate, _: dict = Depends(require_admin)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    user = _users.update(user_id, **updates)
    if not user:
        raise HTTPException(404, "Benutzer nicht gefunden")
    return UserStore.safe(user)


@app.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: str, _: dict = Depends(require_admin)):
    # Letzten Admin nicht löschen
    target = _users.get_by_id(user_id)
    if not target:
        raise HTTPException(404, "Benutzer nicht gefunden")
    admins = [u for u in _users.get_all() if u["role"] == "admin" and u.get("active", True)]
    if target["role"] == "admin" and len(admins) <= 1:
        raise HTTPException(409, "Letzten Administrator kann nicht gelöscht werden")
    _users.delete(user_id)


@app.put("/me/password")
def change_own_password(body: dict, current: dict = Depends(require_auth)):
    """Benutzer ändert sein eigenes Passwort."""
    username = current.get("sub") or current.get("username")
    u = _users.get_by_username(username) if username else None
    if not u or u.get("auth_type") != "local":
        raise HTTPException(400, "Passwort nur für lokale Benutzer änderbar")
    if not body.get("new_password"):
        raise HTTPException(400, "Neues Passwort fehlt")
    old_pw = body.get("old_password", "")
    if old_pw and not _users.verify_local(username, old_pw):
        raise HTTPException(400, "Altes Passwort falsch")
    _users.update(u["id"], password=body["new_password"])
    return {"ok": True}


# ── Graph speichern ───────────────────────────────────────────────────────
@app.post("/save")
def save_graph(graph: Graph, _: dict = Depends(require_auth)):
    with SAVE_FILE.open("w", encoding="utf-8") as f:
        json.dump(graph.model_dump(), f, indent=2)
    return {"status": "saved"}


@app.get("/load")
def load_graph(_: dict = Depends(require_auth)):
    if not SAVE_FILE.exists():
        raise HTTPException(404, "Kein gespeicherter Graph gefunden")
    with SAVE_FILE.open(encoding="utf-8") as f:
        return json.load(f)


# ── Graph validieren ──────────────────────────────────────────────────────
@app.post("/validate")
def validate_graph(graph: Graph, _: dict = Depends(require_auth)):
    adj      = defaultdict(list)
    indegree: Dict[Any, int] = defaultdict(int)
    node_ids = {n["id"] for n in graph.nodes}
    for e in graph.edges:
        if e["from"] not in node_ids or e["to"] not in node_ids:
            continue
        adj[e["from"]].append(e["to"])
        indegree[e["to"]] += 1
    q     = deque([nid for nid in node_ids if indegree[nid] == 0])
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


# ── Audit-Log ─────────────────────────────────────────────────────────────
audit_entries: List[Dict[str, Any]] = []

@app.post("/audit")
def post_audit(entry: dict, _: dict = Depends(require_auth)):
    audit_entries.insert(0, entry)
    if len(audit_entries) > 1000:
        audit_entries.pop()
    return {"ok": True}

@app.get("/audit")
def get_audit(_: dict = Depends(require_auth)):
    return {"entries": audit_entries}


# ── CMK-Proxy Endpoints ───────────────────────────────────────────────────
CMK_USER   = os.getenv("CMK_USER",   "automation")
CMK_SECRET = os.getenv("CMK_SECRET", "")

def _cmk_headers() -> dict:
    return {"Authorization": f"Bearer {CMK_USER} {CMK_SECRET}", "Accept": "application/json"}

def _cmk_available() -> bool:
    return bool(CMK_URL and CMK_SECRET)


@app.get("/cmk/status")
def cmk_status(_: dict = Depends(require_auth)):
    if not _cmk_available():
        return {"configured": False, "reachable": False,
                "hint": "CMK_URL und CMK_SECRET in .env setzen"}
    try:
        r = httpx.get(f"{CMK_URL}/check_mk/api/1.0/version",
                      headers=_cmk_headers(), timeout=5, verify=False)
        return {"configured": True, "reachable": r.status_code == 200,
                "cmk_version": r.json().get("versions", {}).get("checkmk", "?")}
    except Exception as e:
        return {"configured": True, "reachable": False, "error": str(e)}


@app.get("/cmk/hosts")
def get_hosts(search: Optional[str] = Query(None), _: dict = Depends(require_auth)):
    if not _cmk_available():
        return {"items": _MOCK_HOSTS, "source": "mock"}
    try:
        r = httpx.get(
            f"{CMK_URL}/check_mk/api/1.0/domain-types/host_config/collections/all",
            headers=_cmk_headers(), params={"columns": ["name"]}, timeout=10, verify=False,
        )
        r.raise_for_status()
        hosts = [h["id"] for h in r.json().get("value", [])]
        if search:
            hosts = [h for h in hosts if search.lower() in h.lower()]
        return {"items": hosts, "source": "checkmk"}
    except Exception as e:
        return {"items": _MOCK_HOSTS, "source": "mock", "error": str(e)}


@app.get("/cmk/services")
def get_services(search: Optional[str] = Query(None), _: dict = Depends(require_auth)):
    if not _cmk_available():
        return {"items": _MOCK_SERVICES, "source": "mock"}
    try:
        r = httpx.get(
            f"{CMK_URL}/check_mk/api/1.0/domain-types/service/collections/all",
            headers=_cmk_headers(), params={"columns": ["description"]}, timeout=10, verify=False,
        )
        r.raise_for_status()
        svcs = sorted({s["extensions"]["description"] for s in r.json().get("value", [])})
        if search:
            svcs = [s for s in svcs if search.lower() in s.lower()]
        return {"items": svcs[:200], "source": "checkmk"}
    except Exception as e:
        return {"items": _MOCK_SERVICES, "source": "mock", "error": str(e)}


@app.get("/cmk/hostgroups")
def get_hostgroups(search: Optional[str] = Query(None), _: dict = Depends(require_auth)):
    if not _cmk_available():
        return {"items": _MOCK_HOSTGROUPS, "source": "mock"}
    try:
        r = httpx.get(
            f"{CMK_URL}/check_mk/api/1.0/domain-types/host_group_config/collections/all",
            headers=_cmk_headers(), timeout=10, verify=False,
        )
        r.raise_for_status()
        groups = [g["id"] for g in r.json().get("value", [])]
        if search:
            groups = [g for g in groups if search.lower() in g.lower()]
        return {"items": groups, "source": "checkmk"}
    except Exception as e:
        return {"items": _MOCK_HOSTGROUPS, "source": "mock", "error": str(e)}


@app.get("/cmk/servicegroups")
def get_servicegroups(search: Optional[str] = Query(None), _: dict = Depends(require_auth)):
    if not _cmk_available():
        return {"items": _MOCK_SERVICEGROUPS, "source": "mock"}
    try:
        r = httpx.get(
            f"{CMK_URL}/check_mk/api/1.0/domain-types/service_group_config/collections/all",
            headers=_cmk_headers(), timeout=10, verify=False,
        )
        r.raise_for_status()
        groups = [g["id"] for g in r.json().get("value", [])]
        if search:
            groups = [g for g in groups if search.lower() in g.lower()]
        return {"items": groups, "source": "checkmk"}
    except Exception as e:
        return {"items": _MOCK_SERVICEGROUPS, "source": "mock", "error": str(e)}


@app.get("/cmk/bi-packs")
def get_bi_packs(search: Optional[str] = Query(None), _: dict = Depends(require_auth)):
    if not _cmk_available():
        return {"items": _MOCK_BI, "source": "mock"}
    try:
        r = httpx.get(
            f"{CMK_URL}/check_mk/api/1.0/domain-types/bi_pack/collections/all",
            headers=_cmk_headers(), timeout=10, verify=False,
        )
        r.raise_for_status()
        packs = [p["id"] for p in r.json().get("value", [])]
        rules = []
        for pid in packs:
            try:
                rr = httpx.get(f"{CMK_URL}/check_mk/api/1.0/objects/bi_pack/{pid}",
                               headers=_cmk_headers(), timeout=5, verify=False)
                if rr.status_code == 200:
                    rules += [rule["id"] for rule in rr.json().get("rules", [])]
            except Exception:
                pass
        items = sorted({*packs, *rules})
        if search:
            items = [i for i in items if search.lower() in i.lower()]
        return {"items": items, "source": "checkmk"}
    except Exception as e:
        return {"items": _MOCK_BI, "source": "mock", "error": str(e)}


@app.get("/cmk/bi-pack/{pack_id}")
def get_bi_pack(pack_id: str, _: dict = Depends(require_auth)):
    if not _cmk_available():
        raise HTTPException(503, "CMK_URL / CMK_SECRET nicht konfiguriert")
    r = httpx.get(f"{CMK_URL}/check_mk/api/1.0/objects/bi_pack/{pack_id}",
                  headers=_cmk_headers(), timeout=15, verify=False)
    if r.status_code == 404:
        raise HTTPException(404, f"BI Pack '{pack_id}' nicht gefunden")
    r.raise_for_status()
    return r.json()


@app.get("/tree")
def get_tree():
    return {"name": "BI Rules", "children": [
        {"name": "Windows Servers", "type": "folder"},
        {"name": "Critical Services", "type": "folder"},
    ]}


# ── Mock-Daten ────────────────────────────────────────────────────────────
_MOCK_HOSTS         = ["web-prod-01","web-prod-02","db-master","db-replica","app-server-01","app-server-02","redis-01","lb-frontend","monitoring-01","backup-server","mail-relay","vpn-gateway"]
_MOCK_SERVICES      = ["HTTP Check","Ping","CPU Load","Memory","Disk Usage","SSH","HTTPS Certificate","Database Connection","NTP","SNMP"]
_MOCK_HOSTGROUPS    = ["Linux Servers","Windows Servers","Network Devices","Storage Systems","Virtualization Hosts","DMZ Hosts"]
_MOCK_SERVICEGROUPS = ["HTTP Services","Database Services","Monitoring Services","Backup Services","Security Services"]
_MOCK_BI            = ["my_bi_collection","infrastructure","frontend_stack","database_cluster","payment_platform"]

# uvicorn main:app --reload
