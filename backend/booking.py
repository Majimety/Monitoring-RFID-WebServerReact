from flask import Blueprint, request, jsonify
import sqlite3
import os
from datetime import datetime
import jwt
from functools import wraps
from notifications import notify_booking_result

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
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)"
        )
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date)")
        # Index เพิ่มเติมสำหรับ overlap check
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_bookings_room_date ON bookings(room, date)"
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
# Bug #4 Fix: Overlap Detection Helper
# =====================
def has_overlap(
    cursor, room: str, date: str, start_time: str, end_time: str, exclude_id: int = None
) -> bool:
    """
    ตรวจสอบว่ามีการจองที่ approved ซ้อนทับในช่วงเวลาที่กำหนดหรือไม่
    Standard overlap condition: NOT (A.end <= B.start OR A.start >= B.end)
    ซึ่งเทียบเท่า: A.start < B.end AND A.end > B.start
    """
    if exclude_id is not None:
        cursor.execute(
            """
            SELECT COUNT(*) FROM bookings
            WHERE room = ? AND date = ? AND status = 'approved' AND id != ?
              AND start_time < ? AND end_time > ?
            """,
            (room, date, exclude_id, end_time, start_time),
        )
    else:
        cursor.execute(
            """
            SELECT COUNT(*) FROM bookings
            WHERE room = ? AND date = ? AND status = 'approved'
              AND start_time < ? AND end_time > ?
            """,
            (room, date, end_time, start_time),
        )
    return cursor.fetchone()[0] > 0


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

            # ตรวจสอบ booking limit (3 รายการที่ active)
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

            created = []
            for booking in bookings:
                room = booking.get("room", "").strip()
                date = booking.get("date", "").strip()
                start_time = booking.get("start_time", "").strip()
                end_time = booking.get("end_time", "").strip()
                detail = booking.get("detail", "").strip()

                if not all([room, date, start_time, end_time]):
                    return (
                        jsonify({"success": False, "message": "ข้อมูลการจองไม่ครบถ้วน"}),
                        400,
                    )

                # Bug #4 Fix: ใช้ overlap helper ที่ถูกต้อง
                if has_overlap(cursor, room, date, start_time, end_time):
                    return (
                        jsonify(
                            {
                                "success": False,
                                "message": f"ห้อง {room} วันที่ {date} ช่วงเวลา {start_time}–{end_time} มีการจองที่อนุมัติแล้ว",
                            }
                        ),
                        409,
                    )

                cursor.execute(
                    """
                    INSERT INTO bookings (user_id, user_email, room, date, start_time, end_time, detail, status)
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
                created.append(cursor.lastrowid)

            conn.commit()

        return (
            jsonify(
                {"success": True, "message": f"ส่งคำขอจอง {len(created)} รายการสำเร็จ"}
            ),
            201,
        )

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
                    b.id, b.room, b.date, b.start_time, b.end_time, b.detail,
                    b.status, b.approved_by, b.remark, b.created_at,
                    approver.first_name AS approver_first_name,
                    approver.last_name  AS approver_last_name
                FROM bookings b
                LEFT JOIN admin_users approver ON b.approved_by = approver.email
                WHERE b.user_id = ?
                ORDER BY b.created_at DESC
                """,
                (current_user["user_id"],),
            )
            rows = cursor.fetchall()
            bookings = []
            for row in rows:
                booking = dict(row)
                booking["approved_by_name"] = (
                    f"{row['approver_first_name']} {row['approver_last_name']}"
                    if row["approver_first_name"]
                    else row["approved_by"]
                )
                bookings.append(booking)

            return jsonify({"success": True, "bookings": bookings})

    except sqlite3.Error as e:
        return jsonify({"success": False, "message": str(e)}), 500


@booking_bp.route("/api/bookings/all", methods=["GET"])
@token_required
def get_all_bookings(current_user):
    """ดึงข้อมูลการจองทั้งหมด (Admin only)"""
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
                    u.first_name        AS requester_first_name,
                    u.last_name         AS requester_last_name,
                    approver.first_name AS approver_first_name,
                    approver.last_name  AS approver_last_name
                FROM bookings b
                LEFT JOIN admin_users u        ON b.user_id = u.id
                LEFT JOIN admin_users approver ON b.approved_by = approver.email
                ORDER BY b.created_at DESC
                """
            )
            rows = cursor.fetchall()
            bookings = []
            for row in rows:
                booking = dict(row)
                booking["user_name"] = (
                    f"{row['requester_first_name']} {row['requester_last_name']}"
                    if row["requester_first_name"]
                    else row["user_email"]
                )
                booking["approved_by_name"] = (
                    f"{row['approver_first_name']} {row['approver_last_name']}"
                    if row["approver_first_name"]
                    else row["approved_by"]
                )
                bookings.append(booking)

            return jsonify({"success": True, "bookings": bookings})

    except sqlite3.Error as e:
        return jsonify({"success": False, "message": str(e)}), 500


@booking_bp.route("/api/bookings/<int:booking_id>/approve", methods=["POST"])
@token_required
def approve_booking(current_user, booking_id):
    """อนุมัติการจอง (Admin only)"""
    if not current_user["email"].endswith("@kku.ac.th"):
        return jsonify({"success": False, "message": "ไม่มีสิทธิ์ในการอนุมัติ"}), 403

    data = request.get_json() or {}
    remark = data.get("remark", "")

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
            booking = cursor.fetchone()

            if not booking:
                return jsonify({"success": False, "message": "ไม่พบข้อมูลการจอง"}), 404

            if booking["status"] != "pending":
                return (
                    jsonify(
                        {
                            "success": False,
                            "message": f"การจองนี้มีสถานะ '{booking['status']}' แล้ว",
                        }
                    ),
                    409,
                )

            # Bug #4 Fix: ใช้ overlap helper ที่ถูกต้อง
            if has_overlap(
                cursor,
                booking["room"],
                booking["date"],
                booking["start_time"],
                booking["end_time"],
                exclude_id=booking_id,
            ):
                return (
                    jsonify(
                        {
                            "success": False,
                            "message": "ช่วงเวลานี้มีการจองที่ได้รับการอนุมัติแล้ว",
                        }
                    ),
                    409,
                )

            cursor.execute(
                """
                UPDATE bookings
                SET status = 'approved', approved_by = ?, remark = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (current_user["email"], remark, booking_id),
            )
            conn.commit()

        # ส่ง notification หลัง commit สำเร็จ
        notify_booking_result(booking_id=booking_id, status="approved", remark=remark)
        return jsonify({"success": True, "message": "อนุมัติการจองสำเร็จ"})

    except sqlite3.Error as e:
        return jsonify({"success": False, "message": str(e)}), 500


@booking_bp.route("/api/bookings/<int:booking_id>/reject", methods=["POST"])
@token_required
def reject_booking(current_user, booking_id):
    """ปฏิเสธการจอง (Admin only)"""
    if not current_user["email"].endswith("@kku.ac.th"):
        return jsonify({"success": False, "message": "ไม่มีสิทธิ์ในการปฏิเสธ"}), 403

    data = request.get_json() or {}
    remark = data.get("remark", "ไม่ผ่านการอนุมัติ")

    if not remark.strip():
        return jsonify({"success": False, "message": "กรุณาระบุเหตุผลในการปฏิเสธ"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT status FROM bookings WHERE id = ?", (booking_id,))
            booking = cursor.fetchone()
            if not booking:
                return jsonify({"success": False, "message": "ไม่พบข้อมูลการจอง"}), 404

            if booking["status"] != "pending":
                return (
                    jsonify(
                        {
                            "success": False,
                            "message": f"การจองนี้มีสถานะ '{booking['status']}' แล้ว",
                        }
                    ),
                    409,
                )

            cursor.execute(
                """
                UPDATE bookings
                SET status = 'rejected', approved_by = ?, remark = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (current_user["email"], remark, booking_id),
            )
            conn.commit()

        # ส่ง notification หลัง commit สำเร็จ
        notify_booking_result(booking_id=booking_id, status="rejected", remark=remark)
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


@booking_bp.route("/api/bookings/schedule", methods=["GET"])
def get_schedule():
    """
    ดึงตาราง bookings ที่ approved สำหรับ room + date ที่กำหนด
    ใช้แสดงสีในตารางจอง (ไม่ต้อง login ก็ดูได้)
    """
    room = request.args.get("room", "")
    date = request.args.get("date", "")

    if not room or not date:
        return jsonify({"error": "room and date are required"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT start_time, end_time
                FROM bookings
                WHERE room = ? AND date = ? AND status = 'approved'
                ORDER BY start_time
                """,
                (room, date),
            )
            slots = [
                {"start_time": r["start_time"], "end_time": r["end_time"]}
                for r in cursor.fetchall()
            ]

        return jsonify({"success": True, "booked_slots": slots})

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500
