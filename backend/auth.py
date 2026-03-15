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
                user_id TEXT DEFAULT '',
                role TEXT DEFAULT 'student',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                is_active BOOLEAN DEFAULT 1
            )
            """
        )
        # Migration: เพิ่มคอลัมน์ถ้ายังไม่มี (backward compat)
        for col_def in [
            "ALTER TABLE admin_users ADD COLUMN phone TEXT DEFAULT ''",
            "ALTER TABLE admin_users ADD COLUMN user_id TEXT DEFAULT ''",
        ]:
            try:
                cursor.execute(col_def)
            except Exception:
                pass  # คอลัมน์มีอยู่แล้ว ข้ามได้

        # ตาราง rfid_register_requests: คำขอลงทะเบียน RFID จากผู้ใช้
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS rfid_register_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                email TEXT NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

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
    user_id = data.get("user_id", "").strip()

    if not all([email, first_name, last_name, password]):
        return jsonify({"error": "All fields are required"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    # ถ้าเป็น kkumail.com ต้องกรอก user_id
    if email.endswith("@kkumail.com") and not user_id:
        return jsonify({"error": "Student ID is required"}), 400

    # กำหนด role ตาม email domain
    if email.endswith("@kku.ac.th"):
        role = "admin"
    else:
        role = "student"

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # ตรวจสอบ email ที่ active อยู่แล้ว
            cursor.execute(
                "SELECT id, is_active FROM admin_users WHERE email = ?", (email,)
            )
            existing = cursor.fetchone()

            if existing:
                if existing["is_active"] == 1:
                    # มี account active อยู่แล้ว — ปฏิเสธ
                    return jsonify({"error": "Email already registered"}), 409
                else:
                    # account ถูก deactivate ไว้ → reactivate และอัปเดตข้อมูลใหม่
                    password_hash = hash_password(password)
                    cursor.execute(
                        """
                        UPDATE admin_users
                        SET first_name = ?, last_name = ?, password_hash = ?,
                            user_id = ?, role = ?, is_active = 1
                        WHERE id = ?
                        """,
                        (
                            first_name,
                            last_name,
                            password_hash,
                            user_id,
                            role,
                            existing["id"],
                        ),
                    )
                    conn.commit()

                    # kku.ac.th reactivate → ส่ง RFID request อัตโนมัติ (ถ้ายังไม่มี pending และยังไม่ลง RFID)
                    if role == "admin":
                        try:
                            cursor.execute(
                                "SELECT id FROM rfid_register_requests WHERE email = ? AND status = 'pending'",
                                (email,),
                            )
                            if not cursor.fetchone():
                                cursor.execute(
                                    "SELECT id FROM users_reg WHERE email = ? AND is_deleted = 0",
                                    (email,),
                                )
                                if not cursor.fetchone():
                                    cursor.execute(
                                        """
                                        INSERT INTO rfid_register_requests (user_id, email, first_name, last_name)
                                        VALUES (?, ?, ?, ?)
                                        """,
                                        (user_id, email, first_name, last_name),
                                    )
                                    conn.commit()
                        except Exception:
                            pass

                    return jsonify({"success": True}), 201

            password_hash = hash_password(password)  # bcrypt แล้ว

            cursor.execute(
                """
                INSERT INTO admin_users (email, first_name, last_name, password_hash, user_id, role)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (email, first_name, last_name, password_hash, user_id, role),
            )
            new_user_id = cursor.lastrowid
            conn.commit()

            # kku.ac.th → ส่ง RFID register request อัตโนมัติทันที
            if role == "admin":
                try:
                    cursor.execute(
                        """
                        INSERT INTO rfid_register_requests (user_id, email, first_name, last_name)
                        VALUES (?, ?, ?, ?)
                        """,
                        (user_id, email, first_name, last_name),
                    )
                    conn.commit()
                except Exception:
                    pass  # ถ้า insert ไม่ได้ก็ไม่ block การสมัคร

        return jsonify({"success": True}), 201

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


# =====================
# RFID Register Request APIs
# =====================
@auth_bp.route("/api/rfid-register-request", methods=["POST"])
@token_required
def submit_rfid_register_request(current_user):
    """ผู้ใช้ส่งคำขอลงทะเบียน RFID"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # ดึงข้อมูลผู้ใช้
            cursor.execute(
                "SELECT id, email, first_name, last_name, user_id FROM admin_users WHERE id = ? AND is_active = 1",
                (current_user["user_id"],),
            )
            user = cursor.fetchone()
            if not user:
                return jsonify({"error": "ไม่พบผู้ใช้"}), 404

            # ตรวจสอบว่ามีคำขอ pending อยู่แล้วหรือไม่
            cursor.execute(
                "SELECT id FROM rfid_register_requests WHERE email = ? AND status = 'pending'",
                (user["email"],),
            )
            if cursor.fetchone():
                return jsonify({"error": "มีคำขอที่รอดำเนินการอยู่แล้ว"}), 409

            # ตรวจสอบว่าลงทะเบียน RFID แล้วหรือยัง
            cursor.execute(
                "SELECT id FROM users_reg WHERE email = ? AND is_deleted = 0",
                (user["email"],),
            )
            if cursor.fetchone():
                return jsonify({"error": "ลงทะเบียน RFID แล้ว"}), 409

            cursor.execute(
                """
                INSERT INTO rfid_register_requests (user_id, email, first_name, last_name)
                VALUES (?, ?, ?, ?)
                """,
                (user["user_id"], user["email"], user["first_name"], user["last_name"]),
            )
            conn.commit()

        return jsonify({"success": True, "message": "ส่งคำขอสำเร็จ"}), 201

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api/rfid-register-requests", methods=["GET"])
@token_required
def get_rfid_register_requests(current_user):
    """Admin ดึงรายการคำขอลงทะเบียน RFID"""
    if not current_user["email"].endswith("@kku.ac.th"):
        return jsonify({"error": "ไม่มีสิทธิ์"}), 403

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, user_id, email, first_name, last_name, status, created_at
                FROM rfid_register_requests
                ORDER BY created_at DESC
                """
            )
            rows = [dict(r) for r in cursor.fetchall()]
        return jsonify({"success": True, "requests": rows})
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api/rfid-register-requests/<int:req_id>/cancel", methods=["POST"])
@token_required
def cancel_rfid_register_request(current_user, req_id):
    """Admin ยกเลิกคำขอ (หลังจาก register สำเร็จหรือต้องการลบ)"""
    if not current_user["email"].endswith("@kku.ac.th"):
        return jsonify({"error": "ไม่มีสิทธิ์"}), 403
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE rfid_register_requests SET status='cancelled', updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (req_id,),
            )
            conn.commit()
        return jsonify({"success": True})
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api/rfid-register-requests/<int:req_id>/delete", methods=["DELETE"])
@token_required
def delete_rfid_register_request(current_user, req_id):
    """Admin ลบรายการ done/cancelled ออกจากประวัติ"""
    if not current_user["email"].endswith("@kku.ac.th"):
        return jsonify({"error": "ไม่มีสิทธิ์"}), 403
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # ลบได้เฉพาะรายการที่ไม่ใช่ pending
            cursor.execute(
                "DELETE FROM rfid_register_requests WHERE id=? AND status != 'pending'",
                (req_id,),
            )
            if cursor.rowcount == 0:
                return jsonify({"error": "ไม่พบรายการหรือไม่สามารถลบได้"}), 404
            conn.commit()
        return jsonify({"success": True})
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api/rfid-register-status", methods=["GET"])
@token_required
def get_rfid_register_status(current_user):
    """ผู้ใช้ตรวจสอบสถานะ RFID ของตัวเอง"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # ตรวจสอบใน users_reg
            cursor.execute(
                "SELECT id FROM users_reg WHERE email = ? AND is_deleted = 0",
                (current_user["email"],),
            )
            is_registered = cursor.fetchone() is not None

            # ตรวจสอบคำขอที่ pending
            cursor.execute(
                "SELECT id, status FROM rfid_register_requests WHERE email = ? ORDER BY created_at DESC LIMIT 1",
                (current_user["email"],),
            )
            req = cursor.fetchone()
            has_pending_request = req and req["status"] == "pending"

        return jsonify(
            {
                "success": True,
                "is_rfid_registered": is_registered,
                "has_pending_request": has_pending_request,
            }
        )
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
            SELECT id, email, first_name, last_name, password_hash, role, phone, user_id
            FROM admin_users WHERE email = ? AND is_active = 1
            """,
            (email,),
        )
        user = cursor.fetchone()

        if not user:
            return jsonify({"error": "ไม่พบบัญชีที่ใช้อีเมลนี้", "field": "email"}), 401

        if not verify_password(password, user["password_hash"]):
            return jsonify({"error": "รหัสผ่านไม่ถูกต้อง", "field": "password"}), 401

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
        "user_id": user["user_id"] or "",
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
    user_id = data.get("user_id", "").strip()

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
                        password_hash = ?, user_id = ?
                    WHERE id = ?
                    """,
                    (
                        first_name,
                        last_name,
                        phone,
                        new_hash,
                        user_id,
                        current_user["user_id"],
                    ),
                )
            else:
                cursor.execute(
                    """
                    UPDATE admin_users
                    SET first_name = ?, last_name = ?, phone = ?, user_id = ?
                    WHERE id = ?
                    """,
                    (first_name, last_name, phone, user_id, current_user["user_id"]),
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
                    "user_id": user_id,
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


@auth_bp.route("/api/admin/delete-user/<int:target_id>", methods=["DELETE"])
@token_required
def delete_admin_user(current_user, target_id):
    """Admin ลบผู้ใช้ออกจาก admin_users (soft delete: is_active=0)"""
    if not current_user["email"].endswith("@kku.ac.th"):
        return jsonify({"error": "ไม่มีสิทธิ์"}), 403
    # ไม่อนุญาตให้ลบตัวเอง (current_user["user_id"] คือ DB id)
    if current_user["user_id"] == target_id:
        return jsonify({"error": "ไม่สามารถลบตัวเองได้"}), 400
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE admin_users SET is_active = 0 WHERE id = ? AND is_active = 1",
                (target_id,),
            )
            if cursor.rowcount == 0:
                return jsonify({"error": "ไม่พบผู้ใช้หรือถูกลบแล้ว"}), 404
            conn.commit()
        return jsonify({"success": True})
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500
