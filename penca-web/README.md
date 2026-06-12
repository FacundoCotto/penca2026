# 🏆 Penca del Mundial 2026

Aplicación web de pronósticos (penca) para la Copa Mundial de la FIFA 2026 (Estados Unidos, México y Canadá). Los usuarios se registran, pronostican el resultado de cada partido antes del inicio, y compiten en un ranking según un sistema de puntos. **El fixture y los resultados se actualizan de forma 100 % automática** desde un feed deportivo: el administrador nunca carga partidos ni resultados a mano.

---

## Tabla de contenidos

1. [Stack tecnológico](#1-stack-tecnológico)
2. [Arquitectura general](#2-arquitectura-general)
3. [Flujo completo de la aplicación](#3-flujo-completo-de-la-aplicación)
4. [Sincronización automática del fixture](#4-sincronización-automática-del-fixture)
5. [Sistema de puntos](#5-sistema-de-puntos)
6. [Modelo de datos](#6-modelo-de-datos)
7. [API REST — referencia de endpoints](#7-api-rest--referencia-de-endpoints)
8. [Estructura del repositorio y archivos críticos](#8-estructura-del-repositorio-y-archivos-críticos)
9. [Puesta en marcha](#9-puesta-en-marcha)
10. [Variables de entorno](#10-variables-de-entorno)
11. [Changelog — cambios arquitectónicos recientes (v3.0)](#11-changelog--cambios-arquitectónicos-recientes-v30)
12. [Auditoría de código: problemas encontrados y soluciones](#12-auditoría-de-código-problemas-encontrados-y-soluciones)
13. [Deuda técnica conocida / próximos pasos](#13-deuda-técnica-conocida--próximos-pasos)

---

## 1. Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | React + Vite | React 18.3, Vite 5.4 |
| Routing | react-router-dom | 6.27 |
| Cliente HTTP | axios (con interceptores JWT) | 1.7 |
| Backend | FastAPI (Python) | 0.115 |
| ORM | SQLAlchemy 2.0 (estilo `Mapped`/`mapped_column`) | 2.0.35 |
| Base de datos | PostgreSQL | 16 (alpine) |
| Auth | JWT (python-jose) + bcrypt (passlib) | — |
| Infraestructura | Docker Compose (db + backend + frontend) | — |

## 2. Arquitectura general

```
┌─────────────────────┐         ┌──────────────────────────┐
│  Frontend (React)   │  HTTP   │   Backend (FastAPI)      │
│  Vite dev :5173     │ ──────► │   uvicorn :8000          │
│  axios + JWT bearer │         │                          │
└─────────────────────┘         │  ┌────────────────────┐  │
                                │  │ Loop asíncrono de  │  │
┌─────────────────────┐         │  │ sincronización     │  │
│ fixturedownload.com │ ◄────── │  │ (cada 15 min)      │  │
│ feed JSON Mundial   │         │  └────────────────────┘  │
└─────────────────────┘         └───────────┬──────────────┘
                                            │ SQLAlchemy
                                ┌───────────▼──────────────┐
                                │   PostgreSQL 16  :5432   │
                                │  users / matches /       │
                                │  predictions             │
                                └──────────────────────────┘
```

- El **frontend** es una SPA: toda la navegación es client-side y cada página consume la API REST con un token JWT en el header `Authorization`.
- El **backend** expone la API y, además, corre una tarea de fondo (`sync_matches_loop`) que mantiene el fixture y los resultados sincronizados con internet.
- La **base de datos** guarda solo tres entidades: usuarios, partidos y pronósticos.

## 3. Flujo completo de la aplicación

### 3.1 Arranque del backend (`backend/app/main.py`)
1. `lifespan()` crea las tablas (`Base.metadata.create_all`).
2. `seed_initial_data()` crea el usuario `admin` solo si la BD está vacía (contraseña configurable vía `ADMIN_PASSWORD`).
3. Se lanza `sync_matches_loop()`: sincroniza el fixture inmediatamente y luego cada `MATCH_SYNC_INTERVAL` segundos (default: 900 = 15 min).

### 3.2 Registro y login
1. El usuario se registra (`POST /auth/register`) → el backend valida unicidad de username/email, hashea la contraseña con **bcrypt** y devuelve un **JWT** + datos del usuario.
2. El frontend guarda el token en `localStorage`; el interceptor de axios (`frontend/src/api.js`) lo adjunta a cada request. Si la API devuelve 401, el interceptor limpia la sesión y redirige a `/login`.
3. `AuthProvider` (`frontend/src/auth.jsx`) rehidrata la sesión al recargar la página llamando a `GET /auth/me`.

### 3.3 Pronósticos
1. El usuario entra a **Pronósticos** (`/predict`) y carga goles para cualquier partido **que aún no comenzó**.
2. `POST /predictions` hace *upsert*: una sola predicción por (usuario, partido), garantizado por la constraint `uq_user_match`.
3. **Regla de cierre**: el pronóstico se bloquea en el *kickoff* (`match_date`), no cuando llega el resultado. Esto se valida en el backend (fuente de verdad) y se refleja en la UI con el badge "En juego".

### 3.4 Resultados y puntajes
1. El loop de sincronización trae los resultados oficiales del feed y actualiza `home_goals`/`away_goals` de cada partido.
2. Los puntos **no se almacenan**: se calculan al vuelo con `scoring.calculate_points()` cada vez que se consulta el ranking o un historial. Esto evita inconsistencias si un resultado se corrige a posteriori en el feed.

### 3.5 Ranking e historiales
- `GET /ranking` agrega los puntos de todos los usuarios (con *eager loading* para evitar N+1) y ordena por: puntos ↓, aciertos exactos ↓, username ↑.
- Cualquier usuario autenticado puede ver el historial de otro participante (`/history/:userId`) — es una penca entre amigos, la transparencia es parte del juego.

### 3.6 Panel de administración (`/admin`)
- Visible solo para admins (guard en frontend + `require_admin` en backend).
- Muestra la **tabla de todos los usuarios registrados**: rol, fecha de registro, cantidad de pronósticos, aciertos exactos, puntos y última actividad. Soporta búsqueda y ordenamiento por columna.
- Incluye el botón **"Sincronizar fixture ahora"** (`POST /matches/sync`) para adelantar la actualización sin esperar el próximo ciclo de 15 minutos. Es la única acción manual que conserva el admin.

## 4. Sincronización automática del fixture

Archivo: `backend/app/fixtures.py`

- **Fuente**: `https://fixturedownload.com/feed/json/fifa-world-cup-2026` (los 104 partidos del Mundial 2026, con resultados a medida que se juegan).
- `sync_matches()`:
  1. Descarga el feed (timeout 30 s) y valida que sea una lista.
  2. Valida cada item (`_is_valid`): debe traer `MatchNumber`, `RoundNumber`, `DateUtc`, `HomeTeam`, `AwayTeam`. Los items malformados **se omiten y se loguean**, sin abortar la sincronización completa.
  3. Mapea: ronda → fase del torneo (`ROUND_PHASES`), nombres de equipos → español (`TEAM_NAMES_ES`), fechas → UTC naive.
  4. *Upsert* por `external_id` (= `MatchNumber` del feed): crea partidos nuevos y actualiza solo los campos que cambiaron.
  5. Ante cualquier error: `rollback()` + log; el ciclo siguiente reintenta.
- El loop corre con `asyncio.to_thread()` para no bloquear el event loop de FastAPI.

## 5. Sistema de puntos

Archivo: `backend/app/scoring.py`

| Acierto | Puntos |
|---|---|
| Resultado exacto (ej.: pronosticó 2-1, salió 2-1) | **5** |
| Ganador correcto + diferencia de gol exacta (ej.: 2-0 vs 3-1) | **3** |
| Solo el ganador (o el empate, sin el resultado exacto) | **1** |
| Nada | **0** |

Desempate del ranking: 1º puntos totales, 2º aciertos exactos, 3º orden alfabético.

## 6. Modelo de datos

Archivo: `backend/app/models.py`

```
users                      matches                       predictions
─────                      ───────                       ───────────
id (PK)                    id (PK)                       id (PK)
username  UNIQUE           external_id UNIQUE (feed)     user_id  FK → users  (CASCADE)
email     UNIQUE           match_date (UTC naive)        match_id FK → matches (CASCADE)
password_hash (bcrypt)     phase / group_name            home_goals, away_goals
is_admin                   home_team / away_team         created_at, updated_at
created_at                 home_goals, away_goals (NULL  UNIQUE (user_id, match_id)
                             hasta que termina)
                           is_finished (property)
```

- `Match.is_finished` es una *property* Python: `home_goals` y `away_goals` no nulos.
- Borrar un usuario o un partido elimina en cascada sus predicciones.

## 7. API REST — referencia de endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/` | — | Ping de la app |
| GET | `/health` | — | Health check para load balancers/monitoreo |
| POST | `/auth/register` | — | Alta de usuario, devuelve JWT |
| POST | `/auth/login` | — | Login, devuelve JWT |
| GET | `/auth/me` | JWT | Usuario actual |
| GET | `/matches` | — | Lista completa del fixture, ordenada por fecha |
| POST | `/matches/sync` | **Admin** | Fuerza una sincronización inmediata con el feed |
| POST | `/predictions` | JWT | Upsert del pronóstico (rechazado si el partido ya comenzó) |
| GET | `/predictions/me` | JWT | Mis pronósticos + puntos calculados |
| GET | `/predictions/history/{user_id}` | JWT | Historial de cualquier participante |
| GET | `/ranking` | JWT | Tabla de posiciones |
| GET | `/admin/users` | **Admin** | Todos los usuarios con estadísticas de actividad |

> **Eliminados en v3.0** (la gestión de partidos es 100 % automática): `POST /matches`, `PUT /matches/{id}/result`, `DELETE /matches/{id}`.

Documentación interactiva: `http://localhost:8000/docs` (Swagger UI generado por FastAPI).

## 8. Estructura del repositorio y archivos críticos

```
penca-web/
├── docker-compose.yml          # Orquestación: db + backend + frontend
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # ★ App FastAPI, lifespan, CORS, loop de sync, seed admin
│       ├── database.py         # Engine SQLAlchemy, pool, get_db()
│       ├── models.py           # ★ ORM: User, Match, Prediction
│       ├── schemas.py          # Pydantic: validación de entrada/salida
│       ├── auth.py             # ★ JWT, bcrypt, get_current_user, require_admin
│       ├── scoring.py          # ★ calculate_points: regla 5/3/1/0
│       ├── fixtures.py         # ★ Sincronización automática con el feed del Mundial
│       └── routers/
│           ├── auth_router.py  # /auth/*
│           ├── matches.py      # GET /matches + POST /matches/sync
│           ├── predictions.py  # ★ Upsert con cierre al kickoff, historiales
│           ├── ranking.py      # Agregación de puntos (eager loading)
│           └── admin.py        # ★ GET /admin/users (panel de administración)
└── frontend/
    ├── index.html              # Fuente Outfit, theme-color
    ├── vite.config.js
    └── src/
        ├── main.jsx            # Entry: BrowserRouter + AuthProvider
        ├── App.jsx             # ★ Rutas, guard Protected (con adminOnly), Navbar
        ├── auth.jsx            # ★ AuthContext: login/register/logout/rehidratación
        ├── api.js              # ★ Axios + interceptores (JWT, auto-logout en 401)
        ├── styles.css          # ★ Tema "Stadium Night" (design system completo)
        └── pages/
            ├── Login.jsx / Register.jsx
            ├── Dashboard.jsx   # KPIs, podio, resultados recientes, próximos partidos
            ├── Predict.jsx     # ★ Carga de pronósticos (cierra al kickoff)
            ├── Ranking.jsx     # Tabla de posiciones con barras de progreso
            ├── History.jsx     # Historial propio o de terceros
            └── AdminPanel.jsx  # ★ Tabla de usuarios + sync manual del fixture
```

(★ = archivos más importantes para entender el sistema.)

### Funciones críticas

| Función | Archivo | Rol |
|---|---|---|
| `sync_matches()` | `backend/app/fixtures.py` | Corazón de la automatización: descarga, valida y *upsertea* los 104 partidos |
| `calculate_points()` | `backend/app/scoring.py` | Única fuente de verdad del puntaje (usada por ranking, historiales y admin) |
| `get_current_user()` / `require_admin()` | `backend/app/auth.py` | Dependencias de FastAPI que protegen todos los endpoints |
| `upsert_prediction()` | `backend/app/routers/predictions.py` | Valida el cierre al kickoff y garantiza un pronóstico por partido |
| `lifespan()` | `backend/app/main.py` | Bootstrap: tablas, seed, loop de sincronización |
| Interceptores de axios | `frontend/src/api.js` | Inyección del JWT y expulsión automática en 401 |

## 9. Puesta en marcha

### Con Docker (recomendado)

```bash
cd penca-web
docker compose up --build
```

- Frontend: http://localhost:5173
- API + Swagger: http://localhost:8000/docs
- Usuario inicial: `admin` / `admin123` (cambialo con `ADMIN_PASSWORD`)

### Manual (desarrollo)

```bash
# Backend (requiere PostgreSQL local con BD "penca")
cd penca-web/backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd penca-web/frontend
npm install
npm run dev
```

## 10. Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://penca:penca@localhost:5432/penca` | Conexión a PostgreSQL |
| `PENCA_ENV` | `development` | En `production`, el arranque **falla** si `JWT_SECRET` es débil |
| `JWT_SECRET` | `dev-secret` (solo dev) | Generar con `openssl rand -hex 32` para producción |
| `JWT_ALG` | `HS256` | Algoritmo de firma |
| `JWT_EXPIRE_MIN` | `1440` | Vida del token (minutos) |
| `CORS_ORIGINS` | `http://localhost:5173` | Orígenes permitidos, separados por coma |
| `MATCH_SYNC_INTERVAL` | `900` | Frecuencia del sync automático (segundos) |
| `ADMIN_PASSWORD` | `admin123` | Contraseña del admin sembrado en el primer arranque |
| `VITE_API_URL` (frontend) | `http://localhost:8000` | URL base de la API |

## 11. Changelog — cambios arquitectónicos recientes (v3.0)

### Automatización total de partidos
- **Eliminados** los endpoints manuales `POST /matches`, `PUT /matches/{id}/result` y `DELETE /matches/{id}`, junto con los schemas `MatchCreate` y `MatchResult`. El fixture y los resultados provienen exclusivamente del feed automático.
- **Eliminada** la UI de "Cargar resultados (admin)" de la página de pronósticos.
- **Nuevo** `POST /matches/sync` (admin): fuerza una sincronización inmediata sin esperar el ciclo de 15 minutos.
- Endurecida la sincronización: validación por item del feed (los registros corruptos se omiten y loguean en lugar de abortar todo el sync).

### Panel de administración de usuarios
- **Nuevo** endpoint `GET /admin/users` (router `admin.py`): todos los usuarios con rol, fecha de registro, pronósticos, aciertos exactos, puntos y última actividad — resuelto en 3 queries fijas con `selectinload`.
- **Nueva** página `/admin` (solo admins): tabla con búsqueda, ordenamiento por columna, KPIs de la plataforma y botón de sincronización manual.
- Guard `Protected adminOnly` en el router del frontend (la autorización real sigue siendo del backend).

### Rediseño UI/UX — tema "Stadium Night"
- `styles.css` reescrito como design system: fondo nocturno con resplandores de estadio (dorado/verde/cian), tarjetas con *glassmorphism*, navbar sticky con blur, tipografía **Outfit**, pills, badges (incluido "En juego"), barras de progreso y tablas oscuras.
- Páginas de auth, dashboard, pronósticos, ranking e historial alineadas al nuevo tema, con responsive para móvil.

### Correcciones de la auditoría (detalle en la sección 12)
- Cierre de pronósticos al **inicio** del partido (antes se podía pronosticar con el partido en juego).
- Fix del problema **N+1** en ranking e historiales.
- `JWT_SECRET` débil ahora es **error fatal** en producción (`PENCA_ENV=production`).
- CORS configurable por entorno (antes `allow_origins=["*"]`).
- Eliminadas las credenciales demo visibles en la pantalla de login.
- Migración de `@app.on_event` (deprecado) a `lifespan`.
- Endpoint `/health`, pool de conexiones dimensionado, contraseña del admin configurable.

## 12. Auditoría de código: problemas encontrados y soluciones

### Críticos (corregidos en v3.0)

| # | Problema | Ubicación | Solución aplicada |
|---|---|---|---|
| 1 | `JWT_SECRET` con fallback silencioso a `"dev-secret"`: cualquiera podía forjar tokens de admin en un deploy descuidado | `auth.py` | El arranque **lanza `RuntimeError`** si `PENCA_ENV=production` y el secreto es débil; en dev solo advierte por log |
| 2 | CORS `allow_origins=["*"]` con `allow_credentials=True` | `main.py` | Orígenes leídos de `CORS_ORIGINS` (default: solo el frontend local) |
| 3 | Los pronósticos se podían editar **durante el partido** (solo se bloqueaban al cargarse el resultado) | `routers/predictions.py` | Rechazo si `match_date <= now` (UTC); la UI refleja el estado "En juego" |
| 4 | Credenciales demo (`admin / admin123`) impresas en la pantalla de login | `pages/Login.jsx` | Eliminadas; además la contraseña del seed es configurable (`ADMIN_PASSWORD`) |
| 5 | Secreto JWT hardcodeado en `docker-compose.yml` | `docker-compose.yml` | Reemplazado por interpolación de entorno `${JWT_SECRET:-dev-secret}` |

### Rendimiento (corregidos en v3.0)

| # | Problema | Ubicación | Solución aplicada |
|---|---|---|---|
| 6 | **N+1 queries** en el ranking: 1 query por usuario para `predictions` + 1 por predicción para `match` (con 50 usuarios y 100 partidos ≈ miles de queries) | `routers/ranking.py` | `selectinload(User.predictions).selectinload(Prediction.match)` → 3 queries fijas |
| 7 | Mismo lazy-loading en `/predictions/me` y `/predictions/history/{id}` | `routers/predictions.py` | `selectinload(Prediction.match)` |
| 8 | Pool de conexiones sin dimensionar | `database.py` | `pool_size=10, max_overflow=20` |

### Robustez y buenas prácticas (corregidos en v3.0)

| # | Problema | Ubicación | Solución aplicada |
|---|---|---|---|
| 9 | El feed externo se consumía **sin validación**: un item malformado (`KeyError`) abortaba la sincronización completa | `fixtures.py` | Validación por item; los inválidos se omiten con warning; scores leídos con `.get()` |
| 10 | `@app.on_event("startup")` deprecado en FastAPI moderno | `main.py` | Migrado a `lifespan` (context manager), con cancelación de la tarea al apagar |
| 11 | Sin endpoint de salud para monitoreo/load balancers | `main.py` | `GET /health` |
| 12 | Endpoints de administración de partidos duplicaban una responsabilidad que ya tenía el sync automático (dos fuentes de verdad para los resultados) | `routers/matches.py` | Eliminados; el feed es la única fuente de verdad |

### Deuda conocida (documentada, no corregida — ver sección 13)

| # | Problema | Riesgo |
|---|---|---|
| A | JWT en `localStorage` (expuesto ante XSS) | Medio — mitigado porque React escapa el contenido por defecto; la solución completa es cookie `httpOnly` + CSRF token |
| B | Sin rate limiting en `/auth/login` y `/auth/register` | Fuerza bruta / spam de registros (agregar `slowapi`) |
| C | Sin migraciones (se usa `create_all`) | Cambios de schema destructivos a futuro (agregar Alembic) |
| D | Sin tests automatizados | Regresiones invisibles (agregar pytest para `scoring`, `predictions`, `auth`) |
| E | Puntos recalculados en cada request de ranking | Aceptable a esta escala; cachear si crece la base de usuarios |
| F | Fechas UTC naive en BD | Funciona porque todo el sistema asume UTC, pero es frágil; migrar a `timestamptz` |

## 13. Deuda técnica conocida / próximos pasos

1. **Alembic** para versionar el schema antes de cualquier cambio de modelo.
2. **Rate limiting** (`slowapi`) en los endpoints de autenticación.
3. **Tests**: `scoring.calculate_points` es trivial de testear y es el corazón del juego — empezar por ahí.
4. **Cookies httpOnly** para el token si la app se expone públicamente.
5. **Notificaciones** (email/push) cuando se acerca el cierre de un partido sin pronóstico.
6. Cachear el ranking (Redis o columna materializada) si la penca supera los cientos de usuarios.

---

*Proyecto académico/recreativo. Feed de fixture provisto por [fixturedownload.com](https://fixturedownload.com).*
