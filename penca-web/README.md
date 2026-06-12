# 🏆 Penca del Mundial 2026 – Web App

Aplicación web full-stack para gestionar una penca del Mundial 2026 (Estados Unidos, México y Canadá).

- **Frontend**: React 18 + Vite + React Router
- **Backend**: FastAPI + SQLAlchemy 2 + JWT auth
- **DB**: PostgreSQL 16
- **Orquestación**: Docker Compose

## 🚀 Levantar el proyecto (recomendado: Docker)

Requisitos: Docker + Docker Compose.

```bash
docker compose up --build
```

Eso levanta:
- **Frontend** → http://localhost:5173
- **Backend** (API + Swagger) → http://localhost:8000/docs
- **PostgreSQL** → localhost:5432 (user/pass/db: `penca` / `penca` / `penca`)

La primera vez se crean las tablas y el usuario admin. Los **104 partidos del Mundial 2026 se descargan automáticamente de internet** (fixturedownload.com) al iniciar el backend y se actualizan cada 15 minutos (configurable con la variable de entorno `MATCH_SYNC_INTERVAL`, en segundos). Los resultados oficiales se cargan solos a medida que se juegan los partidos.

### Usuarios de prueba

| Usuario | Contraseña  | Rol     |
|---------|-------------|---------|
| admin   | admin123    | Admin   |

> El admin puede cargar resultados oficiales desde la pantalla **Pronósticos** (botón "⚙️ Cargar resultados").

## 📁 Estructura

```
penca-web/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI app + sync automático de partidos
│       ├── fixtures.py          # Descarga de partidos del Mundial 2026
│       ├── database.py          # SQLAlchemy engine
│       ├── models.py            # User, Match, Prediction
│       ├── schemas.py           # Pydantic
│       ├── auth.py              # JWT + bcrypt
│       ├── scoring.py           # Lógica de puntaje (5/3/1/0)
│       └── routers/
│           ├── auth_router.py   # /auth/register, /auth/login, /auth/me
│           ├── matches.py       # CRUD de partidos + carga de resultado
│           ├── predictions.py   # Pronósticos del usuario + historial
│           └── ranking.py       # Ranking global
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx              # Rutas y navbar
        ├── auth.jsx             # Contexto de auth
        ├── api.js               # Axios + token JWT
        ├── styles.css
        └── pages/
            ├── Login.jsx
            ├── Register.jsx
            ├── Dashboard.jsx    # KPIs + podio + partidos
            ├── Predict.jsx      # Cargar pronósticos
            ├── Ranking.jsx      # Tabla de posiciones
            └── History.jsx      # Historial por usuario
```

## 🎯 Sistema de puntaje

- **5 puntos** – Resultado exacto (goles locales y visitantes idénticos)
- **3 puntos** – Ganador correcto + diferencia exacta (ej. apostaste 2-0 y salió 3-1)
- **1 punto** – Solo ganador correcto
- **0 puntos** – Pronóstico incorrecto

Implementado en `backend/app/scoring.py` para que sea fácil de modificar.

## 🔌 Endpoints principales

| Método | Ruta                          | Descripción                       |
|--------|-------------------------------|-----------------------------------|
| POST   | `/auth/register`              | Crear cuenta                      |
| POST   | `/auth/login`                 | Iniciar sesión (devuelve JWT)     |
| GET    | `/auth/me`                    | Usuario actual                    |
| GET    | `/matches`                    | Listar partidos                   |
| POST   | `/matches` *(admin)*          | Crear partido                     |
| PUT    | `/matches/{id}/result` *(admin)* | Cargar resultado oficial       |
| POST   | `/predictions`                | Crear/actualizar mi pronóstico    |
| GET    | `/predictions/me`             | Mis pronósticos + puntos          |
| GET    | `/predictions/history/{uid}`  | Historial de cualquier usuario    |
| GET    | `/ranking`                    | Ranking global                    |

Swagger interactivo en http://localhost:8000/docs

## 🧑‍💻 Desarrollo local sin Docker

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Levantá Postgres aparte y exportá DATABASE_URL
export DATABASE_URL="postgresql+psycopg://penca:penca@localhost:5432/penca"
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔐 Seguridad

- Contraseñas hasheadas con **bcrypt**
- Autenticación con **JWT** (expira a las 24 hs por defecto)
- CORS abierto en desarrollo: ajustá `CORSMiddleware` en `backend/app/main.py` antes de producción
- Cambiá `JWT_SECRET` en `docker-compose.yml` antes de cualquier deploy

## 🛣️ Próximos pasos sugeridos

- Bloquear pronósticos N minutos antes del kick-off (no solo cuando hay resultado)
- Sistema de grupos/ligas privadas
- Notificaciones por email cuando se cargan resultados
- Gráficos de evolución de puntajes con Recharts
- Tests con pytest + Vitest
