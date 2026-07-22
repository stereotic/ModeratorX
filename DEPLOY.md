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

# Установка Nginx
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## 2. Настройка PostgreSQL

```bash
sudo -u postgres psql
```

В psql:
```sql
CREATE DATABASE x_moderator;
ALTER USER postgres PASSWORD 'bbbc54e8bb3fdb14611f9349aa1e27d2';
\q
```

Проверка:
```bash
psql -d x_moderator -U postgres -h localhost
# Пароль: bbbc54e8bb3fdb14611f9349aa1e27d2
```

## 3. Клонирование

```bash
cd /opt
sudo git clone https://github.com/stereotic/ModeratorX.git x-moderator
sudo chown -R $USER:$USER x-moderator
cd x-moderator
```

## 4. .env.production

```bash
cp .env .env.production
nano .env.production
```

Поменять для прода:

```env
NODE_ENV=production
LOG_LEVEL=info
PROCESS_ROLE=all

HTTP_HOST=0.0.0.0
HTTP_PORT=3000

TELEGRAM_BOT_TOKEN=8311563650:AAFjIBfFvgkHyXj9YU-z9q0puX4KsaxdGIs

TWITTER_CLIENT_ID=OTU3M0RDQl9mc2MyaVJ5SloyM3c6MTpjaQ
TWITTER_CLIENT_SECRET=NcLJrmei7RFM1P7sgVQFH-dx6ISh05gDUIMWIgkzExlcx2MM5e
TWITTER_CALLBACK_URL=https://bot.crystalcards.store/auth/twitter/callback

OPENAI_API_KEY=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
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=openai/gpt-4o-mini
OPENAI_MAX_CONCURRENCY=5

DATABASE_URL=postgresql://postgres:bbbc54e8bb3fdb14611f9349aa1e27d2@localhost:5432/x_moderator

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

OAUTH_STATE_TTL_SECONDS=600
TOKEN_REFRESH_SKEW_SECONDS=300

ENCRYPTION_KEY=5e04fec8f477ba0d197e7c07153a616d09fc1d2929162b9be9a281c028fa5dfd

DEFAULT_CHECK_INTERVAL=60
MIN_CHECK_INTERVAL=30
MAX_CHECK_INTERVAL=600
MAX_MONITORED_TWEETS_PER_ACCOUNT=20
MAX_TWITTER_ACCOUNTS_PER_USER=5
DEFAULT_CONFIDENCE_THRESHOLD=0.75
```

> **ENCRYPTION_KEY** — храни в password manager. Без него X токены не расшифровать.

## 5. Сборка

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

## 6. Nginx + SSL

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

```bash
sudo ln -s /etc/nginx/sites-available/x-moderator /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bot.crystalcards.store
```

## 7. Запуск PM2

```bash
ENV_PATH=/opt/x-moderator/.env.production pm2 start /opt/x-moderator/dist/main.js --name x-moderator
pm2 save
pm2 startup
```

Команды:
```bash
pm2 logs x-moderator       # логи
pm2 restart x-moderator    # перезапуск
pm2 stop x-moderator       # остановка
pm2 status                 # статус
```

## 8. X Developer Portal

1. [X Developer Portal](https://developer.twitter.com/en/portal)
2. Выбери приложение
3. **User authentication settings**:
   - Redirect URL: `https://bot.crystalcards.store/auth/twitter/callback`
   - Website URL: `https://bot.crystalcards.store`
4. Сохрани

## 9. Проверка

1. `https://bot.crystalcards.store/health` → `{"status":"ok"}`
2. Telegram: `/start` боту
3. Подключи X аккаунт
