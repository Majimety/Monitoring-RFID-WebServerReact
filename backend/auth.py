from flask import Blueprint, request, jsonify
import sqlite3
import os
import hashlib
from datetime import datetime, timedelta
from functools import wraps
import jwt

# สร้าง Blueprint
auth_bp = Blueprint("auth", __name__)

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.abspath(os.path.join(BASE_DIR, "database.db"))


# =====================
# Database Helper
# =====================
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_auth_db():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                phone TEXT DEFAULT '',
                role TEXT DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                is_active BOOLEAN DEFAULT 1
            )
            """
        )
        # Migration: เพิ่มคอลัมน์ phone ถ้ายังไม่มี (backward compat)
        try:
            cursor.execute("ALTER TABLE admin_users ADD COLUMN phone TEXT DEFAULT ''")
        except Exception:
            pass  # คอลัมน์มีอยู่แล้ว ข้ามได้

        conn.commit()


# =====================
# Password Hashing
# Bug #3 แก้: เปลี่ยนจาก SHA-256 ธรรมดา → bcrypt ที่ปลอดภัยกว่า
# ถ้าระบบเดิมมี user อยู่แล้ว จะใช้ try_bcrypt_then_sha256() สำหรับ login
# =====================
def _sha256_hash(password: str) -> str:
    """Legacy hash — ใช้แค่ตอน migrate เท่านั้น"""
    return hashlib.sha256(password.encode()).hexdigest()


def hash_password(password: str) -> str:
    """Hash รหัสผ่านด้วย bcrypt (ปลอดภัยกว่า SHA-256)"""
    try:
        import bcrypt

        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
    except ImportError:
        # Fallback ถ้าไม่ได้ติดตั้ง bcrypt (ใช้ SHA-256 เหมือนเดิม)
        return _sha256_hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """
    ตรวจสอบรหัสผ่าน — รองรับทั้ง bcrypt และ SHA-256 (legacy)
    ทำให้ migrate จาก SHA-256 → bcrypt ได้โดยไม่ต้อง reset password ทุกคน
    """
    try:
        import bcrypt

        # bcrypt hash จะขึ้นต้นด้วย $2b$ หรือ $2a$
        if password_hash.startswith("$2"):
            return bcrypt.checkpw(
                password.encode("utf-8"), password_hash.encode("utf-8")
            )
        else:
            # Legacy SHA-256 — ยังให้ login ได้ แล้วจะ rehash ทีหลัง
            return _sha256_hash(password) == password_hash
    except ImportError:
        return _sha256_hash(password) == password_hash


# =====================
# JWT Auth Decorator (shared ระหว่าง auth กับ booking)
# =====================
def token_required(f):
    """Decorator ตรวจสอบ JWT token — ใช้ได้ทั้งใน auth_bp และ booking_bp"""

    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({"error": "Invalid token format"}), 401

        if not token:
            return jsonify({"error": "Token is missing"}), 401

        try:
            from flask import current_app

            data = jwt.decode(
                token, current_app.config["SECRET_KEY"], algorithms=["HS256"]
            )
            current_user = {
                "user_id": data["user_id"],
                "email": data["email"],
                "role": data["role"],
            }
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        return f(current_user, *args, **kwargs)

    return decorated


# =====================
# Routes
# =====================


@auth_bp.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()

    email = data.get("email", "").strip().lower()
    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    password = data.get("password", "")

    if not all([email, first_name, last_name, password]):
        return jsonify({"error": "All fields are required"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT id FROM admin_users WHERE email = ?", (email,))
            if cursor.fetchone():
                return jsonify({"error": "Email already registered"}), 409

            password_hash = hash_password(password)  # bcrypt แล้ว

            cursor.execute(
                """
                INSERT INTO admin_users (email, first_name, last_name, password_hash)
                VALUES (?, ?, ?, ?)
                """,
                (email, first_name, last_name, password_hash),
            )
            conn.commit()

        return jsonify({"success": True}), 201

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api/login", methods=["POST"])
def login():
    from flask import current_app

    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, email, first_name, last_name, password_hash, role, phone
            FROM admin_users WHERE email = ? AND is_active = 1
            """,
            (email,),
        )
        user = cursor.fetchone()

        if not user or not verify_password(password, user["password_hash"]):
            return jsonify({"error": "Invalid credentials"}), 401

        # Bug fix: ถ้า hash เดิมเป็น SHA-256 (legacy) → rehash เป็น bcrypt ทันที
        if not user["password_hash"].startswith("$2"):
            try:
                new_hash = hash_password(password)
                cursor.execute(
                    "UPDATE admin_users SET password_hash = ? WHERE id = ?",
                    (new_hash, user["id"]),
                )
                conn.commit()
            except Exception:
                pass  # rehash ไม่สำเร็จก็ไม่ block login

        # อัปเดต last_login
        cursor.execute(
            "UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
            (user["id"],),
        )
        conn.commit()

    expiration = datetime.utcnow() + timedelta(hours=24)
    payload = {
        "user_id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "exp": expiration,
    }
    from flask import current_app

    token = jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")

    user_info = {
        "id": user["id"],
        "email": user["email"],
        "first_name": user["first_name"],
        "last_name": user["last_name"],
        "role": user["role"],
        "phone": user["phone"] or "",
    }

    return jsonify({"token": token, "user": user_info})


# =====================
# Bug #2 Fix: Profile Update API
# =====================
@auth_bp.route("/api/profile/update", methods=["PUT"])
@token_required
def update_profile(current_user):
    """อัปเดตข้อมูลโปรไฟล์ของผู้ใช้ที่ login อยู่"""
    data = request.get_json()

    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    phone = data.get("phone", "").strip()
    new_password = data.get("password", "")

    if not first_name or not last_name:
        return jsonify({"error": "ชื่อและนามสกุลจำเป็นต้องกรอก"}), 400

    if new_password and len(new_password) < 6:
        return jsonify({"error": "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            if new_password:
                # เปลี่ยนรหัสผ่านด้วย
                new_hash = hash_password(new_password)
                cursor.execute(
                    """
                    UPDATE admin_users
                    SET first_name = ?, last_name = ?, phone = ?,
                        password_hash = ?
                    WHERE id = ?
                    """,
                    (first_name, last_name, phone, new_hash, current_user["user_id"]),
                )
            else:
                cursor.execute(
                    """
                    UPDATE admin_users
                    SET first_name = ?, last_name = ?, phone = ?
                    WHERE id = ?
                    """,
                    (first_name, last_name, phone, current_user["user_id"]),
                )

            if cursor.rowcount == 0:
                return jsonify({"error": "ไม่พบผู้ใช้"}), 404

            conn.commit()

        return jsonify(
            {
                "success": True,
                "message": "แก้ไขข้อมูลสำเร็จ",
                "user": {
                    "first_name": first_name,
                    "last_name": last_name,
                    "phone": phone,
                },
            }
        )

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api/profile/me", methods=["GET"])
@token_required
def get_profile(current_user):
    """ดึงข้อมูลโปรไฟล์ของผู้ใช้ที่ login อยู่"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, email, first_name, last_name, phone, role, created_at
                FROM admin_users WHERE id = ? AND is_active = 1
                """,
                (current_user["user_id"],),
            )
            user = cursor.fetchone()

            if not user:
                return jsonify({"error": "ไม่พบผู้ใช้"}), 404

            return jsonify(
                {
                    "success": True,
                    "user": {
                        "id": user["id"],
                        "email": user["email"],
                        "first_name": user["first_name"],
                        "last_name": user["last_name"],
                        "phone": user["phone"] or "",
                        "role": user["role"],
                        "created_at": user["created_at"],
                    },
                }
            )

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500
