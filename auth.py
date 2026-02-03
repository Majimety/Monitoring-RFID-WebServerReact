from flask import Blueprint, request, jsonify
import sqlite3
import os
import hashlib
from datetime import datetime, timedelta
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
                role TEXT DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                is_active BOOLEAN DEFAULT 1
            )
            """
        )
        conn.commit()


# =====================
# Password
# =====================
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password, password_hash):
    return hash_password(password) == password_hash


# =====================
# Routes
# =====================


@auth_bp.route("/api/register", methods=["POST"])
def register():
    from flask import current_app

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

            password_hash = hash_password(password)

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
            SELECT id, email, first_name, last_name, password_hash, role
            FROM admin_users WHERE email = ?
            """,
            (email,),
        )

        user = cursor.fetchone()

        if not user or not verify_password(password, user["password_hash"]):
            return jsonify({"error": "Invalid credentials"}), 401

        expiration = datetime.utcnow() + timedelta(hours=24)

        payload = {
            "user_id": user["id"],
            "email": user["email"],
            "role": user["role"],
            "exp": expiration,
        }

        token = jwt.encode(
            payload,
            current_app.config["SECRET_KEY"],
            algorithm="HS256",
        )

        # ส่ง user info กลับไปด้วย
        user_info = {
            "id": user["id"],
            "email": user["email"],
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "role": user["role"],
        }

        return jsonify({"token": token, "user": user_info})
