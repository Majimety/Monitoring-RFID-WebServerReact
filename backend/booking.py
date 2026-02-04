from flask import Blueprint, request, jsonify
import sqlite3
import os
from datetime import datetime
import jwt
from functools import wraps

# สร้าง Blueprint
booking_bp = Blueprint("booking", __name__)

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.abspath(os.path.join(BASE_DIR, "database.db"))


# =====================
# Database Helper
# =====================
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_booking_db():
    """สร้างตารางสำหรับระบบจองห้อง"""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # ตาราง bookings สำหรับเก็บคำขอจอง
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                user_email TEXT NOT NULL,
                room TEXT NOT NULL,
                date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                detail TEXT,
                status TEXT DEFAULT 'pending',
                approved_by TEXT,
                remark TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES admin_users (id)
            )
            """
        )

        # สร้าง index เพื่อเพิ่มประสิทธิภาพการค้นหา
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_bookings_user 
            ON bookings(user_id)
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_bookings_status 
            ON bookings(status)
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_bookings_date 
            ON bookings(date)
            """
        )

        conn.commit()


# =====================
# Authentication Decorator
# =====================
def token_required(f):
    """Decorator สำหรับตรวจสอบ JWT token"""

    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        # รับ token จาก header
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

            # ถอดรหัส token
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
# Booking Routes
# =====================


@booking_bp.route("/api/bookings/create", methods=["POST"])
@token_required
def create_booking(current_user):
    """สร้างคำขอจองห้อง"""
    data = request.get_json()
    bookings = data.get("bookings", [])

    if not bookings:
        return jsonify({"success": False, "message": "ไม่มีข้อมูลการจอง"}), 400

    # ตรวจสอบว่าเป็น @kkumail.com หรือไม่
    if not current_user["email"].endswith("@kkumail.com"):
        return (
            jsonify(
                {"success": False, "message": "เฉพาะผู้ใช้ @kkumail.com เท่านั้นที่สามารถจองได้"}
            ),
            403,
        )

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # ตรวจสอบ booking limit (3 bookings ที่ active)
            cursor.execute(
                """
                SELECT COUNT(*) FROM bookings 
                WHERE user_id = ? AND status IN ('pending', 'approved')
                """,
                (current_user["user_id"],),
            )

            current_count = cursor.fetchone()[0]
            if current_count + len(bookings) > 3:
                return (
                    jsonify(
                        {
                            "success": False,
                            "message": f"คุณมีการจองอยู่ {current_count} รายการแล้ว ไม่สามารถจองเกิน 3 รายการได้",
                        }
                    ),
                    400,
                )

            # บันทึกการจองทั้งหมด
            for booking in bookings:
                room = booking.get("room")
                date = booking.get("date")
                start_time = booking.get("start_time")
                end_time = booking.get("end_time")
                detail = booking.get("detail", "")

                if not all([room, date, start_time, end_time]):
                    continue

                # ตรวจสอบว่าช่วงเวลานี้มีคนจองแล้วหรือไม่
                cursor.execute(
                    """
                    SELECT COUNT(*) FROM bookings 
                    WHERE room = ? AND date = ? 
                    AND status = 'approved'
                    AND (
                        (start_time <= ? AND end_time > ?) OR
                        (start_time < ? AND end_time >= ?) OR
                        (start_time >= ? AND end_time <= ?)
                    )
                    """,
                    (
                        room,
                        date,
                        start_time,
                        start_time,
                        end_time,
                        end_time,
                        start_time,
                        end_time,
                    ),
                )

                overlap_count = cursor.fetchone()[0]
                if overlap_count > 0:
                    return (
                        jsonify(
                            {
                                "success": False,
                                "message": f"ห้อง {room} ในช่วงเวลา {start_time}-{end_time} วันที่ {date} มีการจองแล้ว",
                            }
                        ),
                        409,
                    )

                # บันทึกการจอง
                cursor.execute(
                    """
                    INSERT INTO bookings 
                    (user_id, user_email, room, date, start_time, end_time, detail, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
                    """,
                    (
                        current_user["user_id"],
                        current_user["email"],
                        room,
                        date,
                        start_time,
                        end_time,
                        detail,
                    ),
                )

            conn.commit()

        return jsonify({"success": True, "message": "ส่งคำขอจองสำเร็จ"}), 201

    except sqlite3.Error as e:
        return jsonify({"success": False, "message": f"เกิดข้อผิดพลาด: {str(e)}"}), 500


@booking_bp.route("/api/bookings/my-requests", methods=["GET"])
@token_required
def get_my_bookings(current_user):
    """ดึงข้อมูลการจองของผู้ใช้"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT 
                    id, room, date, start_time, end_time, detail, 
                    status, approved_by, remark, created_at
                FROM bookings
                WHERE user_id = ?
                ORDER BY created_at DESC
                """,
                (current_user["user_id"],),
            )

            rows = cursor.fetchall()
            bookings = [dict(row) for row in rows]

            return jsonify({"success": True, "bookings": bookings})

    except sqlite3.Error as e:
        return jsonify({"success": False, "message": str(e)}), 500


@booking_bp.route("/api/bookings/all", methods=["GET"])
@token_required
def get_all_bookings(current_user):
    """ดึงข้อมูลการจองทั้งหมด (สำหรับ Admin)"""

    # ตรวจสอบว่าเป็น admin (@kku.ac.th) หรือไม่
    if not current_user["email"].endswith("@kku.ac.th"):
        return jsonify({"success": False, "message": "ไม่มีสิทธิ์เข้าถึง"}), 403

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT 
                    b.id, b.user_email, b.room, b.date, 
                    b.start_time, b.end_time, b.detail, 
                    b.status, b.approved_by, b.remark, b.created_at,
                    u.first_name, u.last_name
                FROM bookings b
                LEFT JOIN admin_users u ON b.user_id = u.id
                ORDER BY b.created_at DESC
                """
            )

            rows = cursor.fetchall()
            bookings = []

            for row in rows:
                booking = dict(row)
                booking["user_name"] = (
                    f"{row['first_name']} {row['last_name']}"
                    if row["first_name"]
                    else row["user_email"]
                )
                bookings.append(booking)

            return jsonify({"success": True, "bookings": bookings})

    except sqlite3.Error as e:
        return jsonify({"success": False, "message": str(e)}), 500


@booking_bp.route("/api/bookings/<int:booking_id>/approve", methods=["POST"])
@token_required
def approve_booking(current_user, booking_id):
    """อนุมัติการจอง (Admin only)"""

    # ตรวจสอบว่าเป็น admin หรือไม่
    if not current_user["email"].endswith("@kku.ac.th"):
        return jsonify({"success": False, "message": "ไม่มีสิทธิ์ในการอนุมัติ"}), 403

    data = request.get_json()
    remark = data.get("remark", "")

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # ตรวจสอบว่ามีการจองนี้หรือไม่
            cursor.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
            booking = cursor.fetchone()

            if not booking:
                return jsonify({"success": False, "message": "ไม่พบข้อมูลการจอง"}), 404

            # ตรวจสอบว่าช่วงเวลานี้มีคนจอง approved แล้วหรือไม่
            cursor.execute(
                """
                SELECT COUNT(*) FROM bookings 
                WHERE room = ? AND date = ? AND id != ?
                AND status = 'approved'
                AND (
                    (start_time <= ? AND end_time > ?) OR
                    (start_time < ? AND end_time >= ?) OR
                    (start_time >= ? AND end_time <= ?)
                )
                """,
                (
                    booking["room"],
                    booking["date"],
                    booking_id,
                    booking["start_time"],
                    booking["start_time"],
                    booking["end_time"],
                    booking["end_time"],
                    booking["start_time"],
                    booking["end_time"],
                ),
            )

            if cursor.fetchone()[0] > 0:
                return (
                    jsonify(
                        {"success": False, "message": "ช่วงเวลานี้มีการจองที่ได้รับการอนุมัติแล้ว"}
                    ),
                    409,
                )

            # อนุมัติการจอง
            cursor.execute(
                """
                UPDATE bookings 
                SET status = 'approved', 
                    approved_by = ?,
                    remark = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (current_user["email"], remark, booking_id),
            )

            conn.commit()

        return jsonify({"success": True, "message": "อนุมัติการจองสำเร็จ"})

    except sqlite3.Error as e:
        return jsonify({"success": False, "message": str(e)}), 500


@booking_bp.route("/api/bookings/<int:booking_id>/reject", methods=["POST"])
@token_required
def reject_booking(current_user, booking_id):
    """ปฏิเสธการจอง (Admin only)"""

    # ตรวจสอบว่าเป็น admin หรือไม่
    if not current_user["email"].endswith("@kku.ac.th"):
        return jsonify({"success": False, "message": "ไม่มีสิทธิ์ในการปฏิเสธ"}), 403

    data = request.get_json()
    remark = data.get("remark", "ไม่ผ่านการอนุมัติ")

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                UPDATE bookings 
                SET status = 'rejected', 
                    approved_by = ?,
                    remark = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (current_user["email"], remark, booking_id),
            )

            conn.commit()

        return jsonify({"success": True, "message": "ปฏิเสธการจองสำเร็จ"})

    except sqlite3.Error as e:
        return jsonify({"success": False, "message": str(e)}), 500


@booking_bp.route("/api/bookings/<int:booking_id>/delete", methods=["DELETE"])
@token_required
def delete_booking(current_user, booking_id):
    """ลบการจอง (เจ้าของหรือ Admin)"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # ตรวจสอบว่าเป็นเจ้าของหรือ admin
            cursor.execute("SELECT user_id FROM bookings WHERE id = ?", (booking_id,))
            booking = cursor.fetchone()

            if not booking:
                return jsonify({"success": False, "message": "ไม่พบข้อมูลการจอง"}), 404

            is_owner = booking["user_id"] == current_user["user_id"]
            is_admin = current_user["email"].endswith("@kku.ac.th")

            if not (is_owner or is_admin):
                return jsonify({"success": False, "message": "ไม่มีสิทธิ์ในการลบ"}), 403

            cursor.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
            conn.commit()

        return jsonify({"success": True, "message": "ลบการจองสำเร็จ"})

    except sqlite3.Error as e:
        return jsonify({"success": False, "message": str(e)}), 500
