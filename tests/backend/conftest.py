"""
Pytest-Fixtures für alle Backend-Tests.
Jeder Test bekommt ein sauberes tmp-Verzeichnis → keine Seiteneffekte.
"""
import os, sys
import pytest
from pathlib import Path

# ── src/ in PYTHONPATH aufnehmen ──────────────────────────────────────────
SRC = Path(__file__).resolve().parent.parent.parent / "src"
sys.path.insert(0, str(SRC))


@pytest.fixture()
def tmp_data(tmp_path, monkeypatch):
    """Setzt SAVE_FILE und USERS_FILE auf tmp-Pfade, patcht ENV."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    monkeypatch.setenv("SAVE_FILE",   str(data_dir / "graph.json"))
    monkeypatch.setenv("USERS_FILE",  str(data_dir / "users.json"))
    monkeypatch.setenv("AUTH_ENABLED", "false")
    return data_dir


@pytest.fixture()
def user_store(tmp_data):
    """Frische UserStore-Instanz pro Test."""
    # Modul neu laden, damit USERS_FILE aus ENV gezogen wird
    import importlib
    import user_store as us_mod
    importlib.reload(us_mod)
    store = us_mod.UserStore(tmp_data / "users.json")
    return store


@pytest.fixture()
def auth_client(tmp_data, monkeypatch):
    """FastAPI TestClient mit AUTH_ENABLED=true."""
    monkeypatch.setenv("AUTH_ENABLED", "true")
    import importlib, user_store as us_mod, auth_manager, main as app_mod
    importlib.reload(us_mod)
    importlib.reload(auth_manager)
    importlib.reload(app_mod)
    from fastapi.testclient import TestClient
    return TestClient(app_mod.app)


@pytest.fixture()
def anon_client(tmp_data):
    """FastAPI TestClient ohne Auth (AUTH_ENABLED=false)."""
    import importlib, user_store as us_mod, auth_manager, main as app_mod
    importlib.reload(us_mod)
    importlib.reload(auth_manager)
    importlib.reload(app_mod)
    from fastapi.testclient import TestClient
    return TestClient(app_mod.app)
