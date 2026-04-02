"""
Integrationstests für die FastAPI-Endpoints (main.py).
Nutzt TestClient mit AUTH_ENABLED=false (anon_client) und =true (auth_client).
"""
import pytest


# ── Hilfsfunktionen ────────────────────────────────────────────────────────

def _login(client, username="admin", password="admin"):
    r = client.post("/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"]

def _auth_header(token):
    return {"Authorization": f"Bearer {token}"}


# ── Auth-Endpoints ─────────────────────────────────────────────────────────

class TestAuthEndpoints:
    def test_auth_config_returns_json(self, anon_client):
        r = anon_client.get("/auth/config")
        assert r.status_code == 200
        data = r.json()
        assert "auth_enabled" in data
        assert "ldap_enabled" in data
        assert "cmk_enabled" in data

    def test_login_with_valid_credentials(self, auth_client):
        r = auth_client.post("/login", json={"username": "admin", "password": "admin"})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["user"]["username"] == "admin"
        assert data["user"]["role"] == "admin"

    def test_login_wrong_password_returns_401(self, auth_client):
        r = auth_client.post("/login", json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401

    def test_login_unknown_user_returns_401(self, auth_client):
        r = auth_client.post("/login", json={"username": "nobody", "password": "pw"})
        assert r.status_code == 401

    def test_me_with_valid_token(self, auth_client):
        token = _login(auth_client)
        r = auth_client.get("/me", headers=_auth_header(token))
        assert r.status_code == 200
        assert r.json()["username"] == "admin"

    def test_me_without_token_returns_401(self, auth_client):
        r = auth_client.get("/me")
        assert r.status_code == 401

    def test_me_anon_mode(self, anon_client):
        r = anon_client.get("/me")
        assert r.status_code == 200
        assert r.json()["username"] == "anonymous"


# ── Benutzerverwaltung ─────────────────────────────────────────────────────

class TestUserEndpoints:
    def test_list_users_anon(self, anon_client):
        r = anon_client.get("/users")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_users_no_password_hash(self, anon_client):
        r = anon_client.get("/users")
        for u in r.json():
            assert "password_hash" not in u

    def test_create_user(self, anon_client):
        r = anon_client.post("/users", json={
            "username": "newuser", "password": "pw123",
            "role": "user", "auth_type": "local", "email": "new@test.de"
        })
        assert r.status_code == 201
        data = r.json()
        assert data["username"] == "newuser"
        assert "password_hash" not in data

    def test_create_duplicate_user_returns_409(self, anon_client):
        anon_client.post("/users", json={"username": "dup", "password": "pw", "role": "user"})
        r = anon_client.post("/users", json={"username": "dup", "password": "pw2", "role": "user"})
        assert r.status_code == 409

    def test_update_user_role(self, anon_client):
        r = anon_client.post("/users", json={"username": "judy", "password": "pw", "role": "user"})
        uid = r.json()["id"]
        r2 = anon_client.put(f"/users/{uid}", json={"role": "admin"})
        assert r2.status_code == 200
        assert r2.json()["role"] == "admin"

    def test_delete_user(self, anon_client):
        r = anon_client.post("/users", json={"username": "todelete", "password": "pw", "role": "user"})
        uid = r.json()["id"]
        r2 = anon_client.delete(f"/users/{uid}")
        assert r2.status_code == 204

    def test_delete_last_admin_returns_409(self, anon_client):
        """Der letzte aktive Admin darf nicht gelöscht werden."""
        users = anon_client.get("/users").json()
        admin = next(u for u in users if u["role"] == "admin")
        r = anon_client.delete(f"/users/{admin['id']}")
        assert r.status_code == 409

    def test_change_own_password(self, auth_client):
        token = _login(auth_client)
        r = auth_client.put("/me/password",
            json={"old_password": "admin", "new_password": "newadmin123"},
            headers=_auth_header(token))
        assert r.status_code == 200
        # Neu-Login mit altem Passwort schlägt fehl
        r2 = auth_client.post("/login", json={"username": "admin", "password": "admin"})
        assert r2.status_code == 401
        # Neu-Login mit neuem Passwort klappt
        r3 = auth_client.post("/login", json={"username": "admin", "password": "newadmin123"})
        assert r3.status_code == 200

    def test_change_password_wrong_old_returns_400(self, auth_client):
        token = _login(auth_client)
        r = auth_client.put("/me/password",
            json={"old_password": "falsch", "new_password": "neu"},
            headers=_auth_header(token))
        assert r.status_code == 400


# ── Graph-Endpoints ────────────────────────────────────────────────────────

SAMPLE_GRAPH = {
    "nodes": [
        {"id": 1, "type": "host",       "label": "web-01", "x": 100, "y": 100, "color": "#A5D6A7"},
        {"id": 2, "type": "aggregator", "label": "Core",   "x": 300, "y": 100, "color": "#13d38e", "aggType": "worst"},
    ],
    "edges": [
        {"id": "e1", "from": 1, "to": 2, "routing": "straight"}
    ]
}

class TestGraphEndpoints:
    def test_save_graph(self, anon_client):
        r = anon_client.post("/save", json=SAMPLE_GRAPH)
        assert r.status_code == 200
        assert r.json()["status"] == "saved"

    def test_load_after_save(self, anon_client):
        anon_client.post("/save", json=SAMPLE_GRAPH)
        r = anon_client.get("/load")
        assert r.status_code == 200
        data = r.json()
        assert len(data["nodes"]) == 2
        assert len(data["edges"]) == 1

    def test_validate_valid_graph(self, anon_client):
        r = anon_client.post("/validate", json=SAMPLE_GRAPH)
        assert r.status_code == 200
        assert r.json()["valid"] is True

    def test_validate_cyclic_graph(self, anon_client):
        cyclic = {
            "nodes": [
                {"id": 1, "type": "aggregator", "label": "A", "x": 0, "y": 0},
                {"id": 2, "type": "aggregator", "label": "B", "x": 100, "y": 0},
            ],
            "edges": [
                {"id": "e1", "from": 1, "to": 2},
                {"id": "e2", "from": 2, "to": 1},
            ]
        }
        r = anon_client.post("/validate", json=cyclic)
        assert r.status_code == 200
        assert r.json()["valid"] is False

    def test_validate_empty_graph(self, anon_client):
        r = anon_client.post("/validate", json={"nodes": [], "edges": []})
        assert r.status_code == 200
        assert r.json()["valid"] is True

    def test_audit_log_entry(self, anon_client):
        anon_client.post("/save", json=SAMPLE_GRAPH)
        r = anon_client.post("/audit", json={
            "action": "Test-Aktion", "detail": "Details", "user": "testuser"
        })
        assert r.status_code in (200, 201, 204)

    def test_protected_endpoint_requires_auth(self, auth_client):
        """Ohne Token auf /save schlägt fehl wenn AUTH_ENABLED=true."""
        r = auth_client.post("/save", json=SAMPLE_GRAPH)
        assert r.status_code == 401
