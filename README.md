# RFID Room Monitoring & Booking System — KKU Engineering

**Stack: React 18 · Flask 3 (Python) · Flask-SocketIO · SQLite · ESP32 (Arduino C++)**

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Design Concept](#2-design-concept)
3. [Project Structure](#3-project-structure)
4. [Prerequisites](#4-prerequisites)
5. [Running the System](#5-running-the-system)
6. [Running with Docker](#6-running-with-docker)
7. [Environment Variables](#7-environment-variables)
8. [Database Schema](#8-database-schema)
9. [API Reference](#9-api-reference)
10. [ESP32 Firmware](#10-esp32-firmware)
11. [Authentication & Role System](#11-authentication--role-system)
12. [Notification System](#12-notification-system)
13. [Room Booking System](#13-room-booking-system)
14. [Access Control Logic](#14-access-control-logic)
15. [Real-time Events (SocketIO)](#15-real-time-events-socketio)
16. [Troubleshooting](#16-troubleshooting)
17. [Dependencies](#17-dependencies)

---

## 1. System Overview

An RFID-based room access monitoring and booking system for the Faculty of Engineering, Khon Kaen University. The system consists of three layers working together: ESP32 devices installed at room doors, a Flask backend for business logic, and a React frontend providing an admin management dashboard and a student room booking interface.

```
React Web UI (Port 3000)
        |
        | HTTP (JSON) + WebSocket (Socket.IO)
        v
Flask Backend  (Port 5000)
        |
        | SQLite (local file)
        v
database.db
        ^
        | HTTP POST /api/send_uuid
        |
ESP32 (RFID Reader + Relay)
```

| Layer | Technology | Role |
|---|---|---|
| React Frontend | React 18 / Socket.IO Client | Admin Dashboard and Room Booking UI for students |
| Flask Backend | Python 3.11 / Flask 3 / Flask-SocketIO | Business logic, JWT auth, door control, booking, notifications |
| SQLite | SQLite3 (via Python) | Stores users, bookings, access logs, and notifications |
| ESP32 (Register) | Arduino C++ / MFRC522 / WiFi | Reads RFID card and sends UUID to backend for registration |
| ESP32 (Door) | Arduino C++ / MFRC522 / Relay | Controls the door — scans card, checks booking, triggers relay |

---

## 2. Design Concept

### 2.1 Architecture Flow

The system operates on two primary flows: the RFID Scan Flow and the Web Door Control Flow.

**RFID Scan Flow (physical door entry via card):**

```
User taps RFID card at ESP32_Door
        |
        v
ESP32 sends POST /api/send_uuid {uuid, room}
        |
        v
Backend looks up UUID in users_reg
  ├── Not found → result = "denied" → HTTP 403
  └── Found → check role
         ├── admin → result = "granted" (always)
         └── student → _check_booking_access(email, room)
                  ├── Approved booking exists for this room/time → "granted" → HTTP 200
                  └── No valid booking → "denied" → HTTP 403
        |
        v
ESP32 reads HTTP status code
  ├── 200 → Activate relay (door opens for 5 seconds)
  └── 403 → Door remains closed
        |
        v
Backend emits SocketIO "uuid_update" → Admin Dashboard updates in real-time
```

**Web Door Control Flow (admin opens door from Dashboard):**

```
Admin clicks "Open Door" on Dashboard
        |
        v
React sends POST /api/door/open {room}
        |
        v
Flask stores command in room_commands dict
        |
        v
ESP32 polls GET /api/door/command?room=EN4401 every 1 second
        |
        v
Flask returns {"command": "open"} (TTL 10 seconds, then cleared)
        |
        v
ESP32 receives command → activates relay
```

### 2.2 Role-based Routing

The system uses email domain to assign roles and automatically route users to the correct page after login.

| Email Domain | Role | Page after Login |
|---|---|---|
| `@kku.ac.th` | `admin` | Admin Dashboard (manage RFID users, bookings, logs) |
| `@kkumail.com` | `student` | Room Booking (submit and view own bookings) |

### 2.3 Admin Dashboard Pages

The Admin Dashboard (`@kku.ac.th`) contains six main pages.

| Page | Content |
|---|---|
| Dashboard | System overview, real-time scan feed (SocketIO), access log statistics |
| RFID Users | List of registered RFID users — add, edit, delete, search |
| Booking Requests | All room booking requests — approve or reject with optional remarks |
| Access Logs | Full scan history with filtering by room, result, and search term; paginated |
| System Settings | Room management, remote door open/close, ESP32 online/offline status |
| Room Booking | Admins can also submit room bookings for themselves |

### 2.4 Student Booking Flow

Students (`@kkumail.com`) are directed to the Room Booking page, which displays a Calendar UI. From there they can:

1. Select a room and date from the calendar
2. Choose a time slot (available slots are checked automatically)
3. Fill in booking details and submit the request
4. Receive a notification when the admin approves or rejects the booking

### 2.5 Offline Fallback (ESP32_Door)

ESP32_Door maintains an admin whitelist in RAM to handle cases where the server is unreachable.

```
Server does not respond (HTTP timeout)
        |
        v
ESP32 checks adminWhitelist[] in RAM
  ├── UUID found in whitelist → door opens (admin only)
  └── UUID not found → door remains closed
        |
        v
Whitelist refreshes every 5 minutes (loaded from /api/whitelist)
Retries every 30 seconds if the initial load fails
```

---

## 3. Project Structure

```
Monitoring-RFID-WebServerReact/
│
├── backend/
│   ├── app.py                   Flask entry point — main routes (RFID, door, users, logs)
│   ├── auth.py                  Blueprint: register, login, profile, JWT middleware
│   ├── booking.py               Blueprint: room booking, approve/reject, booking list
│   ├── notifications.py         Blueprint: in-app notifications, email reminders (30 min before)
│   ├── requirements.txt         Python dependencies
│   ├── Dockerfile               Backend Docker image (python:3.11-slim)
│   ├── database.db              SQLite database (auto-created on first run)
│   └── database/
│       ├── users.csv            CSV backup of users_reg (auto-generated)
│       └── admins.csv           CSV backup of admin users only (auto-generated)
│
├── ESP32_TestWithServer/
│   ├── ESP32_Door.cpp           Firmware for the door controller (scan → booking check → relay)
│   └── ESP32_Register.cpp       Firmware for the registration reader (sends UUID + source=register)
│
├── src/
│   ├── assets/images/
│   │   └── default-avatar.svg   Default user avatar image
│   ├── App.jsx                  Root component — manages routing between all views
│   ├── index.js                 Entry point — mounts the React app
│   ├── index.css                Global styles
│   ├── Login.jsx                Login page with field-level error display
│   ├── Signup.jsx               Signup page — auto-formats student ID input
│   ├── AdminDashboard.jsx       Main admin dashboard (SocketIO, all admin pages combined)
│   ├── AdminDashboard.css       Styles for Admin Dashboard
│   ├── Auth.css                 Styles for Login and Signup pages
│   ├── RoomBooking.jsx          Room booking page for students (Calendar UI)
│   ├── RoomBooking.css          Styles for Room Booking
│   ├── Bookingspage.jsx         Student's own booking list
│   ├── Profile.jsx              User profile edit page
│   ├── Profile.css              Styles for Profile page
│   └── setupProxy.js            Dev proxy — forwards /api and /socket.io to localhost:5000
│
├── public/
│   ├── index.html               HTML template
│   └── logo/
│       ├── enkku_logo.png       KKU Engineering Faculty logo
│       └── enkku_logo.svg       SVG version (fallback)
│
├── photos/                      User profile photo storage (auto-created)
├── .env                         Environment variables (not committed to git)
├── .gitignore
├── Dockerfile.frontend          Multi-stage build: Node 18 build → Nginx serve
├── docker-compose.yml           Orchestrates backend + frontend containers
├── nginx.conf                   Nginx config — serves React build and proxies /api to backend
├── package-lock.json
└── package.json                 React dependencies
```

---

## 4. Prerequisites

| Software | Minimum Version | Purpose |
|---|---|---|
| Python | 3.11 | Run the Flask backend |
| Node.js | 18.x | Run the React frontend (development) |
| npm | 9.x | Manage JavaScript packages |
| Docker Desktop | Latest | Run backend and frontend via containers (optional) |
| Arduino IDE / PlatformIO | Latest | Compile and upload firmware to ESP32 |

Verify installations:

```bash
python --version
node --version
npm --version
docker --version
```

**Required Arduino Libraries (install via Library Manager):**

| Library | Used In |
|---|---|
| `MFRC522` by GithubCommunity | Read RFID cards via SPI |
| `WiFi` (built-in ESP32) | WiFi connectivity |
| `HTTPClient` (built-in ESP32) | Send HTTP requests to the server |
| `ArduinoJson` by Benoit Blanchon | Parse JSON responses (ESP32_Door only) |

---

## 5. Running the System

During development, both the backend and frontend must run simultaneously. Open two separate terminal windows.

### Terminal 1 — Flask Backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The backend runs at `http://localhost:5000`.

On first run, the system automatically creates `database.db` and all required tables.

### Terminal 2 — React Frontend

```bash
# Run from the project root (not inside backend/)
npm install
npm start
```

The frontend runs at `http://localhost:3000`. All `/api` and `/socket.io` requests are automatically proxied to port 5000 via `setupProxy.js`.

---

## 6. Running with Docker

Docker Compose builds and starts two containers: `rfid-backend` and `rfid-frontend`.

### Create the `.env` file first

```bash
cp .env.example .env
# Edit SECRET_KEY and mail settings
```

### Start all services

```bash
docker compose up -d
```

| Service | Container | Port | Role |
|---|---|---|---|
| backend | `rfid-backend` | `5000:5000` | Flask API server |
| frontend | `rfid-frontend` | `3000:80` | Nginx serving the React build |

View logs:

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

Stop and remove containers:

```bash
docker compose down
```

**Note:** `db-data` and `photos-data` are mounted as Docker volumes, so the database and uploaded photos persist across container restarts.

---

## 7. Environment Variables

All environment variables are loaded from the `.env` file in the project root via `python-dotenv`.

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | `your-secret-key-change-this-in-production` | Used to sign JWT tokens — **must be changed in production** |
| `DATABASE_PATH` | `database.db` | Path to the SQLite database file (relative to `app.py`) |
| `UPLOAD_FOLDER` | `photos` | Directory for storing user profile photos |
| `HOST` | `0.0.0.0` | Host address Flask listens on |
| `PORT` | `5000` | Port Flask listens on |
| `FLASK_ENV` | `development` | Flask environment mode |
| `FLASK_DEBUG` | `True` | Enable or disable debug mode |
| `MAIL_SERVER` | — | SMTP server for sending email notifications |
| `MAIL_PORT` | `587` | SMTP port |
| `MAIL_USERNAME` | — | Sender email address |
| `MAIL_PASSWORD` | — | Sender email password or app password |

Example `.env` file:

```env
SECRET_KEY=my-super-secret-key-2024
DATABASE_PATH=/app/data/database.db
UPLOAD_FOLDER=/app/photos
HOST=0.0.0.0
PORT=5000
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=noreply@example.com
MAIL_PASSWORD=your-app-password
```

---

## 8. Database Schema

The system uses a single SQLite file (`database.db`) with six tables. All tables are created automatically when the backend runs for the first time.

### `admin_users` — All registered user accounts

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment primary key |
| `email` | TEXT UNIQUE | User email (@kku.ac.th = admin, @kkumail.com = student) |
| `first_name` | TEXT | First name |
| `last_name` | TEXT | Last name |
| `password_hash` | TEXT | bcrypt hash (supports legacy SHA-256 migration) |
| `phone` | TEXT | Phone number (optional) |
| `user_id` | TEXT | Student or staff ID number |
| `role` | TEXT | `admin` or `student` |
| `is_active` | BOOLEAN | Soft delete flag |
| `last_login` | TIMESTAMP | Timestamp of most recent login |

### `users_reg` — Users with a registered RFID card

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment primary key |
| `uuid` | TEXT | RFID card UID (hex uppercase, e.g. `A1B2C3D4`) |
| `user_id` | TEXT | Student or staff ID number |
| `first_name` / `last_name` / `name` | TEXT | Full name fields |
| `email` | TEXT | Email address linked to this RFID card |
| `role` | TEXT | `admin` or `student` |
| `profile_image_path` | TEXT | Path to profile photo (nullable) |
| `is_deleted` | BOOLEAN | Soft delete flag |

### `access_logs` — Complete RFID scan history

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment primary key |
| `uuid` | TEXT | Scanned UUID (`WEB` when opened from dashboard) |
| `user_id` / `name` / `email` / `role` | TEXT | User info (null if UUID is unrecognized) |
| `room` | TEXT | Room name where the scan occurred |
| `result` | TEXT | `granted` or `denied` |
| `method` | TEXT | `rfid` or `web` |
| `scanned_at` | TIMESTAMP | Timestamp of the scan |

Logs older than 30 days are automatically purged by a background scheduler that runs every 24 hours.

### `bookings` — Room booking requests

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment primary key |
| `user_id` | INTEGER FK | References `admin_users.id` |
| `user_email` | TEXT | Email of the person who booked |
| `room` | TEXT | Room name |
| `date` | TEXT | Booking date (YYYY-MM-DD) |
| `start_time` / `end_time` | TEXT | Time range (HH:MM) |
| `detail` | TEXT | Purpose or description |
| `status` | TEXT | `pending` → `approved` or `rejected` |
| `approved_by` | TEXT | Email of the admin who approved or rejected |
| `remark` | TEXT | Admin's optional remark |

### `notifications` — In-app notification records

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment primary key |
| `user_email` | TEXT | Email of the notification recipient |
| `type` | TEXT | `booking_approved`, `booking_rejected`, `rfid_denied`, or `reminder` |
| `title` / `message` | TEXT | Notification content |
| `is_read` | BOOLEAN | Whether the notification has been read |
| `ref_id` | INTEGER | References the related booking id |

### `rfid_register_requests` — RFID registration requests

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment primary key |
| `user_id` | TEXT | Student or staff ID |
| `email` | TEXT | Requester's email |
| `first_name` / `last_name` | TEXT | Full name |
| `status` | TEXT | `pending` → `approved` or `rejected` |

---

## 9. API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/register` | None | Create a new account |
| POST | `/api/login` | None | Login and receive a JWT token |
| GET | `/api/profile/me` | JWT | Get the current user's profile |
| PUT | `/api/profile/update` | JWT | Update the current user's profile |
| DELETE | `/api/admin/delete-user/<id>` | JWT (admin) | Soft-delete a user account |

### RFID Users

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/users` | JWT (admin) | List all RFID-registered users |
| POST | `/api/add_user` | JWT (admin) | Add a new user with a UUID |
| PUT | `/api/edit_user/<id>` | JWT (admin) | Edit a user's information |
| DELETE | `/api/delete_user/<id>` | JWT (admin) | Soft-delete a user |
| GET | `/api/admin/all-users` | JWT (admin) | List users who signed up but have not yet registered an RFID card |
| GET | `/api/user/lookup?user_id=<id>` | JWT (admin) | Look up a user by student ID |
| GET | `/api/whitelist` | None | Admin UUID list for ESP32 offline fallback |

### RFID Registration Requests

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/rfid/request` | JWT | Submit an RFID registration request |
| GET | `/api/rfid/requests` | JWT (admin) | List all registration requests |
| PUT | `/api/rfid/requests/<id>/approve` | JWT (admin) | Approve a registration request |
| PUT | `/api/rfid/requests/<id>/reject` | JWT (admin) | Reject a registration request |
| GET | `/api/rfid/my-status` | JWT | Check the current user's RFID registration status |

### Door Control

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/send_uuid` | None (ESP32) | ESP32 submits a UUID for access check (200 = granted, 403 = denied) |
| GET | `/api/latest_uuid` | JWT (admin) | Get the most recently scanned UUID |
| POST | `/api/door/open` | JWT (admin) | Send an open command to the ESP32 |
| POST | `/api/door/close` | JWT (admin) | Send a close command to the ESP32 |
| GET | `/api/door/command?room=<n>` | None (ESP32) | ESP32 polls for a pending command (TTL 10 seconds) |
| GET | `/api/rooms/status` | JWT (admin) | View online/offline status of each ESP32 by room |

### Access Logs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/access-logs` | JWT (admin) | Retrieve access logs with optional filters and pagination |
| GET | `/api/access-logs/stats` | JWT (admin) | Aggregate statistics (total, granted, denied, today, by room) |
| DELETE | `/api/access-logs/purge-old` | JWT (admin) | Manually delete logs older than 30 days |

Query parameters for `/api/access-logs`:

| Parameter | Description | Default |
|---|---|---|
| `room` | Filter by room name | All rooms |
| `result` | `granted` / `denied` / `all` | `all` |
| `search` | Search by uuid, name, email, or user_id | — |
| `limit` | Number of rows to return (max 1000) | 200 |
| `offset` | Pagination offset | 0 |

### Booking

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/bookings` | JWT | Submit a new room booking request |
| GET | `/api/bookings/my` | JWT | Get the current user's own bookings |
| GET | `/api/bookings/all` | JWT (admin) | Get all bookings |
| GET | `/api/bookings/available-slots` | JWT | Get available time slots for a room |
| PUT | `/api/bookings/<id>/approve` | JWT (admin) | Approve a booking |
| PUT | `/api/bookings/<id>/reject` | JWT (admin) | Reject a booking |
| DELETE | `/api/bookings/<id>` | JWT | Cancel a booking |

### Notifications

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/notifications` | JWT | Get the current user's notifications |
| GET | `/api/notifications/unread-count` | JWT | Get the number of unread notifications |
| PUT | `/api/notifications/<id>/read` | JWT | Mark a single notification as read |
| PUT | `/api/notifications/read-all` | JWT | Mark all notifications as read |

---

## 10. ESP32 Firmware

The project uses two separate ESP32 boards running different firmware.

### ESP32_Register.cpp — Card Registration Reader

Used to read an RFID card and send its UUID to the backend so an admin can link it to a user account in the dashboard.

**Hardware wiring:**

| Pin | Connection |
|---|---|
| GPIO 5 (SS) | MFRC522 SDA |
| GPIO 21 (RST) | MFRC522 RST |
| GPIO 18 (SCK) | MFRC522 SCK |
| GPIO 19 (MISO) | MFRC522 MISO |
| GPIO 23 (MOSI) | MFRC522 MOSI |

**Behavior:**

1. Connects to WiFi on boot
2. Waits for an RFID card to be presented
3. Reads the UID and converts it to uppercase hex
4. Sends `POST /api/send_uuid` with `{uuid, source: "register"}`
5. The backend immediately broadcasts the UUID to the Admin Dashboard via SocketIO

**Values to update before uploading:**

```cpp
const char *ssid = "YOUR_WIFI_SSID";
const char *password = "YOUR_WIFI_PASSWORD";
const char *apiIPAddress = "http://192.168.x.x:5000";  // Server IP address
```

### ESP32_Door.cpp — Door Controller

Permanently installed at a room door. Controls a relay module to physically lock and unlock the door.

**Additional hardware (beyond Register wiring):**

| Pin | Connection |
|---|---|
| GPIO 26 | Relay IN (LOW = open, HIGH = closed) |

**Operations in `loop()`:**

1. **Every 1 second** — polls `GET /api/door/command?room=EN4401` for commands from the web dashboard
2. **Every 5 minutes** — refreshes the admin whitelist in RAM from `/api/whitelist`
3. **On every card scan** — sends UUID to `/api/send_uuid` for access verification

**Offline Fallback:**

- If the server does not respond, the firmware checks `adminWhitelist[]` stored in RAM (the last successfully loaded whitelist)
- Admin UUIDs in the whitelist can still unlock the door even while the server is offline
- Non-admin users are denied access in offline mode

**Values to update before uploading:**

```cpp
const char *ssid = "YOUR_WIFI_SSID";
const char *password = "YOUR_WIFI_PASSWORD";
const char *apiIPAddress = "http://192.168.x.x:5000";
const char *roomName = "EN4401";  // The room this ESP32 is assigned to
```

---

## 11. Authentication & Role System

The system uses JWT (JSON Web Token) with a 24-hour expiration. Tokens are stored in the browser's `localStorage`.

### Registration

```
POST /api/register
Body: {email, first_name, last_name, password, user_id}

Role is assigned automatically based on email domain:
  @kku.ac.th   → role = "admin"
  @kkumail.com → role = "student" (user_id is required)
  other        → role = "student"
```

### Password Security

Passwords are hashed using bcrypt with 12 rounds. The system supports transparent migration from legacy SHA-256 hashes: when a user with a SHA-256 hash logs in successfully, the password is immediately rehashed to bcrypt without any user action required.

### JWT Payload

```json
{
  "user_id": 1,
  "email": "user@kku.ac.th",
  "role": "admin",
  "exp": 1234567890
}
```

### Token Verification

All protected endpoints require the following request header:

```
Authorization: Bearer <token>
```

Endpoints restricted to admins additionally verify that `email.endswith("@kku.ac.th")`.

---

## 12. Notification System

The notification system delivers alerts through two channels: in-app notifications and email.

### Notification Triggers

| Event | Recipient | Channel |
|---|---|---|
| Admin approves a booking | Student who submitted the booking | In-app + Email |
| Admin rejects a booking | Student who submitted the booking | In-app + Email |
| RFID scan denied | All admin users | In-app only |
| Booking reminder (30 minutes before) | Student who submitted the booking | In-app + Email |

### Email Reminder Scheduler

A reminder scheduler runs as a background thread and checks every 5 minutes:

```python
# Conditions for sending a reminder
booking.status = 'approved'
AND booking date = today
AND (start_time - current time) is between 0 and 35 minutes
AND reminder has not been sent yet for this booking
```

---

## 13. Room Booking System

### Submitting a Booking

Students send `POST /api/bookings` with the following body:

```json
{
  "room": "4101",
  "date": "2025-06-15",
  "start_time": "09:00",
  "end_time": "12:00",
  "detail": "Project meeting"
}
```

The system immediately checks for time overlap. If the requested time slot is already taken by an approved booking, the request is rejected.

### Booking Status Flow

```
pending → approved by admin → approved
pending → rejected by admin → rejected
```

### RFID Access Check for Students

When a student scans their RFID card at the door, the backend runs the following query:

```python
SELECT COUNT(*) FROM bookings
WHERE user_email = ?      # email linked to the RFID card
  AND room = ?            # room assigned to this ESP32
  AND date = TODAY        # today only
  AND status = 'approved' # must be approved
  AND start_time <= NOW   # booking has started
  AND end_time > NOW      # booking has not ended
```

If a matching record is found, the result is `granted` (door opens). Otherwise the result is `denied`.

---

## 14. Access Control Logic

Summary of all door open/close decision cases:

| UUID Found | Role | Source | Result |
|---|---|---|---|
| Not found in `users_reg` | — | door | denied (403) |
| Found | admin | door | granted always (200) |
| Found | student | door | Checked against current booking for this room and time |
| Found or not found | any | register | granted always (booking not checked) |

Admin remote door control from Dashboard:

```
POST /api/door/open {room} → command stored in memory
ESP32 polls /api/door/command?room=X every 1 second → receives "open"
ESP32 activates relay → command is cleared (one-shot, TTL 10 seconds)
```

---

## 15. Real-time Events (SocketIO)

The backend emits a SocketIO event every time an ESP32 scans a card. The React frontend subscribes using `socket.io-client`.

### Event: `uuid_update`

```json
{
  "uuid": "A1B2C3D4",
  "user_id": "653040120-7",
  "first_name": "John",
  "last_name": "Doe",
  "email": "user@kkumail.com",
  "role": "student",
  "room": "EN4401",
  "result": "granted",
  "source": "door"
}
```

The Admin Dashboard receives this event and updates the display in real-time without requiring a page refresh.

### Connecting to SocketIO in React

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000');
socket.on('uuid_update', (data) => {
  // Update state to reflect the latest scan on the dashboard
});
```

---

## 16. Troubleshooting

| Symptom | Cause | Resolution |
|---|---|---|
| `ModuleNotFoundError: No module named 'flask'` | Python dependencies not installed | Run `pip install -r requirements.txt` inside the `backend/` folder |
| `ECONNREFUSED` from React to `/api` | Flask backend is not running | Open a separate terminal and run `python app.py` |
| ESP32 fails to send HTTP requests | `apiIPAddress` is incorrect or on a different network | Verify the server IP address and WiFi SSID/password in the firmware |
| RFID card scans but door does not open | UUID has not been registered in `users_reg` | Register the card via the Admin Dashboard first |
| Student scan returns denied despite having a booking | Booking is still `pending` or current time is outside the booking window | Have an admin approve the booking and verify that the current time falls within the booked slot |
| SocketIO events are not received in real-time | CORS or proxy misconfiguration | Check that `setupProxy.js` forwards `/socket.io` to port 5000 |
| Login succeeds but user is redirected to the wrong page | Email domain does not match expected values | `@kku.ac.th` goes to the admin dashboard; `@kkumail.com` goes to room booking |
| Docker: `db-data` volume appears empty | Incorrect bind mount path in Dockerfile | Verify that `DATABASE_PATH=/app/data/database.db` is set in `docker-compose.yml` |
| `422 Unprocessable Entity` from `/api/bookings` | Date or time format is invalid | Use `YYYY-MM-DD` for dates and `HH:MM` for times |
| Email notifications are not sent | `MAIL_*` environment variables are not configured | Add the values to `.env` and restart the backend |
| ESP32 whitelist is empty after boot | Server was not ready when the board powered on | ESP32 automatically retries loading `/api/whitelist` every 30 seconds until it succeeds |

---

## 17. Dependencies

### Python — `backend/requirements.txt`

| Package | Version | Purpose |
|---|---|---|
| `Flask` | 3.1.2 | Core web framework |
| `flask-restx` | 1.3.2 | REST API extension |
| `Flask-SocketIO` | 5.5.1 | WebSocket real-time communication |
| `Flask-CORS` | 4.0.0 | Cross-origin resource sharing for the React frontend |
| `PyJWT` | 2.8.0 | JWT token creation and verification |
| `bcrypt` | 4.1.3 | Secure password hashing |
| `Flask-Mail` | 0.10.0 | Email notification delivery |
| `python-dotenv` | 1.0.0 | Loads `.env` configuration into environment variables |
| `python-socketio` | 5.13.0 | Socket.IO server implementation |
| `python-engineio` | 4.12.1 | Engine.IO transport layer |
| `Werkzeug` | 3.1.5 | WSGI utility library |

### JavaScript — `package.json`

| Package | Version | Purpose |
|---|---|---|
| `react` | 18.2.0 | UI framework |
| `react-dom` | 18.2.0 | React DOM renderer |
| `react-scripts` | 5.0.1 | Create React App build toolchain |
| `socket.io-client` | 4.7.2 | WebSocket client for real-time updates |
| `http-proxy-middleware` | 2.0.6 | Proxies `/api` and `/socket.io` requests during development |

### Docker Images

| Image | Stage | Purpose |
|---|---|---|
| `python:3.11-slim` | backend | Runs the Flask server |
| `node:18-alpine` | frontend build | Builds the React application |
| `nginx:alpine` | frontend serve | Serves the static React build |

---

*RFID Room Monitoring & Booking System — KKU Engineering Faculty*