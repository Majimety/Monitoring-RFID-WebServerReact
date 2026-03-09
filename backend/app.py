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
import threading  # Bug #5 Fix: ใช้ Lock แทน global variable เปล่า

import sqlite3
import os
import csv
from uuid import uuid4
from datetime import datetime
from dotenv import load_dotenv

from auth import auth_bp, init_auth_db
from booking import booking_bp, init_booking_db
from notifications import (
    notif_bp,
    init_notification_db,
    notify_rfid_denied,
    check_and_send_reminders,
)

load_dotenv()

# =====================
# App Configuration
# =====================
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

app.config["SECRET_KEY"] = os.getenv(
    "SECRET_KEY", "your-secret-key-change-this-in-production"
)

app.register_blueprint(auth_bp)
app.register_blueprint(booking_bp)
app.register_blueprint(notif_bp)

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.abspath(
    os.path.join(BASE_DIR, os.getenv("DATABASE_PATH", "database.db"))
)
PHOTO_DIR = os.getenv("UPLOAD_FOLDER", "photos")


# =====================
# Bug #5 Fix: UUID state ป้องกัน race condition ด้วย Lock
# =====================
_uuid_lock = threading.Lock()
_latest_uuid = None  # ใช้ผ่าน getter/setter ด้านล่างเท่านั้น


def get_latest_uuid():
    with _uuid_lock:
        return _latest_uuid


def set_latest_uuid(value):
    global _latest_uuid
    with _uuid_lock:
        _latest_uuid = value


# =====================
# Database Helpers
# =====================
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    # --- users_reg + rooms ---
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
        # Rooms table
        cursor.execute("PRAGMA table_info(rooms)")
        existing_cols = {row["name"] for row in cursor.fetchall()}

        if not existing_cols:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS rooms (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        elif "name" not in existing_cols:
            cursor.execute("DROP TABLE rooms")
            cursor.execute(
                """
                CREATE TABLE rooms (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        else:
            cursor.execute("DELETE FROM rooms WHERE name IS NULL OR name = ''")

        cursor.execute("SELECT COUNT(*) FROM rooms")
        if cursor.fetchone()[0] == 0:
            for room_name in ["4101", "4102"]:
                cursor.execute(
                    "INSERT OR IGNORE INTO rooms (name) VALUES (?)", (room_name,)
                )
        conn.commit()

    # --- access_logs ---
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # ตรวจสอบว่าตาราง access_logs มี column ครบหรือไม่
        # ถ้าสร้างไม่สมบูรณ์จากครั้งก่อน ให้ drop แล้วสร้างใหม่
        cursor.execute("PRAGMA table_info(access_logs)")
        log_cols = {row["name"] for row in cursor.fetchall()}

        if log_cols and "uuid" not in log_cols:
            # ตารางเก่าสร้างไม่สมบูรณ์ — drop แล้วสร้างใหม่
            cursor.execute("DROP TABLE access_logs")
            conn.commit()

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS access_logs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid        TEXT NOT NULL,
                user_id     TEXT,
                name        TEXT,
                email       TEXT,
                role        TEXT,
                room        TEXT,
                result      TEXT NOT NULL DEFAULT 'denied',
                method      TEXT NOT NULL DEFAULT 'rfid',
                scanned_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()

        # สร้าง index หลัง commit ให้แน่ใจว่า column พร้อมแล้ว
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_uuid ON access_logs(uuid)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_room ON access_logs(room)")
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_logs_scanned_at ON access_logs(scanned_at)"
        )
        conn.commit()


# =====================
# CSV Helpers
# =====================
CSV_DIR = os.path.abspath(os.path.join(BASE_DIR, "database"))
USERS_CSV = os.path.join(CSV_DIR, "users.csv")
ADMINS_CSV = os.path.join(CSV_DIR, "admins.csv")
CSV_HEADER = ["uuid", "user_id", "first_name", "last_name", "name", "email", "role"]


def _ensure_csv_dir():
    os.makedirs(CSV_DIR, exist_ok=True)


def rebuild_csv_from_db():
    _ensure_csv_dir()
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT uuid, user_id, first_name, last_name,
                       first_name || ' ' || last_name AS name, email, role
                FROM users_reg
                WHERE is_deleted = 0
                ORDER BY id
                """
            )
            all_users = cursor.fetchall()

        with open(USERS_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(CSV_HEADER)
            for u in all_users:
                writer.writerow([u[0], u[1], u[2], u[3], u[4], u[5], u[6]])

        admin_users = [u for u in all_users if u[6] == "admin"]
        with open(ADMINS_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(CSV_HEADER)
            for u in admin_users:
                writer.writerow([u[0], u[1], u[2], u[3], u[4], u[5], u[6]])

    except Exception as e:
        print(f"[CSV] rebuild_csv_from_db error: {e}")


def append_user_to_csv(uuid, user_id, first_name, last_name, email, role):
    _ensure_csv_dir()
    row = [
        uuid,
        user_id,
        first_name,
        last_name,
        f"{first_name} {last_name}",
        email,
        role,
    ]
    try:
        file_exists = os.path.isfile(USERS_CSV)
        with open(USERS_CSV, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(CSV_HEADER)
            writer.writerow(row)

        if role == "admin":
            file_exists = os.path.isfile(ADMINS_CSV)
            with open(ADMINS_CSV, "a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                if not file_exists:
                    writer.writerow(CSV_HEADER)
                writer.writerow(row)
    except Exception as e:
        print(f"[CSV] append_user_to_csv error: {e}")


# =====================
# Access Log Helper
# =====================
def write_access_log(
    uuid: str, user: dict | None, room: str, result: str, method: str = "rfid"
):
    """
    บันทึก access log ทุกครั้งที่มีการสแกน RFID
    result: 'granted' | 'denied'
    method: 'rfid' | 'web'
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO access_logs (uuid, user_id, name, email, role, room, result, method)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    uuid,
                    user["user_id"] if user else None,
                    f"{user['first_name']} {user['last_name']}" if user else None,
                    user["email"] if user else None,
                    user["role"] if user else None,
                    room or None,
                    result,
                    method,
                ),
            )
            conn.commit()
    except Exception as e:
        print(f"[LOG] write_access_log error: {e}")


# =====================
# Query Functions
# =====================
def get_users():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, uuid, user_id, first_name, last_name, email, role
                FROM users_reg
                WHERE is_deleted = 0
                ORDER BY created_at DESC
                """
            )
            return [dict(row) for row in cursor.fetchall()]
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
            return dict(row) if row else None
    except sqlite3.Error as e:
        print(f"Database error in get_user_by_uuid: {e}")
        return None


def get_user_by_email(email):
    if not email:
        return None
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT NULL AS user_id, first_name, last_name, email, role FROM admin_users WHERE email = ? AND is_active = 1",
                (email,),
            )
            row = cursor.fetchone()
            if row:
                d = dict(row)
                d["uuid"] = "WEB"
                return d
            return None
    except sqlite3.Error as e:
        print(f"Database error in get_user_by_email: {e}")
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

        try:
            append_user_to_csv(uuid, user_id, first_name, last_name, email, role)
        except Exception:
            pass

        return {"success": True, "message": "เพิ่มผู้ใช้สำเร็จ", "user_id": user_id_created}

    except sqlite3.Error as e:
        return {"success": False, "message": f"เกิดข้อผิดพลาดในฐานข้อมูล: {str(e)}"}


def delete_user(id):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users_reg SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (id,),
            )
            conn.commit()
            affected = cursor.rowcount

        if affected > 0:
            rebuild_csv_from_db()
            return {"success": True, "message": "ลบผู้ใช้สำเร็จ"}
        return {"success": False, "message": "ไม่สามารถลบผู้ใช้ได้"}
    except sqlite3.Error as e:
        return {"success": False, "message": f"เกิดข้อผิดพลาด: {str(e)}"}


def check_is_user_id_exist(user_id):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT 1 FROM users_reg WHERE user_id = ? AND is_deleted = 0 LIMIT 1",
                (user_id,),
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
                WHERE user_id = ? AND id != ? AND is_deleted = 0 LIMIT 1
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
# Door Command State (per-room)
# =====================
room_commands = {}  # { room_name: "open" | "close" | "idle" }
room_last_seen = {}  # { room_name: datetime }


# =====================
# Routes
# =====================
@app.route("/admin")
def index():
    return render_template("index.html")


@app.route("/api/door/open", methods=["POST"])
def door_open():
    data = request.get_json(silent=True) or {}
    room = data.get("room", "")
    room_commands[room] = "open"
    try:
        import jwt as pyjwt

        auth_header = request.headers.get("Authorization", "")
        token = auth_header.split(" ")[1] if auth_header.startswith("Bearer ") else None
        admin_user = None
        if token:
            jwt_data = pyjwt.decode(
                token, app.config["SECRET_KEY"], algorithms=["HS256"]
            )
            admin_user = get_user_by_email(jwt_data.get("email", ""))
        write_access_log(
            uuid="WEB", user=admin_user, room=room, result="granted", method="web"
        )
    except Exception as e:
        print(f"[LOG] door_open log error: {e}")
    return jsonify({"success": True, "message": "Door open command sent"})


@app.route("/api/door/close", methods=["POST"])
def door_close():
    data = request.get_json(silent=True) or {}
    room = data.get("room", "")
    room_commands[room] = "close"
    try:
        import jwt as pyjwt

        auth_header = request.headers.get("Authorization", "")
        token = auth_header.split(" ")[1] if auth_header.startswith("Bearer ") else None
        admin_user = None
        if token:
            jwt_data = pyjwt.decode(
                token, app.config["SECRET_KEY"], algorithms=["HS256"]
            )
            admin_user = get_user_by_email(jwt_data.get("email", ""))
        write_access_log(
            uuid="WEB", user=admin_user, room=room, result="granted", method="web"
        )
    except Exception as e:
        print(f"[LOG] door_close log error: {e}")
    return jsonify({"success": True, "message": "Door close command sent"})


@app.route("/api/door/command", methods=["GET"])
def get_door_command():
    room = request.args.get("room", "")
    if room:
        room_last_seen[room] = datetime.utcnow()
    cmd = room_commands.pop(room, "idle")
    return jsonify({"command": cmd})


@app.route("/api/send_uuid", methods=["POST"])
def get_uuid():
    data = request.get_json()
    uuid = data.get("uuid")
    # รับ room จาก ESP32 (ถ้าส่งมา) — backward compatible ถ้าไม่ส่งก็ยังใช้ได้
    room = data.get("room", "")
    # source: "register" = มาจาก ESP32_Register (ไม่ต้อง notify), "door" = มาจาก ESP32_Door
    source = data.get("source", "door")

    # Bug #5 Fix: ใช้ thread-safe setter
    set_latest_uuid(uuid)

    user = get_user_by_uuid(uuid)
    result = "granted" if user else "denied"

    # บันทึก Access Log ทุกครั้งที่สแกน
    write_access_log(uuid=uuid, user=user, room=room, result=result, method="rfid")

    # Trigger notification เมื่อ RFID denied — เฉพาะ door เท่านั้น ไม่แจ้งตอน register
    if not user and source != "register":
        print(
            f"[DEBUG] calling notify_rfid_denied: uuid={uuid} room={room} source={source}"
        )
        notify_rfid_denied(uuid=uuid, room=room)
        print(f"[DEBUG] notify_rfid_denied done")

    socketio.emit(
        "uuid_update",
        {
            "uuid": uuid,
            "user_id": user["user_id"] if user else "",
            "first_name": user["first_name"] if user else "",
            "last_name": user["last_name"] if user else "",
            "email": user["email"] if user else "",
            "role": user["role"] if user else "",
            "room": room,
            "result": result,
            "source": source,
        },
    )

    return (
        jsonify({"status": "ok", "user": user})
        if user
        else (jsonify({"status": "denied"}), 403)
    )


@app.route("/api/latest_uuid", methods=["GET"])
def get_latest_uid():
    uuid = get_latest_uuid()  # Bug #5 Fix: thread-safe getter
    if not uuid:
        return (
            jsonify({"success": False, "message": "ไม่มี UUID ล่าสุด กรุณาสแกน RFID ก่อน"}),
            404,
        )

    user = get_user_by_uuid(uuid)
    if user:
        return jsonify({"success": True, "has_user_data": True, **user})

    return jsonify(
        {
            "success": True,
            "has_user_data": False,
            "uuid": uuid,
            "message": "UUID ยังไม่ได้ลงทะเบียน",
        }
    )


@app.route("/api/reset_uuid", methods=["POST"])
def reset_uuid():
    set_latest_uuid(None)  # Bug #5 Fix: thread-safe setter
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
        return jsonify({"success": False, "message": "กรุณากรอกข้อมูลให้ครบถ้วน"})

    if check_is_user_id_exist(user_id)["success"]:
        return jsonify({"success": False, "message": "userId นี้มีอยู่แล้ว"})

    result = add_user(uuid, user_id, first_name, last_name, email, role)
    if result["success"]:
        set_latest_uuid(None)  # Bug #5 Fix: thread-safe
    return jsonify(result)


@app.route("/api/users", methods=["GET"])
def get_users_api():
    users = get_users()
    return jsonify({"success": True, "users": users})


@app.route("/api/delete_user/<int:id>", methods=["POST", "DELETE"])
def delete_user_route(id):
    result = delete_user(id)
    return jsonify(result)


@app.route("/api/user/<int:id>", methods=["GET"])
def get_single_user(id):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, uuid, user_id, first_name, last_name, name, email, role
                FROM users_reg WHERE id = ? AND is_deleted = 0
                """,
                (id,),
            )
            row = cursor.fetchone()
            if row:
                return jsonify(dict(row))
            return jsonify({"error": "User not found"}), 404
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/update_user/<int:id>", methods=["POST", "PUT"])
def update_user_route(id):
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
        return jsonify({"success": False, "message": "userId นี้มีอยู่แล้ว"})

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

        rebuild_csv_from_db()
        return jsonify({"success": True, "message": "แก้ไขข้อมูล user สำเร็จ"})

    except sqlite3.Error as e:
        return jsonify({"success": False, "message": str(e)}), 500


# =====================
# Rooms API
# =====================
@app.route("/api/rooms", methods=["GET"])
def get_rooms():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, name FROM rooms ORDER BY id ASC")
            rows = cursor.fetchall()
            return jsonify(
                {"rooms": [{"id": r["id"], "name": r["name"]} for r in rows]}
            )
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rooms", methods=["POST"])
def add_room():
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Room name is required"}), 400
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO rooms (name) VALUES (?)", (name,))
            conn.commit()
            return (
                jsonify(
                    {"success": True, "room": {"id": cursor.lastrowid, "name": name}}
                ),
                201,
            )
    except sqlite3.IntegrityError:
        return jsonify({"error": f"Room '{name}' already exists"}), 409
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rooms/<int:room_id>", methods=["PUT"])
def update_room(room_id):
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Room name is required"}), 400
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE rooms SET name = ? WHERE id = ?", (name, room_id))
            if cursor.rowcount == 0:
                return jsonify({"error": "Room not found"}), 404
            conn.commit()
            return jsonify({"success": True, "room": {"id": room_id, "name": name}})
    except sqlite3.IntegrityError:
        return jsonify({"error": f"Room '{name}' already exists"}), 409
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rooms/<int:room_id>", methods=["DELETE"])
def delete_room(room_id):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM rooms WHERE id = ?", (room_id,))
            if cursor.rowcount == 0:
                return jsonify({"error": "Room not found"}), 404
            conn.commit()
            return jsonify({"success": True})
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/door/status", methods=["GET"])
def get_door_status():
    room = request.args.get("room", "")
    last = room_last_seen.get(room)
    is_online = False
    if last:
        seconds_ago = (datetime.utcnow() - last).total_seconds()
        is_online = seconds_ago < 5
    return jsonify(
        {"door_status": "LOCKED", "door_online": is_online, "rfid_online": is_online}
    )


# =====================
# Access Logs API
# =====================
@app.route("/api/access-logs", methods=["GET"])
def get_access_logs():
    """
    ดึง access logs — Admin only (ผ่าน JWT header)
    Query params:
      - room   : กรองตามห้อง
      - result : 'granted' | 'denied' | 'all' (default: all)
      - limit  : จำนวนแถว (default: 200, max: 1000)
      - offset : pagination offset (default: 0)
      - search : ค้นหาจาก uuid / ชื่อ / email
    """
    # ตรวจ JWT token
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]

    if not token:
        return jsonify({"error": "Token is missing"}), 401

    try:
        import jwt as pyjwt

        data = pyjwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        email = data.get("email", "")
        if not email.endswith("@kku.ac.th"):
            return jsonify({"error": "ไม่มีสิทธิ์เข้าถึง"}), 403
    except Exception:
        return jsonify({"error": "Invalid token"}), 401

    # Query params
    room_filter = request.args.get("room", "").strip()
    result_filter = request.args.get("result", "all").strip()
    search = request.args.get("search", "").strip()
    try:
        limit = min(int(request.args.get("limit", 200)), 1000)
        offset = max(int(request.args.get("offset", 0)), 0)
    except ValueError:
        limit, offset = 200, 0

    # Build query dynamically
    conditions = []
    params = []

    if room_filter:
        conditions.append("room = ?")
        params.append(room_filter)

    if result_filter in ("granted", "denied"):
        conditions.append("result = ?")
        params.append(result_filter)

    if search:
        conditions.append(
            "(uuid LIKE ? OR name LIKE ? OR email LIKE ? OR user_id LIKE ?)"
        )
        like = f"%{search}%"
        params.extend([like, like, like, like])

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # total count
            cursor.execute(f"SELECT COUNT(*) FROM access_logs {where}", params)
            total = cursor.fetchone()[0]

            # paginated rows
            cursor.execute(
                f"""
                SELECT id, uuid, user_id, name, email, role,
                       room, result, method, scanned_at
                FROM access_logs
                {where}
                ORDER BY scanned_at DESC
                LIMIT ? OFFSET ?
                """,
                params + [limit, offset],
            )
            logs = [dict(row) for row in cursor.fetchall()]

        return jsonify({"success": True, "total": total, "logs": logs})

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/access-logs/stats", methods=["GET"])
def get_access_log_stats():
    """สถิติรวม access logs สำหรับแสดงบน dashboard"""
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    if not token:
        return jsonify({"error": "Token is missing"}), 401
    try:
        import jwt as pyjwt

        data = pyjwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        if not data.get("email", "").endswith("@kku.ac.th"):
            return jsonify({"error": "ไม่มีสิทธิ์เข้าถึง"}), 403
    except Exception:
        return jsonify({"error": "Invalid token"}), 401

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT COUNT(*) FROM access_logs")
            total = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM access_logs WHERE result = 'granted'")
            granted = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM access_logs WHERE result = 'denied'")
            denied = cursor.fetchone()[0]

            # วันนี้
            cursor.execute(
                "SELECT COUNT(*) FROM access_logs WHERE DATE(scanned_at) = DATE('now', 'localtime')"
            )
            today = cursor.fetchone()[0]

            # สแกนต่อห้อง
            cursor.execute(
                """
                SELECT room, COUNT(*) as count
                FROM access_logs
                WHERE room IS NOT NULL AND room != ''
                GROUP BY room
                ORDER BY count DESC
                """
            )
            by_room = [
                {"room": r["room"], "count": r["count"]} for r in cursor.fetchall()
            ]

        return jsonify(
            {
                "success": True,
                "stats": {
                    "total": total,
                    "granted": granted,
                    "denied": denied,
                    "today": today,
                    "by_room": by_room,
                },
            }
        )

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    init_db()
    init_auth_db()
    init_booking_db()
    init_notification_db()

    # Reminder scheduler — เช็คทุก 5 นาที
    import sched, time as _time

    def _reminder_loop():
        while True:
            try:
                check_and_send_reminders()
            except Exception as e:
                print(f"[SCHEDULER] error: {e}")
            _time.sleep(300)  # 5 นาที

    reminder_thread = threading.Thread(target=_reminder_loop, daemon=True)
    reminder_thread.start()
    print(" Reminder scheduler started (every 5 min)")

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"

    print(f"\n Starting server on {host}:{port}")
    print(f" Environment: {os.getenv('FLASK_ENV', 'development')}")
    print(f" Debug mode: {debug}\n")

    socketio.run(app, debug=debug, use_reloader=False, host=host, port=port)
