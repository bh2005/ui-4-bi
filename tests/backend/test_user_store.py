"""
Tests für user_store.py:
  - Default-Admin beim ersten Start
  - PBKDF2-Passwort-Hashing / Verify
  - CRUD (create, get, update, delete)
  - Duplikat-Schutz
  - safe() entfernt password_hash
"""
import pytest


class TestDefaultAdmin:
    def test_default_admin_created(self, user_store):
        users = user_store.get_all()
        assert len(users) == 1
        assert users[0]["username"] == "admin"
        assert users[0]["role"] == "admin"
        assert users[0]["auth_type"] == "local"
        assert users[0]["active"] is True

    def test_default_admin_password_works(self, user_store):
        result = user_store.verify_local("admin", "admin")
        assert result is not None
        assert result["username"] == "admin"

    def test_default_admin_wrong_password(self, user_store):
        assert user_store.verify_local("admin", "wrong") is None


class TestCreate:
    def test_create_user(self, user_store):
        user, err = user_store.create("alice", "secret123", role="user")
        assert err is None
        assert user["username"] == "alice"
        assert user["role"] == "user"
        assert "password_hash" in user
        assert user["password_hash"] != "secret123"   # Hash, nicht Klartext

    def test_create_admin(self, user_store):
        user, _ = user_store.create("bob", "pw", role="admin")
        assert user["role"] == "admin"

    def test_duplicate_username_rejected(self, user_store):
        user_store.create("alice", "pw1")
        user2, err = user_store.create("alice", "pw2")
        assert user2 is None
        assert err is not None

    def test_ldap_user_no_password_hash(self, user_store):
        user, _ = user_store.create("ldapuser", password="", auth_type="ldap")
        assert user["auth_type"] == "ldap"
        assert user["password_hash"] == ""

    def test_create_sets_active_true(self, user_store):
        user, _ = user_store.create("carol", "pw")
        assert user["active"] is True


class TestVerify:
    def test_verify_correct_password(self, user_store):
        user_store.create("dave", "mypassword")
        result = user_store.verify_local("dave", "mypassword")
        assert result is not None
        assert result["username"] == "dave"

    def test_verify_wrong_password(self, user_store):
        user_store.create("eve", "correct")
        assert user_store.verify_local("eve", "wrong") is None

    def test_verify_unknown_user(self, user_store):
        assert user_store.verify_local("nobody", "pw") is None

    def test_verify_inactive_user(self, user_store):
        user, _ = user_store.create("frank", "pw")
        user_store.update(user["id"], active=False)
        assert user_store.verify_local("frank", "pw") is None

    def test_verify_ldap_user_returns_none(self, user_store):
        """LDAP-User hat kein lokales Passwort → verify_local schlägt fehl."""
        user_store.create("ldapuser", password="", auth_type="ldap")
        assert user_store.verify_local("ldapuser", "anything") is None


class TestUpdate:
    def test_update_role(self, user_store):
        user, _ = user_store.create("grace", "pw")
        updated = user_store.update(user["id"], role="admin")
        assert updated["role"] == "admin"

    def test_update_password(self, user_store):
        user, _ = user_store.create("heidi", "oldpw")
        user_store.update(user["id"], password="newpw")
        assert user_store.verify_local("heidi", "newpw") is not None
        assert user_store.verify_local("heidi", "oldpw") is None

    def test_update_unknown_id_returns_none(self, user_store):
        assert user_store.update("nonexistent-id", role="admin") is None

    def test_update_cannot_change_id(self, user_store):
        user, _ = user_store.create("ivan", "pw")
        orig_id = user["id"]
        user_store.update(orig_id, id="hacked")
        refreshed = user_store.get_by_id(orig_id)
        assert refreshed["id"] == orig_id


class TestDelete:
    def test_delete_removes_user(self, user_store):
        user, _ = user_store.create("judy", "pw")
        user_store.delete(user["id"])
        assert user_store.get_by_id(user["id"]) is None

    def test_delete_unknown_id_is_noop(self, user_store):
        before = user_store.count()
        user_store.delete("does-not-exist")
        assert user_store.count() == before


class TestSafe:
    def test_safe_removes_password_hash(self, user_store):
        import user_store as us_mod
        user = {"id": "1", "username": "x", "password_hash": "secret", "role": "user"}
        safe = us_mod.UserStore.safe(user)
        assert "password_hash" not in safe
        assert safe["username"] == "x"

    def test_safe_keeps_all_other_fields(self, user_store):
        import user_store as us_mod
        user = {"id": "1", "username": "x", "password_hash": "h",
                "role": "admin", "email": "x@y.de", "active": True}
        safe = us_mod.UserStore.safe(user)
        assert safe["role"] == "admin"
        assert safe["email"] == "x@y.de"
        assert safe["active"] is True
