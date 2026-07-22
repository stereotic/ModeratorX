# Деплой X Comment Moderator на VPS (Beget)

## Требования

- VPS с Ubuntu 22.04+
- Домен/поддомен с SSL-сертификатом (для X OAuth callback)
- Доступ по SSH

## 1. Подготовка VPS

```bash
# Обновление пакетов
sudo apt update && sudo apt upgrade -y

# Установка Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # должно быть v22.x

# Установка PostgreSQL
sudo apt install -y postgresql postgresql-client
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Установка Redis
sudo apt install -y redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Установка PM2 (процесс-менеджер)
sudo npm install -g pm2

# Установка Git
sudo apt install -y git

# Установка Nginx (если ещё нет)
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## 2. Настройка PostgreSQL

```bash
# Вход в psql
sudo -u postgres psql
```

Выполнить в psql:
```sql
CREATE DATABASE x_moderator;
ALTER USER postgres PASSWORD 'your-password-here';
\q
```

Проверить подключение:
```bash
psql -d x_moderator -U postgres -h localhost
# Пароль: your-password-here
```

## 3. Клонирование проекта

```bash
cd /opt
sudo git clone https://github.com/stereotic/ModeratorX.git x-moderator
sudo chown -R $USER:$USER x-moderator
cd x-moderator
```

## 4. Настройка .env

```bash
cp .env .env.production
nano .env.production
```

Изменить для прода:

```env
NODE_ENV=production
LOG_LEVEL=info
PROCESS_ROLE=all

HTTP_HOST=0.0.0.0
HTTP_PORT=3000

# Telegram токен (уже есть)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# Twitter/X — те же
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret

# ⚠️ Callback URL — замени на свой домен
TWITTER_CALLBACK_URL=https://bot.crystalcards.store/auth/twitter/callback

# OpenAI / OpenRouter
OPENAI_API_KEY=your-openrouter-api-key
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=openai/gpt-4o-mini
OPENAI_MAX_CONCURRENCY=5

# ⚠️ PostgreSQL — замени localhost, если база не на этом сервере
DATABASE_URL=postgresql://postgres:your-password@localhost:5432/x_moderator

# Redis (локальный — без пароля)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

OAUTH_STATE_TTL_SECONDS=600
TOKEN_REFRESH_SKEW_SECONDS=300

# ⚠️ ENCRYPTION KEY — сохрани этот ключ! Без него не расшифровать X токены
ENCRYPTION_KEY=your-encryption-key

DEFAULT_CHECK_INTERVAL=60
MIN_CHECK_INTERVAL=30
MAX_CHECK_INTERVAL=600
MAX_MONITORED_TWEETS_PER_ACCOUNT=20
MAX_TWITTER_ACCOUNTS_PER_USER=5
DEFAULT_CONFIDENCE_THRESHOLD=0.75
```

> **Важно:** `ENCRYPTION_KEY` — единственный способ расшифровать access-токены X. Если потеряешь — пользователям придётся переподключать аккаунты. Сохрани его в password manager.

## 5. Установка зависимостей и сборка

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

## 6. Настройка Nginx + SSL

Создать конфиг:

```bash
sudo nano /etc/nginx/sites-available/x-moderator
```

```nginx
server {
    listen 80;
    server_name bot.crystalcards.store;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Включить сайт и получить SSL:

```bash
sudo ln -s /etc/nginx/sites-available/x-moderator /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Установка certbot для Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bot.crystalcards.store
```

## 7. Запуск через PM2

```bash
# Загрузить .env.production в окружение
ENV_PATH=/opt/x-moderator/.env.production pm2 start /opt/x-moderator/dist/main.js --name x-moderator

# Сохранить список процессов
pm2 save
pm2 startup
```

PM2 сам перезапустит бота при падении или перезагрузке сервера.

Полезные команды:

```bash
pm2 logs x-moderator       # смотреть логи
pm2 restart x-moderator    # перезапуск
pm2 stop x-moderator       # остановка
pm2 status                 # статус всех процессов
```

## 8. Обновление callback URL в X Developer Portal

1. Зайди в [X Developer Portal](https://developer.twitter.com/en/portal)
2. Выбери своё приложение
3. В разделе **User authentication settings**:
   - Redirect URL: `https://bot.crystalcards.store/auth/twitter/callback`
   - Website URL: `https://bot.crystalcards.store`
4. Сохрани

## 9. Перенос данных (опционально)

Если на VPS чистая БД, пользователям нужно переподключить X аккаунты. Чтобы перенести существующие данные с локалки:

```bash
# На локальной машине: дамп
pg_dump -U postgres -d x_moderator -F c > backup.dump

# На VPS: восстановление
pg_restore -U postgres -d x_moderator -F c backup.dump
```

## 10. Проверка

1. Открой браузер: `https://bot.crystalcards.store/health` — должен вернуть `{"status":"ok"}`
2. В Telegram: напиши `/start` своему боту
3. Подключи X аккаунт через OAuth

## Структура .env.production (шаблон)

```
NODE_ENV=production
LOG_LEVEL=info
PROCESS_ROLE=all
HTTP_HOST=0.0.0.0
HTTP_PORT=3000
TELEGRAM_BOT_TOKEN=...
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
TWITTER_CALLBACK_URL=https://bot.crystalcards.store/auth/twitter/callback
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=openai/gpt-4o-mini
OPENAI_MAX_CONCURRENCY=5
DATABASE_URL=postgresql://postgres:...@localhost:5432/x_moderator
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
OAUTH_STATE_TTL_SECONDS=600
TOKEN_REFRESH_SKEW_SECONDS=300
ENCRYPTION_KEY=...
DEFAULT_CHECK_INTERVAL=60
MIN_CHECK_INTERVAL=30
MAX_CHECK_INTERVAL=600
MAX_MONITORED_TWEETS_PER_ACCOUNT=20
MAX_TWITTER_ACCOUNTS_PER_USER=5
DEFAULT_CONFIDENCE_THRESHOLD=0.75
```

## Команды одной строкой (для быстрой настройки)

```bash
# После чистой Ubuntu:
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs postgresql redis-server nginx git certbot python3-certbot-nginx
npm install -g pm2
systemctl start postgresql redis-server nginx
systemctl enable postgresql redis-server nginx
```

```bash
# Клонирование и сборка:
cd /opt
git clone <URL> x-moderator
cd x-moderator
npm ci
npx prisma generate && npx prisma migrate deploy
npm run build
```

```bash
# Запуск:
pm2 start dist/main.js --name x-moderator
pm2 save && pm2 startup
```

## Важно

- **ENCRYPTION KEY** — храни в надёжном месте. Без него все X токены не расшифровать
- **HTTP_PORT 3000** не должен быть открыт снаружи — Nginx проксирует на него локально
- **Redis** без пароля — только если на локальном интерфейсе (127.0.0.1). Если Redis на отдельном сервере — настрой пароль
- **Не используй `tsx` на проде** — собирай через `npm run build` и запускай `node dist/main.js`

