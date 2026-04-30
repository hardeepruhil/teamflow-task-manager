# Team Task Manager

A full-stack project and task management app for teams. Users can sign up, log in, create projects, invite teammates by email, assign tasks, update task status, and view dashboard metrics including overdue work.

## Features

- JWT authentication with signup, login, and persistent sessions
- Admin/Member roles at both global and project membership levels
- Project creation and team management
- Task creation, assignment, priority, due date, and status tracking
- Dashboard summary for total, in-progress, completed, and overdue tasks
- REST APIs with Zod validation and relational SQLite data model
- Railway-ready deployment configuration

## Tech Stack

- Frontend: React, Vite, Lucide icons
- Backend: Node.js, Express
- Database: SQLite via `better-sqlite3`
- Auth: bcrypt password hashing and JSON Web Tokens
- Validation: Zod

## Local Setup

```bash
npm install
cp .env.example .env
npm run seed
npm run dev
```

The app runs locally with:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8080`

Seed users:

- Admin: `admin@example.com` / `password123`
- Member: `member@example.com` / `password123`

## API Overview

Authentication:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

Projects and team:

- `GET /api/projects`
- `POST /api/projects`
- `PUT /api/projects/:projectId`
- `DELETE /api/projects/:projectId`
- `POST /api/projects/:projectId/members`
- `DELETE /api/projects/:projectId/members/:userId`

Tasks and dashboard:

- `POST /api/tasks`
- `PUT /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
- `GET /api/dashboard`

## Role Rules

- The first registered user becomes an Admin automatically.
- Project creators are project admins.
- Project admins can update project details, add/remove members, and create/delete tasks.
- Members can view their projects and update status on tasks assigned to them.
- Global admins can access all projects.

## Railway Deployment

1. Push this repository to GitHub.
2. Create a new Railway project and choose **Deploy from GitHub repo**.
3. Add environment variables:
   - `JWT_SECRET`: a long random secret
   - `DATABASE_PATH`: `./data/team_task_manager.db`
4. Railway will use `railway.json`:
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
5. Open the Railway generated domain and create the first account. That account becomes the Admin.
