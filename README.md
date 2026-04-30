# TeamFlow - Team Task Manager

TeamFlow is a full-stack task management web app for teams. It helps users create projects, manage project members, assign tasks, track status, and monitor progress from a dashboard with role-based access control.

## Live Demo

Live app: [https://teamflow-task-manager-production.up.railway.app](https://teamflow-task-manager-production.up.railway.app)

Repository: [https://github.com/hardeepruhil/teamflow-task-manager](https://github.com/hardeepruhil/teamflow-task-manager)

> On a fresh deployment, use **Signup** first. The first registered user automatically becomes an Admin.

## Features

- User signup and login with JWT authentication
- Password hashing with bcrypt
- Project creation and project-level team management
- Admin and Member role-based access control
- Task creation with assignee, priority, status, and due date
- Task board grouped by `To do`, `In progress`, and `Done`
- Dashboard summary for total, in-progress, completed, and overdue tasks
- REST API with validation and proper relational data modeling
- Railway deployment configuration included

## Tech Stack

- **Frontend:** React, Vite, CSS, Lucide React icons
- **Backend:** Node.js, Express.js
- **Database:** SQLite with `better-sqlite3`
- **Authentication:** JWT and bcrypt
- **Validation:** Zod
- **Deployment:** Railway

## Project Structure

```text
teamflow-task-manager/
├── server/
│   ├── auth.js          # JWT auth and role middleware
│   ├── db.js            # SQLite connection and migrations
│   ├── index.js         # Express REST API and static frontend serving
│   ├── seed.js          # Local demo data
│   └── validation.js    # Zod validation schemas
├── src/
│   ├── main.jsx         # React app
│   └── styles.css       # Application styling
├── .env.example
├── .node-version        # Pins Node 20 for deployment
├── nixpacks.toml        # Railway/Nixpacks build configuration
├── railway.json         # Railway deployment command configuration
├── vite.config.js       # Vite config with local API proxy
└── package.json
```

## Local Setup

Clone the repository and install dependencies:

```bash
npm install
```

Create local demo data:

```bash
npm run seed
```

Run the frontend and backend together:

```bash
npm run dev
```

Open the app:

```text
http://localhost:5173
```

Demo accounts after seeding:

```text
Admin:  admin@example.com  / password123
Member: member@example.com / password123
```

## Production Run

Build the React frontend:

```bash
npm run build
```

Start the Express server:

```bash
npm start
```

Open:

```text
http://localhost:8080
```

In production, Express serves both the REST API and the built React frontend.

## Environment Variables

Create a `.env` file locally using `.env.example` as a reference:

```env
PORT=8080
JWT_SECRET=change-me-before-deploying
DATABASE_PATH=./data/team_task_manager.db
```

For Railway, add these service variables:

```text
JWT_SECRET=your-long-secret-key
DATABASE_PATH=./data/team_task_manager.db
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/signup` | Register a new user |
| POST | `/api/auth/login` | Login and receive JWT token |
| GET | `/api/auth/me` | Get current logged-in user |

### Projects and Team

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/projects` | Get projects visible to the user |
| POST | `/api/projects` | Create a new project |
| PUT | `/api/projects/:projectId` | Update project details |
| DELETE | `/api/projects/:projectId` | Delete a project |
| POST | `/api/projects/:projectId/members` | Add or update a project member |
| DELETE | `/api/projects/:projectId/members/:userId` | Remove a project member |

### Tasks and Dashboard

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/tasks` | Create a task |
| PUT | `/api/tasks/:taskId` | Update task details or status |
| DELETE | `/api/tasks/:taskId` | Delete a task |
| GET | `/api/dashboard` | Get task summary and assigned tasks |

## Role-Based Access Control

- The first registered user becomes a global Admin.
- Project creators are added as project Admins.
- Project Admins can update projects, add members, create tasks, assign tasks, and delete tasks.
- Members can view assigned projects and update the status of tasks assigned to them.
- Global Admins can access all projects.

## Railway Deployment

1. Push the project to GitHub.
2. Create a Railway project.
3. Select **Deploy from GitHub repo**.
4. Add the required environment variables:
   - `JWT_SECRET`
   - `DATABASE_PATH`
5. Railway uses Node 20 through `.node-version` and `nixpacks.toml`.
6. The app builds with:

```bash
npm install --include=dev
npm run build
```

7. The app starts with:

```bash
npm start
```

8. Generate a public domain from **Settings > Networking**.

## Database Design

The app uses a relational SQLite database with these main tables:

- `users`
- `projects`
- `project_members`
- `tasks`

Relationships:

- A user can own many projects.
- A project can have many members.
- A task belongs to one project.
- A task can be assigned to one project member.

## Demo Flow

Recommended demo order:

1. Signup or login as Admin.
2. Create a project.
3. Add a member by email.
4. Create a task and assign it to a member.
5. Update task status on the board.
6. Show dashboard counts and overdue tracking.
7. Login as Member to show limited role access.

## Author

Built by Hardeep Singh.
