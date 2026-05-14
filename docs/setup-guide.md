# 🛠 Technical Setup & Credentials

This guide will walk you through the process of setting up MergeShip locally. Please follow these steps carefully to ensure your development environment is correctly configured.

---

## 📋 Prerequisites
Ensure you have the following installed on your machine:
* **Node.js**: v18 or higher.
* **Package Manager**: npm, yarn, or pnpm.
* **Database**: A local PostgreSQL instance or a Supabase project.

---

## 🔐 Credentials & Environment Variables
MergeShip relies on environment variables for authentication and database connectivity.

### 1. Create your Environment File
In the root directory of the project, create a new file named `.env` by copying the example file:
```bash
cp .env.example .env
```

### 2. Configure Variables
Open the `.env` file and fill in the following credentials:

* **`DATABASE_URL`**: Your PostgreSQL connection string (e.g., `postgresql://user:password@localhost:5432/mergeship`).
* **`NEXTAUTH_SECRET`**: A random string used to hash tokens. You can generate one using `openssl rand -base64 32`.
* **`NEXTAUTH_URL`**: Set this to `http://localhost:3000` for local development.
* **`GITHUB_ID` & `GITHUB_SECRET`**: Create a "New OAuth App" in your GitHub Developer Settings. Set the Callback URL to `http://localhost:3000/api/auth/callback/github`.

> **⚠️ Security Note**: Never commit your `.env` file to GitHub. It is listed in `.gitignore` to prevent leaking your private credentials.

---

## 🚀 Local Installation Steps

### 1. Clone the Repository
```bash
git clone [https://github.com/Coder-s-OG-s/MergeShip.git](https://github.com/Coder-s-OG-s/MergeShip.git)
cd MergeShip
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Sync Database Schema
We use Prisma ORM to manage our database. Run the following command to sync the schema with your local database:
```bash
npx prisma db push
```

### 4. Run the Development Server
```bash
npm run dev
```
The application should now be running at [http://localhost:3000](http://localhost:3000).

---

## 🤝 Troubleshooting
* **OAuth Login Fails**: Check if your `GITHUB_ID` and `GITHUB_SECRET` are correct and the callback URL matches exactly.
* **Prisma Errors**: Ensure your `DATABASE_URL` is accessible and the PostgreSQL service is running.

---
[← Back to Contributing Guidelines](../CONTRIBUTING.md)
