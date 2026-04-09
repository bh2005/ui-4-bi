"""
Authentifizierungs-Manager:
  - JWT erstellen / prüfen
  - Lokale Auth (via UserStore)
  - LDAP Auth
  - Checkmk Auth (REST API)
  - FastAPI-Dependencies: require_auth, require_admin
"""
import os, secrets, httpx
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt                      # PyJWT
from fastapi import Request, HTTPException

# ── JWT-Secret (persistent in data/.jwt_secret) ───────────────────────────
_SECRET_FILE = Path(os.getenv("SAVE_FILE", "data/saved_graph.json")).parent / ".jwt_secret"
_SECRET_FILE.parent.mkdir(parents=True, exist_ok=True)
if _SECRET_FILE.exists():
    JWT_SECRET = _SECRET_FILE.read_text().strip()
else:
    JWT_SECRET = secrets.token_hex(32)
    _SECRET_FILE.write_text(JWT_SECRET)

ALGORITHM       = "HS256"
EXPIRE_MINUTES  = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))   # 8 Stunden
AUTH_ENABLED    = os.getenv("AUTH_ENABLED", "false").lower() == "true"

# ── LDAP-Konfiguration ────────────────────────────────────────────────────
LDAP_URL          = os.getenv("LDAP_URL", "")
LDAP_BIND_DN      = os.getenv("LDAP_BIND_DN", "")
LDAP_BIND_PW      = os.getenv("LDAP_BIND_PASSWORD", "")
LDAP_USER_BASE    = os.getenv("LDAP_USER_BASE", "")
LDAP_USER_FILTER  = os.getenv("LDAP_USER_FILTER", "(uid={username})")
LDAP_ADMIN_GROUP  = os.getenv("LDAP_ADMIN_GROUP", "")
LDAP_MAIL_ATTR    = os.getenv("LDAP_MAIL_ATTR", "mail")
LDAP_GROUP_ATTR   = os.getenv("LDAP_GROUP_ATTR", "memberOf")

# ── Checkmk-Konfiguration ─────────────────────────────────────────────────
CMK_URL    = os.getenv("CMK_URL", "").rstrip("/")
CMK_VERIFY = os.getenv("CMK_SSL_VERIFY", "false").lower() == "true"


# ── Token ─────────────────────────────────────────────────────────────────
def create_token(user: dict) -> str:
    payload = {
        "sub":       user["username"],
        "id":        user.get("id", user["username"]),
        "role":      user.get("role", "user"),
        "auth_type": user.get("auth_type", "local"),
        "exp":       datetime.now(timezone.utc) + timedelta(minutes=EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    except Exception:
        return None


# ── LDAP ──────────────────────────────────────────────────────────────────
def auth_ldap(username: str, password: str) -> Optional[dict]:  # pragma: no cover
    if not LDAP_URL or not LDAP_USER_BASE:
        return None
    try:
        from ldap3 import Server, Connection, ALL, SUBTREE
        server = Server(LDAP_URL, get_info=ALL)
        # Bind mit Service-Account um User-DN zu finden
        bind_conn = Connection(server, LDAP_BIND_DN, LDAP_BIND_PW, auto_bind=True)
        user_filter = LDAP_USER_FILTER.format(username=username)
        bind_conn.search(
            LDAP_USER_BASE, user_filter,
            search_scope=SUBTREE,
            attributes=[LDAP_MAIL_ATTR, LDAP_GROUP_ATTR, "cn"],
        )
        if not bind_conn.entries:
            return None
        entry   = bind_conn.entries[0]
        user_dn = entry.entry_dn
        groups  = [str(g) for g in entry[LDAP_GROUP_ATTR]] if LDAP_GROUP_ATTR in entry else []
        email   = str(entry[LDAP_MAIL_ATTR]) if LDAP_MAIL_ATTR in entry else ""

        # Passwort prüfen durch Bind als User
        user_conn = Connection(server, user_dn, password, auto_bind=True)
        user_conn.unbind()

        role = "admin" if (LDAP_ADMIN_GROUP and LDAP_ADMIN_GROUP in groups) else "user"
        return {
            "id":        f"ldap_{username}",
            "username":  username,
            "role":      role,
            "auth_type": "ldap",
            "email":     email,
        }
    except Exception as e:
        return None


# ── Checkmk ───────────────────────────────────────────────────────────────
def auth_checkmk(username: str, password: str) -> Optional[dict]:  # pragma: no cover
    if not CMK_URL:
        return None
    try:
        # Einfacher Test: GET /version mit Basic-Auth
        r = httpx.get(
            f"{CMK_URL}/check_mk/api/1.0/version",
            auth=(username, password),
            timeout=5,
            verify=CMK_VERIFY,
        )
        if r.status_code != 200:
            return None

        # Rolle aus CMK-Benutzerprofil ermitteln
        role = "user"
        try:
            ur = httpx.get(
                f"{CMK_URL}/check_mk/api/1.0/objects/user_config/{username}",
                auth=(username, password),
                timeout=5,
                verify=CMK_VERIFY,
            )
            if ur.status_code == 200:
                cmk_roles = ur.json().get("extensions", {}).get("roles", [])
                if "admin" in cmk_roles:
                    role = "admin"
        except Exception:
            pass

        return {
            "id":        f"cmk_{username}",
            "username":  username,
            "role":      role,
            "auth_type": "checkmk",
            "email":     "",
        }
    except Exception:
        return None


# ── FastAPI Dependencies ──────────────────────────────────────────────────
def _extract_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.cookies.get("bi_token")


def require_auth(request: Request) -> dict:
    """Dependency: gibt aktuellen User zurück oder wirft 401."""
    if not AUTH_ENABLED:
        return {"username": "anonymous", "role": "admin", "id": "anon", "auth_type": "none"}
    token = _extract_token(request)
    if not token:
        raise HTTPException(401, "Nicht authentifiziert")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(401, "Token ungültig oder abgelaufen")
    return payload


def require_admin(request: Request) -> dict:
    """Dependency: wie require_auth, aber nur für Admins."""
    user = require_auth(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Administratorrechte erforderlich")
    return user
