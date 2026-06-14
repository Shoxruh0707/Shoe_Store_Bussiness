# Shoe Product Entry UI

Product-entry and storefront app for the `shoe_store` database.

Run commands in this directory unless a command says otherwise:

```powershell
cd apps/shoe-store
```

## Structure

```text
backend/              Flask API and database utilities
frontend/             Small static admin UI served by Node
frontend_user/        Next.js customer/admin storefront
images/               Background-removal examples
shoe_store_schema.sql Database schema
shoe_store_seed_data.sql Seed data
remove_bg.py          Standalone background-removal helper
```

## Backend setup

Create `backend/.env` from `backend/.env.example` and fill in your MySQL login:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=shoe_store
PRODUCT_TABLE=product_variant
API_HOST=0.0.0.0
API_PORT=5000
```

Install dependencies:

```powershell
python -m pip install -r backend/requirements.txt
```

Run the backend:

```powershell
python backend/app.py
```

If the database has no tables yet, initialize it from `shoe_store_schema.sql`:

```powershell
python backend/init_schema.py
```

Seed default sizes, shoe types, colours, and materials:

```powershell
python backend/seed_data.py
```

## UI setup

Run the Node UI:

```powershell
npm start
```

Open this on the computer:

```text
http://127.0.0.1:3000
```

Open this on your phone while connected to the same Wi-Fi/LAN:

```text
http://192.168.1.5:3000
```

If your computer IP changes, run:

```powershell
Get-NetIPAddress -AddressFamily IPv4
```

Uploaded product images are saved under:

```text
frontend/public/uploads/products
```

## Run everything

From the repository root on Windows:

```powershell
.\setup.ps1
```

From Git Bash, WSL, or Linux/macOS:

```bash
./setup.sh
```

The scripts start:

```text
Backend API:        http://127.0.0.1:5000
Admin frontend:    http://127.0.0.1:3000
Customer frontend: http://127.0.0.1:3001
```

Use `.\setup.ps1 -SkipInstall` or `SKIP_INSTALL=1 ./setup.sh` when dependencies
are already installed.
