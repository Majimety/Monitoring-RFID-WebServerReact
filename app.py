from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    jsonify,
    send_from_directory,
)
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_restx import Api, Resource

import sqlite3
import os
import csv
from uuid import uuid4

from auth import auth_bp, init_auth_db

# =====================
# App Configuration
# =====================

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

app.config["SECRET_KEY"] = "your-secret-key-change-this-in-production"

# Register auth routes
app.register_blueprint(auth_bp)


BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.abspath(os.path.join(BASE_DIR, "database.db"))
PHOTO_DIR = "photos"

latest_uuid = None


# =====================
# Database Helpers
# =====================
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users_reg (
                id INTEGER PRIMARY KEY,
                uuid TEXT NOT NULL,
                user_id TEXT NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'student',
                profile_image_path TEXT DEFAULT NULL,
                is_deleted BOOLEAN NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()


# =====================
# Query Functions
# =====================
def get_users():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT
                    id,
                    uuid,
                    user_id,
                    first_name,
                    last_name,
                    email,
                    role
                FROM users_reg
                WHERE is_deleted = 0
                ORDER BY created_at DESC
                """
            )

            rows = cursor.fetchall()

            return [
                {
                    "id": row["id"],
                    "uuid": row["uuid"],
                    "user_id": row["user_id"],
                    "first_name": row["first_name"],
                    "last_name": row["last_name"],
                    "email": row["email"],
                    "role": row["role"],
                }
                for row in rows
            ]

    except sqlite3.Error as e:
        print(f"Database error in get_users: {e}")
        return []


def get_user_by_uuid(uuid):
    if not uuid:
        return None

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT uuid, user_id, first_name, last_name, email, role
                FROM users_reg
                WHERE uuid = ? AND is_deleted = 0
                """,
                (uuid,),
            )
            row = cursor.fetchone()

            if not row:
                return None

            return dict(row)

    except sqlite3.Error as e:
        print(f"Database error in get_user_by_uuid: {e}")
        return None


def add_user(uuid, user_id, first_name, last_name, email, role="student"):
    if not all([uuid, user_id, first_name, last_name, email]):
        return {"success": False, "message": "กรุณากรอกข้อมูลให้ครบถ้วน"}

    if "@" not in email or "." not in email:
        return {"success": False, "message": "รูปแบบ email ไม่ถูกต้อง"}

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT COUNT(*) FROM users_reg
                WHERE (uuid = ? OR user_id = ? OR email = ?) AND is_deleted = 0
                """,
                (uuid, user_id, email),
            )

            if cursor.fetchone()[0] > 0:
                return {
                    "success": False,
                    "message": "UUID, User ID หรือ Email นี้มีอยู่ในระบบแล้ว",
                }

            cursor.execute(
                """
                INSERT INTO users_reg
                (uuid, user_id, first_name, last_name, name, email, role, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    uuid,
                    user_id,
                    first_name,
                    last_name,
                    f"{first_name} {last_name}",
                    email,
                    role,
                ),
            )

            conn.commit()
            user_id_created = cursor.lastrowid

        csv_path = os.path.abspath(
            os.path.join(BASE_DIR, "..", "database", "users.csv")
        )
        file_exists = os.path.isfile(csv_path)

        with open(csv_path, "a", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            if not file_exists:
                writer.writerow(
                    [
                        "uuid",
                        "user_id",
                        "first_name",
                        "last_name",
                        "name",
                        "email",
                        "role",
                    ]
                )
            writer.writerow(
                [
                    uuid,
                    user_id,
                    first_name,
                    last_name,
                    f"{first_name} {last_name}",
                    email,
                    role,
                ]
            )

        return {
            "success": True,
            "message": "เพิ่มผู้ใช้สำเร็จ",
            "user_id": user_id_created,
        }

    except sqlite3.Error as e:
        return {"success": False, "message": f"เกิดข้อผิดพลาดในฐานข้อมูล: {str(e)}"}


def delete_user(id):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE users_reg
                SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (id,),
            )
            conn.commit()

            if cursor.rowcount > 0:
                return {"success": True, "message": "ลบผู้ใช้สำเร็จ"}

            return {"success": False, "message": "ไม่สามารถลบผู้ใช้ได้"}

    except sqlite3.Error as e:
        return {"success": False, "message": f"เกิดข้อผิดพลาด: {str(e)}"}


def check_is_user_id_exist(user_id):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT 1 FROM users_reg WHERE user_id = ? LIMIT 1", (user_id,)
            )
            return (
                {"success": True, "message": "userId นี้มีอยู่แล้ว"}
                if cursor.fetchone()
                else {"success": False, "message": ""}
            )
    except sqlite3.Error as e:
        return {"success": False, "message": f"เกิดข้อผิดพลาด: {str(e)}"}


def check_is_user_id_exist_except_id(user_id, current_id):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT 1 FROM users_reg
                WHERE user_id = ? AND id != ? LIMIT 1
                """,
                (user_id, current_id),
            )
            return (
                {"success": True, "message": "userId นี้มีอยู่แล้ว"}
                if cursor.fetchone()
                else {"success": False, "message": ""}
            )
    except sqlite3.Error as e:
        return {"success": False, "message": f"เกิดข้อผิดพลาด: {str(e)}"}


# =====================
# Routes
# =====================

# global state
door_command = "idle"  # idle | open | close


@app.route("/admin")
def index():
    return render_template("index.html")


@app.route("/admin/dashboard-content")
def dashboard_content():
    return render_template("dashboard_content.html")


@app.route("/admin/booking-requests")
def admin_booking_requests():
    return render_template("admin_booking_requests.html")


@app.route("/admin/access-logs")
def access_logs_route():
    return render_template("access_logs.html")


@app.route("/admin/system-settings")
def system_settings_route():
    return render_template("system_settings.html")


@app.route("/api/door/open", methods=["POST"])
def door_open():
    global door_command
    door_command = "open"
    return jsonify({"success": True, "message": "Door open command sent"})


@app.route("/api/door/close", methods=["POST"])
def door_close():
    global door_command
    door_command = "close"
    return jsonify({"success": True, "message": "Door close command sent"})


@app.route("/api/door/command", methods=["GET"])
def get_door_command():
    global door_command
    cmd = door_command
    door_command = "idle"  # reset หลังอ่าน
    return jsonify({"command": cmd})


@app.route("/api/send_uuid", methods=["POST"])
def get_uuid():
    global latest_uuid
    data = request.get_json()
    latest_uuid = data.get("uuid")

    user = get_user_by_uuid(latest_uuid)

    socketio.emit(
        "uuid_update",
        {
            "uuid": latest_uuid,
            "user_id": user["user_id"] if user else "",
            "first_name": user["first_name"] if user else "",
            "last_name": user["last_name"] if user else "",
            "email": user["email"] if user else "",
        },
    )

    return (
        jsonify({"status": "ok", "user": user})
        if user
        else (jsonify({"status": "denied"}), 403)
    )


@app.route("/api/latest_uuid", methods=["GET"])
def get_latest_uid():
    if not latest_uuid:
        return (
            jsonify({"success": False, "message": "ไม่มี UUID ล่าสุด กรุณาสแกน RFID ก่อน"}),
            404,
        )

    user = get_user_by_uuid(latest_uuid)

    if user:
        return jsonify({"success": True, "has_user_data": True, **user})

    return jsonify(
        {
            "success": True,
            "has_user_data": False,
            "uuid": latest_uuid,
            "message": "UUID ยังไม่ได้ลงทะเบียน",
        }
    )


@app.route("/api/reset_uuid", methods=["POST"])
def reset_uuid():
    global latest_uuid
    latest_uuid = None
    return jsonify({"success": True})


@app.route("/api/upload", methods=["POST"])
def upload():
    os.makedirs(PHOTO_DIR, exist_ok=True)

    image_name = f"{uuid4()}.jpg"
    file_path = os.path.join(PHOTO_DIR, image_name)

    with open(file_path, "wb") as f:
        f.write(request.data)

    return jsonify({"success": True, "path_file": f"{PHOTO_DIR}/{image_name}"})


@app.route("/photos/<file_name>")
def serve_photo(file_name):
    return send_from_directory(PHOTO_DIR, file_name)


@app.route("/api/add_user", methods=["POST"])
def add_user_route():
    global latest_uuid

    # รองรับทั้ง form data และ JSON
    if request.is_json:
        data = request.get_json()
        uuid = data.get("uuid", "").strip()
        user_id = data.get("user_id", "").strip()
        first_name = data.get("first_name", "").strip()
        last_name = data.get("last_name", "").strip()
        email = data.get("email", "").strip()
        role = data.get("role", "student").strip()
    else:
        uuid = request.form.get("uuid", "").strip()
        user_id = request.form.get("user_id", "").strip()
        first_name = request.form.get("first_name", "").strip()
        last_name = request.form.get("last_name", "").strip()
        email = request.form.get("email", "").strip()
        role = request.form.get("role", "student").strip()

    if not all([uuid, user_id, first_name, last_name, email]):
        return jsonify({"success": False, "message": "กรุณากรอกข้อมูลให้ครบถ้วน"}), 400

    if check_is_user_id_exist(user_id)["success"]:
        return jsonify({"success": False, "message": "userId นี้มีอยู่แล้ว"}), 409

    result = add_user(uuid, user_id, first_name, last_name, email, role)

    if result["success"]:
        latest_uuid = None
        return jsonify(result), 201

    return jsonify(result), 409


@app.route("/api/users", methods=["GET"])
def get_users_api():
    """Get all users - ใช้โดย React"""
    users = get_users()
    return jsonify({"success": True, "users": users})


@app.route("/api/delete_user/<int:id>", methods=["POST", "DELETE"])
def delete_user_route(id):
    result = delete_user(id)
    return jsonify(result)


@app.route("/api/user/<int:id>", methods=["GET"])
def get_single_user(id):
    """ดึงข้อมูล user เดียวสำหรับ edit (ใช้โดย React)"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, uuid, user_id, first_name, last_name, name, email, role
                FROM users_reg
                WHERE id = ? AND is_deleted = 0
                """,
                (id,),
            )
            row = cursor.fetchone()

            if row:
                return jsonify(dict(row))
            return jsonify({"error": "User not found"}), 404

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/edit_user/<int:id>")
def edit_user_route(id):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, uuid, user_id, first_name, last_name, email
            FROM users_reg
            WHERE id = ?
            """,
            (id,),
        )
        row = cursor.fetchone()

    if not row:
        return redirect(url_for("index"))

    user = {
        "id": row["id"],
        "uuid": row["uuid"],
        "user_id": row["user_id"],
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "email": row["email"],
    }

    return render_template("edit_user.html", user=user)


@app.route("/api/update_user/<int:id>", methods=["POST", "PUT"])
def update_user_route(id):
    # รองรับทั้ง form data และ JSON
    if request.is_json:
        data = request.get_json()
        uuid = data.get("uuid")
        user_id = data.get("userId") or data.get("user_id")
        first_name = data.get("firstName") or data.get("first_name")
        last_name = data.get("lastName") or data.get("last_name")
        email = data.get("email")
        role = data.get("role", "student")
    else:
        uuid = request.form.get("uuid")
        user_id = request.form.get("userId") or request.form.get("user_id")
        first_name = request.form.get("firstName") or request.form.get("first_name")
        last_name = request.form.get("lastName") or request.form.get("last_name")
        email = request.form.get("email")
        role = request.form.get("role", "student")

    if check_is_user_id_exist_except_id(user_id, id)["success"]:
        return jsonify({"success": False, "message": "userId นี้มีอยู่แล้ว"}), 409

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE users_reg
                SET user_id = ?, first_name = ?, last_name = ?, 
                    name = ?, email = ?, role = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (
                    user_id,
                    first_name,
                    last_name,
                    f"{first_name} {last_name}",
                    email,
                    role,
                    id,
                ),
            )
            conn.commit()

        return jsonify({"success": True, "message": "แก้ไขข้อมูล user สำเร็จ"})

    except sqlite3.Error as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/table")
def table_route():
    return render_template("table.html", users=get_users())


if __name__ == "__main__":
    init_db()
    init_auth_db()

    socketio.run(
        app,
        debug=True,
        use_reloader=False,
        host="0.0.0.0",
        port=5000,
    )
