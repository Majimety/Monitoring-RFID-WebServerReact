"""
Database Sync Script
จัดการให้ข้อมูลใน users และ users_reg ซิงค์กัน
"""

import sqlite3
import os

DB_PATH = "database.db"


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def sync_users_to_users_reg():
    """
    ซิงค์ข้อมูลจาก users ไปยัง users_reg
    ใช้สำหรับข้อมูลเก่าที่ยังอยู่ใน users table
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # ดึงข้อมูลจาก users ที่ยังไม่มีใน users_reg
        cursor.execute(
            """
            SELECT u.rfid_uid, u.name, u.role
            FROM users u
            LEFT JOIN users_reg ur ON u.rfid_uid = ur.uuid
            WHERE ur.uuid IS NULL
        """
        )

        missing_users = cursor.fetchall()

        if not missing_users:
            print("✅ All users from 'users' table already exist in 'users_reg'")
            return

        print(f"Found {len(missing_users)} users to sync...")

        for user in missing_users:
            rfid_uid = user["rfid_uid"]
            name = user["name"]
            role = user["role"]

            # แยกชื่อ (ถ้ามีช่องว่าง)
            name_parts = name.split(" ", 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""

            # สร้าง user_id จาก rfid_uid (ถ้าไม่มี)
            user_id = f"USER_{rfid_uid}"

            # สร้าง email จาก rfid_uid
            email = f"{rfid_uid.lower()}@temp.local"

            cursor.execute(
                """
                INSERT INTO users_reg 
                (uuid, user_id, first_name, last_name, name, email, role, is_deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0)
            """,
                (rfid_uid, user_id, first_name, last_name, name, email, role),
            )

            print(f"✅ Synced: {name} ({rfid_uid})")

        conn.commit()
        print(f"\n✅ Successfully synced {len(missing_users)} users!")


def check_database_integrity():
    """ตรวจสอบความถูกต้องของ database"""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        print("\n=== Database Integrity Check ===\n")

        # ตรวจสอบ users_reg table
        cursor.execute("SELECT COUNT(*) FROM users_reg WHERE is_deleted = 0")
        active_users = cursor.fetchone()[0]
        print(f"Active users in users_reg: {active_users}")

        cursor.execute("SELECT COUNT(*) FROM users_reg WHERE is_deleted = 1")
        deleted_users = cursor.fetchone()[0]
        print(f"Deleted users in users_reg: {deleted_users}")

        # ตรวจสอบ duplicate uuid
        cursor.execute(
            """
            SELECT uuid, COUNT(*) as count 
            FROM users_reg 
            WHERE is_deleted = 0
            GROUP BY uuid 
            HAVING count > 1
        """
        )
        duplicates = cursor.fetchall()

        if duplicates:
            print(f"\n⚠️  Found {len(duplicates)} duplicate UUIDs:")
            for dup in duplicates:
                print(f"   - UUID: {dup['uuid']} (count: {dup['count']})")
        else:
            print("\n✅ No duplicate UUIDs found")

        # ตรวจสอบ duplicate user_id
        cursor.execute(
            """
            SELECT user_id, COUNT(*) as count 
            FROM users_reg 
            WHERE is_deleted = 0
            GROUP BY user_id 
            HAVING count > 1
        """
        )
        dup_user_ids = cursor.fetchall()

        if dup_user_ids:
            print(f"\n⚠️  Found {len(dup_user_ids)} duplicate User IDs:")
            for dup in dup_user_ids:
                print(f"   - User ID: {dup['user_id']} (count: {dup['count']})")
        else:
            print("✅ No duplicate User IDs found")

        # แสดงข้อมูล users ทั้งหมด
        cursor.execute(
            """
            SELECT id, uuid, user_id, first_name, last_name, email, role
            FROM users_reg 
            WHERE is_deleted = 0
            ORDER BY id
        """
        )
        users = cursor.fetchall()

        print(f"\n=== Active Users ({len(users)}) ===")
        print("-" * 100)
        for user in users:
            print(
                f"ID: {user['id']:2d} | UUID: {user['uuid']:10s} | User ID: {user['user_id']:15s} | "
                f"Name: {user['first_name']} {user['last_name']:20s} | Email: {user['email']:30s} | Role: {user['role']}"
            )


def add_missing_columns():
    """เพิ่มคอลัมน์ที่อาจจะหายไป"""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # ตรวจสอบว่ามี profile_image_path หรือยัง
        cursor.execute("PRAGMA table_info(users_reg)")
        columns = [col[1] for col in cursor.fetchall()]

        if "profile_image_path" not in columns:
            cursor.execute(
                """
                ALTER TABLE users_reg 
                ADD COLUMN profile_image_path TEXT DEFAULT NULL
            """
            )
            conn.commit()
            print("✅ Added profile_image_path column")
        else:
            print("✅ profile_image_path column already exists")


if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print(f"❌ Error: Database file '{DB_PATH}' not found!")
        print("Please make sure the database file is in the same directory.")
        exit(1)

    print("=" * 100)
    print("DATABASE SYNC & CHECK SCRIPT")
    print("=" * 100)

    # เพิ่มคอลัมน์ที่หายไป
    print("\n1. Checking columns...")
    add_missing_columns()

    # ซิงค์ข้อมูลจาก users table
    print("\n2. Syncing users...")
    sync_users_to_users_reg()

    # ตรวจสอบความถูกต้อง
    print("\n3. Checking integrity...")
    check_database_integrity()

    print("\n" + "=" * 100)
    print("✅ Database sync and check completed!")
    print("=" * 100)
