"""
notifications.py
================
จัดการ Notification ทั้งหมดของระบบ RFID Room Booking

Triggers:
  1. Admin อนุมัติการจอง   → แจ้งนักศึกษา (in-app + email)
  2. Admin ปฏิเสธการจอง   → แจ้งนักศึกษา (in-app + email)
  3. RFID scan denied      → แจ้ง admin ทุกคน (in-app)
  4. Booking reminder      → แจ้งนักศึกษา 30 นาทีก่อน (in-app + email)
"""

from flask import Blueprint, request, jsonify
import sqlite3
import os
import smtplib
import threading
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from functools import wraps
import jwt

notif_bp = Blueprint("notifications", __name__)

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.abspath(os.path.join(BASE_DIR, "database.db"))


# =====================
# DB Helper
# =====================
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_notification_db():
    """สร้างตาราง notifications"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS notifications (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER,
                user_email  TEXT NOT NULL,
                type        TEXT NOT NULL,
                title       TEXT NOT NULL,
                message     TEXT NOT NULL,
                is_read     BOOLEAN DEFAULT 0,
                ref_id      INTEGER,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_notif_user  ON notifications(user_email)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_notif_read  ON notifications(is_read)"
        )
        conn.commit()


# =====================
# Auth Decorator
# =====================
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
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
# Email Helper
# =====================
def _get_email_config():
    return {
        "host": os.getenv("MAIL_HOST", "smtp.gmail.com"),
        "port": int(os.getenv("MAIL_PORT", "587")),
        "user": os.getenv("MAIL_USER", ""),
        "password": os.getenv("MAIL_PASSWORD", ""),
        "sender": os.getenv("MAIL_SENDER", os.getenv("MAIL_USER", "")),
        "enabled": os.getenv("MAIL_ENABLED", "false").lower() == "true",
    }


def send_email_async(to_email: str, subject: str, html_body: str):
    """ส่ง email แบบ async (non-blocking) — ไม่ block main thread"""

    def _send():
        cfg = _get_email_config()
        if not cfg["enabled"] or not cfg["user"] or not cfg["password"]:
            print(f"[EMAIL] disabled or not configured — skipping to {to_email}")
            return
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"KKU Room Booking <{cfg['sender']}>"
            msg["To"] = to_email
            msg.attach(MIMEText(html_body, "html", "utf-8"))

            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.login(cfg["user"], cfg["password"])
                server.sendmail(cfg["sender"], to_email, msg.as_string())

            print(f"[EMAIL] sent to {to_email}: {subject}")
        except Exception as e:
            print(f"[EMAIL] failed to {to_email}: {e}")

    threading.Thread(target=_send, daemon=True).start()


def _booking_email_html(
    title: str,
    student_name: str,
    room: str,
    date: str,
    start_time: str,
    end_time: str,
    status: str,
    remark: str = "",
) -> str:
    color = "#4caf50" if status == "approved" else "#e53935"
    status_th = "✅ อนุมัติแล้ว" if status == "approved" else "❌ ปฏิเสธ"
    remark_row = (
        f"<tr><td style='padding:6px 0;color:#666'>หมายเหตุ</td><td style='padding:6px 0;font-weight:600;color:#e53935'>{remark}</td></tr>"
        if remark
        else ""
    )
    return f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
      <div style="background:{color};padding:24px;text-align:center">
        <h2 style="color:#fff;margin:0;font-size:20px">{title}</h2>
      </div>
      <div style="padding:28px">
        <p style="color:#444">เรียน <strong>{student_name}</strong>,</p>
        <p style="color:#444">ผลการพิจารณาคำขอจองห้องของคุณ:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:6px 0;color:#666">ห้อง</td>        <td style="padding:6px 0;font-weight:600">{room}</td></tr>
          <tr><td style="padding:6px 0;color:#666">วันที่</td>       <td style="padding:6px 0;font-weight:600">{date}</td></tr>
          <tr><td style="padding:6px 0;color:#666">เวลา</td>         <td style="padding:6px 0;font-weight:600">{start_time} – {end_time}</td></tr>
          <tr><td style="padding:6px 0;color:#666">สถานะ</td>        <td style="padding:6px 0;font-weight:600;color:{color}">{status_th}</td></tr>
          {remark_row}
        </table>
        <p style="color:#888;font-size:13px;margin-top:24px">— ระบบจองห้อง คณะวิศวกรรมศาสตร์ มข.</p>
      </div>
    </div>
    """


def _reminder_email_html(
    student_name: str, room: str, date: str, start_time: str, end_time: str
) -> str:
    return f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
      <div style="background:#1565c0;padding:24px;text-align:center">
        <h2 style="color:#fff;margin:0;font-size:20px">⏰ แจ้งเตือนการจองห้อง</h2>
      </div>
      <div style="padding:28px">
        <p style="color:#444">เรียน <strong>{student_name}</strong>,</p>
        <p style="color:#444">การจองห้องของคุณ <strong>ใกล้ถึงเวลาแล้ว</strong> (อีกประมาณ 30 นาที)</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:6px 0;color:#666">ห้อง</td>   <td style="padding:6px 0;font-weight:600">{room}</td></tr>
          <tr><td style="padding:6px 0;color:#666">วันที่</td>  <td style="padding:6px 0;font-weight:600">{date}</td></tr>
          <tr><td style="padding:6px 0;color:#666">เวลา</td>    <td style="padding:6px 0;font-weight:600">{start_time} – {end_time}</td></tr>
        </table>
        <p style="color:#888;font-size:13px;margin-top:24px">— ระบบจองห้อง คณะวิศวกรรมศาสตร์ มข.</p>
      </div>
    </div>
    """


# =====================
# Core: Create Notification
# =====================
def create_notification(
    user_email: str,
    notif_type: str,
    title: str,
    message: str,
    ref_id: int = None,
    user_id: int = None,
):
    """บันทึก notification ลง DB"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO notifications (user_id, user_email, type, title, message, ref_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (user_id, user_email, notif_type, title, message, ref_id),
            )
            conn.commit()
            return cursor.lastrowid
    except Exception as e:
        print(f"[NOTIF] create_notification error: {e}")
        return None


# =====================
# Trigger 1 & 2: Booking Approved / Rejected
# =====================
def notify_booking_result(booking_id: int, status: str, remark: str = ""):
    """
    เรียกจาก booking.py หลังจาก approve/reject
    status: 'approved' | 'rejected'
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT b.id, b.user_email, b.room, b.date, b.start_time, b.end_time,
                       u.first_name, u.last_name, u.id AS uid
                FROM bookings b
                LEFT JOIN admin_users u ON b.user_email = u.email
                WHERE b.id = ?
                """,
                (booking_id,),
            )
            b = cursor.fetchone()
            if not b:
                return

        student_name = (
            f"{b['first_name']} {b['last_name']}"
            if b["first_name"]
            else b["user_email"]
        )
        is_approved = status == "approved"
        title = "✅ การจองห้องได้รับการอนุมัติ" if is_approved else "❌ การจองห้องถูกปฏิเสธ"
        message = (
            f"ห้อง {b['room']} วันที่ {b['date']} เวลา {b['start_time']}–{b['end_time']} ได้รับการอนุมัติแล้ว"
            if is_approved
            else f"ห้อง {b['room']} วันที่ {b['date']} เวลา {b['start_time']}–{b['end_time']} ถูกปฏิเสธ"
            + (f" เหตุผล: {remark}" if remark else "")
        )

        # In-app
        create_notification(
            user_email=b["user_email"],
            user_id=b["uid"],
            notif_type="booking_result",
            title=title,
            message=message,
            ref_id=booking_id,
        )

        # Email (async)
        html = _booking_email_html(
            title=title,
            student_name=student_name,
            room=b["room"],
            date=b["date"],
            start_time=b["start_time"],
            end_time=b["end_time"],
            status=status,
            remark=remark,
        )
        send_email_async(b["user_email"], title, html)

    except Exception as e:
        print(f"[NOTIF] notify_booking_result error: {e}")


# =====================
# Trigger 3: RFID Denied — แจ้ง Admin ทุกคน
# =====================
def notify_rfid_denied(uuid: str, room: str):
    """เรียกจาก app.py เมื่อ RFID scan denied"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT email FROM admin_users WHERE is_active = 1")
            admins = [row["email"] for row in cursor.fetchall()]

        if not admins:
            return

        title = "⚠️ RFID Scan Denied"
        message = f"UUID: {uuid} พยายามเข้าห้อง {room or 'ไม่ระบุ'} แต่ยังไม่ได้ลงทะเบียน"

        for admin_email in admins:
            create_notification(
                user_email=admin_email,
                notif_type="rfid_denied",
                title=title,
                message=message,
            )

    except Exception as e:
        print(f"[NOTIF] notify_rfid_denied error: {e}")


# =====================
# Trigger 4: Booking Reminder (30 นาทีก่อน)
# =====================
def check_and_send_reminders():
    """
    เรียกจาก scheduler ทุก 5 นาที
    หาการจองที่ approved และเริ่มใน 25–35 นาที แล้วส่ง reminder (ส่งครั้งเดียว)
    """
    try:
        now = datetime.now()
        target_min = now + timedelta(minutes=25)
        target_max = now + timedelta(minutes=35)

        t_min = target_min.strftime("%H:%M")
        t_max = target_max.strftime("%H:%M")
        today = now.strftime("%Y-%m-%d")

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT b.id, b.user_email, b.room, b.date, b.start_time, b.end_time,
                       u.first_name, u.last_name, u.id AS uid
                FROM bookings b
                LEFT JOIN admin_users u ON b.user_email = u.email
                WHERE b.status = 'approved'
                  AND b.date   = ?
                  AND b.start_time >= ? AND b.start_time <= ?
                """,
                (today, t_min, t_max),
            )
            upcoming = cursor.fetchall()

            for b in upcoming:
                # ตรวจว่าเคยส่ง reminder นี้ไปแล้วหรือยัง
                cursor.execute(
                    """
                    SELECT 1 FROM notifications
                    WHERE user_email = ? AND type = 'reminder' AND ref_id = ?
                    """,
                    (b["user_email"], b["id"]),
                )
                if cursor.fetchone():
                    continue  # ส่งไปแล้ว

                student_name = (
                    f"{b['first_name']} {b['last_name']}"
                    if b["first_name"]
                    else b["user_email"]
                )
                title = "⏰ แจ้งเตือน: การจองห้องใกล้ถึงเวลา"
                message = (
                    f"ห้อง {b['room']} วันที่ {b['date']} "
                    f"เวลา {b['start_time']}–{b['end_time']} อีก 30 นาที"
                )

                # In-app
                create_notification(
                    user_email=b["user_email"],
                    user_id=b["uid"],
                    notif_type="reminder",
                    title=title,
                    message=message,
                    ref_id=b["id"],
                )

                # Email (async)
                html = _reminder_email_html(
                    student_name=student_name,
                    room=b["room"],
                    date=b["date"],
                    start_time=b["start_time"],
                    end_time=b["end_time"],
                )
                send_email_async(b["user_email"], title, html)
                print(f"[REMINDER] sent to {b['user_email']} for booking {b['id']}")

    except Exception as e:
        print(f"[NOTIF] check_and_send_reminders error: {e}")


# =====================
# API Routes
# =====================


@notif_bp.route("/api/notifications", methods=["GET"])
@token_required
def get_notifications(current_user):
    """ดึง notifications ของผู้ใช้ที่ login อยู่"""
    try:
        limit = min(int(request.args.get("limit", 30)), 100)
        offset = max(int(request.args.get("offset", 0)), 0)
        unread_only = request.args.get("unread", "false").lower() == "true"
    except ValueError:
        limit, offset = 30, 0
        unread_only = False

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            where = "WHERE user_email = ?"
            params = [current_user["email"]]
            if unread_only:
                where += " AND is_read = 0"

            cursor.execute(f"SELECT COUNT(*) FROM notifications {where}", params)
            total = cursor.fetchone()[0]

            # unread count (เสมอ)
            cursor.execute(
                "SELECT COUNT(*) FROM notifications WHERE user_email = ? AND is_read = 0",
                (current_user["email"],),
            )
            unread_count = cursor.fetchone()[0]

            cursor.execute(
                f"""
                SELECT id, type, title, message, is_read, ref_id, created_at
                FROM notifications
                {where}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                """,
                params + [limit, offset],
            )
            notifications = [dict(row) for row in cursor.fetchall()]

        return jsonify(
            {
                "success": True,
                "total": total,
                "unread_count": unread_count,
                "notifications": notifications,
            }
        )

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@notif_bp.route("/api/notifications/unread-count", methods=["GET"])
@token_required
def get_unread_count(current_user):
    """ดึงจำนวน unread — เรียกบ่อยๆ สำหรับ badge บนกระดิ่ง"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM notifications WHERE user_email = ? AND is_read = 0",
                (current_user["email"],),
            )
            count = cursor.fetchone()[0]
        return jsonify({"success": True, "unread_count": count})
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@notif_bp.route("/api/notifications/<int:notif_id>/read", methods=["POST"])
@token_required
def mark_as_read(current_user, notif_id):
    """Mark notification เดี่ยวว่าอ่านแล้ว"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_email = ?",
                (notif_id, current_user["email"]),
            )
            conn.commit()
        return jsonify({"success": True})
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@notif_bp.route("/api/notifications/read-all", methods=["POST"])
@token_required
def mark_all_read(current_user):
    """Mark ทุก notification ของ user นี้ว่าอ่านแล้ว"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE notifications SET is_read = 1 WHERE user_email = ?",
                (current_user["email"],),
            )
            conn.commit()
        return jsonify({"success": True})
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@notif_bp.route("/api/notifications/<int:notif_id>", methods=["DELETE"])
@token_required
def delete_notification(current_user, notif_id):
    """ลบ notification"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM notifications WHERE id = ? AND user_email = ?",
                (notif_id, current_user["email"]),
            )
            conn.commit()
        return jsonify({"success": True})
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500
