# Julow — Full Stack Deployment

Этот каталог содержит docker-compose, который поднимает **полный стек** — frontend (julow-web) + backend (julow_backend) + всю инфраструктуру.

## Раскладка

```
parent-dir/
├── julow-web/              ← репозиторий frontend (этот)
│   └── deploy/
│       ├── docker-compose.yml   ← полный стек
│       ├── .env.example         ← конфигурация
│       └── README.md            ← вы здесь
└── julow_backend/          ← репозиторий backend (parallel-clone)
```

> **Важно:** `julow_backend` должен быть склонирован **рядом** с `julow-web`. Compose ссылается на него через `../../julow_backend`.

## Быстрый старт

```bash
# 1. Клонируем оба репозитория рядом:
git clone https://github.com/vaces8v/julow-web.git
git clone https://github.com/Shizik3535/julow_backend.git

# 2. Переходим в deploy/:
cd julow-web/deploy

# 3. Копируем env:
cp .env.example .env

# 4. (опционально) Заполняем OAuth — без него кнопки Google/GitHub не работают:
$EDITOR .env

# 5. Поднимаем полный стек (на первом запуске тянет ~2GB образов):
docker compose up -d --build

# 6. Ждём health-чеков (~2 минуты — ClamAV качает антивирус-базы):
docker compose ps

# 7. Открываем приложение:
#    Web:           http://localhost:3000
#    Backend API:   http://localhost:8000/docs       (Swagger)
#    MailHog UI:    http://localhost:8025            (просмотр email)
#    MinIO console: http://localhost:9001            (S3 admin)
```

Логи: `docker compose logs -f web backend`. Остановить: `docker compose down`. Стереть данные: `docker compose down -v`.

## Альтернативы

### Только backend (для разработки frontend локально через `npm run dev`)

```bash
cd ../../julow_backend
docker compose up -d
# затем в julow-web (parent dir):
cd ../julow-web
npm install
npm run dev
```

### Только frontend Docker

```bash
cd julow-web
docker build -t julow-web \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1 \
  --build-arg NEXT_PUBLIC_WS_BASE_URL=wss://api.example.com \
  .
docker run -p 3000:3000 julow-web
```

> `NEXT_PUBLIC_*` переменные **должны** передаваться как `--build-arg` — Next.js инлайнит их в client bundle на этапе сборки. Через `-e` в `docker run` они НЕ работают для client-side кода.

## OAuth setup (Google + GitHub)

### Google

1. https://console.cloud.google.com/apis/credentials
2. **Create Credentials → OAuth 2.0 Client ID → Web application**
3. **Authorized redirect URIs** (точное совпадение, без trailing `/`):
   - `http://localhost:3000/oauth/callback` — для разработки
   - `https://app.julow.example.com/oauth/callback` — для production
4. Скопируйте `Client ID` и `Client Secret` в `.env`:
   ```
   OAUTH_GOOGLE_CLIENT_ID=...
   OAUTH_GOOGLE_CLIENT_SECRET=...
   ```

### GitHub

1. https://github.com/settings/developers
2. **New OAuth App**
3. **Authorization callback URL** (одно значение):
   - `http://localhost:3000/oauth/callback`
4. **Generate a new client secret**, скопируйте в `.env`:
   ```
   OAUTH_GITHUB_CLIENT_ID=...
   OAUTH_GITHUB_CLIENT_SECRET=...
   ```

### Архитектура OAuth flow

```
  Browser  ──1.click "Google"──▶  Web BFF
                                     │
                                     │ 2. GET /api/auth/oauth-authorize
                                     ▼
                                  Backend
                                     │ 3. authorize_url
                                     ▼
  Browser ──4. window.location──▶ Google
                                     │ 5. user logs in
                                     ▼
  Browser ◀──6. ?code=...──── /oauth/callback
     │
     │ 7. POST /api/auth/oauth-login { provider, code, redirectUri }
     ▼
  Web BFF ──8. POST /auth/login/oauth──▶ Backend
                                            │ 9. exchange code → token,
                                            │    fetch profile, login/register
                                            ▼
  Web BFF ◀──10. { user, access_token, refresh_token }
     │ 11. setAuthCookies (httpOnly)
     ▼
  Browser → /workspace ✅
```

## Production-чеклист

Перед публичным запуском **обязательно**:

- [ ] `AUTH_JWT_SECRET_KEY` — `python -c "import secrets; print(secrets.token_urlsafe(64))"`
- [ ] `ENCRYPTION_KEY` — `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` (⚠️ потеря = потеря зашифрованных данных)
- [ ] `DB_PASSWORD` — сильный пароль, не `postgres`
- [ ] `MINIO_ROOT_PASSWORD` — сильный пароль, не `minioadmin`
- [ ] `CORS_ALLOWED_ORIGINS` — конкретные origin'ы, без `*`
- [ ] `CLAMAV_ENABLED=true` (включить антивирус для FileStorage)
- [ ] `OAUTH_*_CLIENT_ID/SECRET` — реальные ключи Google/GitHub
- [ ] `SMTP_*` — заменить `mailhog` на реальный SMTP (SES/SendGrid/Mailgun)
- [ ] `PUBLIC_API_BASE_URL` / `PUBLIC_WS_BASE_URL` — публичные HTTPS URL'ы
- [ ] HTTPS terminator перед стеком (nginx / Caddy / cloud LB)
- [ ] Бэкап стратегия для `postgres_data` и `minio_data` volume'ов

## Полезные команды

```bash
# Применить миграции БД (alembic запускается автоматически в entrypoint backend'а):
docker compose exec backend alembic upgrade head

# Создать MinIO bucket вручную (если автоматически не создался):
docker compose exec minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker compose exec minio mc mb local/julow

# Войти в БД:
docker compose exec postgres psql -U postgres julow

# Полная очистка и пересборка:
docker compose down -v
docker compose up -d --build
```
