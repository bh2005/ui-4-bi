"""
Lokale Benutzerverwaltung – speichert Benutzer in data/users.json.
Beim ersten Start wird ein Admin-Benutzer (admin/admin) angelegt.
"""
import os, json, uuid, hashlib, hmac, secrets
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

USERS_FILE = Path(os.getenv("USERS_FILE", "data/users.json"))


def _hash_pw(password: str) -> str:
    """PBKDF2-HMAC-SHA256 mit zufälligem Salt."""
    salt = secrets.token_hex(16)
    dk   = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return f"{salt}${dk.hex()}"


def _verify_pw(password: str, stored: str) -> bool:
    try:
        salt, dk_hex = stored.split("$", 1)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


class UserStore:
    def __init__(self, path: Path = USERS_FILE):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._init_default()

    def _init_default(self):
        admin = {
            "id":            str(uuid.uuid4()),
            "username":      "admin",
            "password_hash": _hash_pw("admin"),
            "role":          "admin",
            "auth_type":     "local",
            "email":         "",
            "created_at":    datetime.now(timezone.utc).isoformat(),
            "last_login":    None,
            "active":        True,
        }
        self._save([admin])
        print("⚠  ERSTER START: Benutzer 'admin' mit Passwort 'admin' angelegt.")  # pragma: no cover
        print("   Bitte sofort in der Benutzerverwaltung ändern!")  # pragma: no cover

    def _load(self) -> list:
        return json.loads(self.path.read_text(encoding="utf-8"))

    def _save(self, users: list):
        self.path.write_text(json.dumps(users, indent=2, ensure_ascii=False), encoding="utf-8")

    # ── Lesen ──────────────────────────────────────────────────────────────
    def get_all(self) -> list:
        return self._load()

    def get_by_id(self, user_id: str) -> Optional[dict]:
        return next((u for u in self._load() if u["id"] == user_id), None)

    def get_by_username(self, username: str) -> Optional[dict]:
        return next((u for u in self._load() if u["username"] == username), None)

    def count(self) -> int:
        return len(self._load())

    # ── Schreiben ──────────────────────────────────────────────────────────
    def create(self, username: str, password: str = "",
               role: str = "user", auth_type: str = "local",
               email: str = "") -> tuple[Optional[dict], Optional[str]]:
        users = self._load()
        if any(u["username"] == username for u in users):
            return None, "Benutzername bereits vergeben"
        user = {
            "id":            str(uuid.uuid4()),
            "username":      username,
            "password_hash": _hash_pw(password) if auth_type == "local" and password else "",
            "role":          role,
            "auth_type":     auth_type,
            "email":         email,
            "created_at":    datetime.now(timezone.utc).isoformat(),
            "last_login":    None,
            "active":        True,
        }
        users.append(user)
        self._save(users)
        return user, None

    def update(self, user_id: str, **kwargs) -> Optional[dict]:
        users = self._load()
        for u in users:
            if u["id"] == user_id:
                if "password" in kwargs:
                    u["password_hash"] = _hash_pw(kwargs.pop("password"))
                for k, v in kwargs.items():
                    if k not in ("id", "password_hash", "created_at"):
                        u[k] = v
                self._save(users)
                return u
        return None

    def delete(self, user_id: str):
        users = [u for u in self._load() if u["id"] != user_id]
        self._save(users)

    def touch_login(self, user_id: str):
        self.update(user_id, last_login=datetime.now(timezone.utc).isoformat())

    # ── Authentifizierung ──────────────────────────────────────────────────
    def verify_local(self, username: str, password: str) -> Optional[dict]:
        u = self.get_by_username(username)
        if not u or u.get("auth_type") != "local" or not u.get("active", True):
            return None
        return u if _verify_pw(password, u["password_hash"]) else None

    # ── Sicheres User-Dict (ohne Passwort-Hash) ───────────────────────────
    @staticmethod
    def safe(user: dict) -> dict:
        return {k: v for k, v in user.items() if k != "password_hash"}
