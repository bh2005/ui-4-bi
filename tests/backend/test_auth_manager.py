"""
Tests für auth_manager.py:
  - JWT erstellen und dekodieren
  - Abgelaufene Tokens
  - require_auth (AUTH_ENABLED true/false)
  - require_admin
"""
import importlib, sys, time
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock


def _load_auth(tmp_data):
    """Lädt auth_manager frisch mit tmp-Pfad für jwt_secret."""
    import auth_manager as am
    importlib.reload(am)
    return am


class TestJWT:
    def test_create_and_decode(self, tmp_data):
        am = _load_auth(tmp_data)
        user = {"username": "alice", "id": "u1", "role": "admin", "auth_type": "local"}
        token = am.create_token(user)
        assert isinstance(token, str)
        payload = am.decode_token(token)
        assert payload["sub"] == "alice"
        assert payload["role"] == "admin"

    def test_decode_invalid_token(self, tmp_data):
        am = _load_auth(tmp_data)
        assert am.decode_token("not.a.jwt") is None

    def test_decode_wrong_secret(self, tmp_data):
        am = _load_auth(tmp_data)
        user = {"username": "bob", "id": "u2", "role": "user", "auth_type": "local"}
        token = am.create_token(user)
        # Payload mit anderem Secret kodieren → ungültig
        import jwt as pyjwt
        bad = pyjwt.encode({"sub": "bob"}, "wrong_secret", algorithm="HS256")
        assert am.decode_token(bad) is None

    def test_expired_token_rejected(self, tmp_data):
        am = _load_auth(tmp_data)
        import jwt as pyjwt
        from datetime import datetime, timedelta, timezone
        payload = {
            "sub": "carol", "id": "u3", "role": "user", "auth_type": "local",
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        }
        expired = pyjwt.encode(payload, am.JWT_SECRET, algorithm="HS256")
        assert am.decode_token(expired) is None

    def test_token_contains_auth_type(self, tmp_data):
        am = _load_auth(tmp_data)
        user = {"username": "dave", "id": "u4", "role": "user", "auth_type": "ldap"}
        token = am.create_token(user)
        payload = am.decode_token(token)
        assert payload["auth_type"] == "ldap"


class TestRequireAuth:
    def _make_request(self, token=None):
        req = MagicMock()
        req.headers = {"Authorization": f"Bearer {token}"} if token else {}
        req.cookies = {}
        return req

    def test_auth_disabled_returns_anonymous_admin(self, tmp_data, monkeypatch):
        monkeypatch.setenv("AUTH_ENABLED", "false")
        am = _load_auth(tmp_data)
        result = am.require_auth(self._make_request())
        assert result["username"] == "anonymous"
        assert result["role"] == "admin"

    def test_auth_enabled_no_token_raises_401(self, tmp_data, monkeypatch):
        monkeypatch.setenv("AUTH_ENABLED", "true")
        am = _load_auth(tmp_data)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            am.require_auth(self._make_request())
        assert exc.value.status_code == 401

    def test_auth_enabled_valid_token_returns_user(self, tmp_data, monkeypatch):
        monkeypatch.setenv("AUTH_ENABLED", "true")
        am = _load_auth(tmp_data)
        user = {"username": "frank", "id": "u5", "role": "user", "auth_type": "local"}
        token = am.create_token(user)
        result = am.require_auth(self._make_request(token))
        assert result["sub"] == "frank"

    def test_auth_enabled_invalid_token_raises_401(self, tmp_data, monkeypatch):
        monkeypatch.setenv("AUTH_ENABLED", "true")
        am = _load_auth(tmp_data)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            am.require_auth(self._make_request("invalid.token.here"))
        assert exc.value.status_code == 401

    def test_token_in_cookie(self, tmp_data, monkeypatch):
        monkeypatch.setenv("AUTH_ENABLED", "true")
        am = _load_auth(tmp_data)
        user = {"username": "grace", "id": "u6", "role": "user", "auth_type": "local"}
        token = am.create_token(user)
        req = MagicMock()
        req.headers = {}
        req.cookies = {"bi_token": token}
        result = am.require_auth(req)
        assert result["sub"] == "grace"


class TestRequireAdmin:
    def _make_request(self, token=None):
        req = MagicMock()
        req.headers = {"Authorization": f"Bearer {token}"} if token else {}
        req.cookies = {}
        return req

    def test_admin_role_passes(self, tmp_data, monkeypatch):
        monkeypatch.setenv("AUTH_ENABLED", "true")
        am = _load_auth(tmp_data)
        user = {"username": "heidi", "id": "u7", "role": "admin", "auth_type": "local"}
        token = am.create_token(user)
        result = am.require_admin(self._make_request(token))
        assert result["role"] == "admin"

    def test_user_role_raises_403(self, tmp_data, monkeypatch):
        monkeypatch.setenv("AUTH_ENABLED", "true")
        am = _load_auth(tmp_data)
        user = {"username": "ivan", "id": "u8", "role": "user", "auth_type": "local"}
        token = am.create_token(user)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            am.require_admin(self._make_request(token))
        assert exc.value.status_code == 403
