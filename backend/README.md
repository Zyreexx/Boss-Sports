# Boss Pickleball Arena — Python Backend

Full-stack production backend powered by **Django REST Framework**, **PostgreSQL**, **Redis**, and **Celery**.

---

## ⚡ Tech Stack Architecture

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Framework** | **Django 6 + DRF** | REST APIs, authentication, custom user model, and Django Admin panel |
| **Database** | **PostgreSQL** (with SQLite fallback) | Production ACID database for courts, bookings, and players |
| **Task Queue** | **Celery** | Asynchronous booking confirmation dispatch, periodic task scheduling |
| **Broker & Cache** | **Redis** | High-performance message broker for Celery and in-memory cache |

---

## 🚀 Running with Docker Compose (Recommended)

Start the entire stack (PostgreSQL, Redis, Django API, Celery Worker, Celery Beat scheduler) with a single command:

```bash
docker compose up --build
```

The services will start automatically:
- **API Server & Admin:** `http://localhost:8000`
- **Django Admin Panel:** `http://localhost:8000/admin`
- **PostgreSQL:** Port `5432`
- **Redis:** Port `6379`
- **Celery Worker:** Listens to async queues
- **Celery Beat:** Runs auto-cancellation of unpaid slots every 5 minutes

---

## 💻 Running Locally (Without Docker)

### 1. Activate the Virtual Environment
```bash
# On Windows PowerShell
cd backend
.\venv\Scripts\activate

# On Mac/Linux
cd backend
source venv/bin/activate
```

### 2. Apply Database Migrations & Seed Default Data
```bash
python manage.py migrate
python seed.py
```

### 3. Start the Django Development Server
```bash
python manage.py runserver 8000
```
Visit `http://localhost:8000/admin` to access the Django Admin.

### 4. Start Celery Worker (In a separate terminal)
```bash
celery -A boss_backend worker -l info -P solo
```

### 5. Start Celery Beat Scheduler (In a separate terminal)
```bash
celery -A boss_backend beat -l info
```

---

## 🔑 Demo Login Credentials

The `seed.py` script automatically creates:

1. **Owner (Admin):**
   - Username: `owner` (or Email: `owner@boss.com` / Phone: `9999999999`)
   - Password: `BossOwner@2026`
   - Access: Django Admin (`http://localhost:8000/admin`) & Owner Dashboard

2. **Staff (Front Desk):**
   - Username: `staff` (or Email: `staff@boss.com` / Phone: `8888888888`)
   - Password: `BossStaff@2026`
   - Access: Front Desk booking counter & Gallery manager

3. **Player (Customer):**
   - Username: `player` (or Email: `player@boss.com` / Phone: `9876543210`)
   - Password: `BossPlayer@2026`
   - Access: Player profile & court booking

---

## 📡 REST API Endpoints

- `GET /api/courts/` — List active courts (Court 1, 2, 3 at ₹400/hr)
- `POST /api/courts/` — Add new court (Owner / Staff only)
- `GET /api/bookings/?date=YYYY-MM-DD` — Query reserved slots
- `POST /api/bookings/` — Book court slot (triggers Celery confirmation task)
- `GET /api/gallery/` — List photos and video loops
- `POST /api/gallery/` — Add or replace gallery media (Owner / Staff only)
- `POST /api/auth/login/` — Authenticate via email, phone, or username
- `GET /api/reports/today/` — Arena revenue and occupancy summary
