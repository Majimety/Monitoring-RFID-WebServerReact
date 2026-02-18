"""
Export active users from database to users.csv
Run this once to sync existing DB records into CSV
"""

import sqlite3
import csv
import os

DB_PATH = "database.db"
CSV_PATH = os.path.join("database", "users.csv")


def export_users_to_csv():
    os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(
            """
            SELECT uuid, user_id, first_name, last_name, 
                   first_name || ' ' || last_name as name, email, role
            FROM users_reg
            WHERE is_deleted = 0
            ORDER BY id
        """
        )
        users = cur.fetchall()

    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            ["uuid", "user_id", "first_name", "last_name", "name", "email", "role"]
        )
        for u in users:
            writer.writerow(
                [
                    u["uuid"],
                    u["user_id"],
                    u["first_name"],
                    u["last_name"],
                    u["name"],
                    u["email"],
                    u["role"],
                ]
            )

    print(f"✅ Exported {len(users)} users to {CSV_PATH}")
    for u in users:
        print(f"  - {u['user_id']} | {u['first_name']} {u['last_name']} | {u['email']}")


if __name__ == "__main__":
    export_users_to_csv()
