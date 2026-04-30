import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, migrate, rowToPublicUser } from "./db.js";
import {
  getProjectRole,
  requireAuth,
  requireGlobalAdmin,
  requireProjectAdmin,
  requireProjectMember,
  signToken
} from "./auth.js";
import {
  loginSchema,
  memberSchema,
  projectSchema,
  signupSchema,
  taskSchema,
  taskUpdateSchema,
  validate
} from "./validation.js";

migrate();

const app = express();
const PORT = process.env.PORT || 8080;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());

function taskRows(projectId) {
  return db
    .prepare(`
      SELECT tasks.*, users.name AS assignee_name, users.email AS assignee_email
      FROM tasks
      LEFT JOIN users ON users.id = tasks.assignee_id
      WHERE tasks.project_id = ?
      ORDER BY
        CASE tasks.status WHEN 'todo' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END,
        tasks.due_date IS NULL,
        tasks.due_date ASC,
        tasks.created_at DESC
    `)
    .all(projectId);
}

function projectPayload(project, currentUserId) {
  const members = db
    .prepare(`
      SELECT users.id, users.name, users.email, users.role AS global_role, project_members.role
      FROM project_members
      JOIN users ON users.id = project_members.user_id
      WHERE project_members.project_id = ?
      ORDER BY project_members.role, users.name
    `)
    .all(project.id);

  return {
    ...project,
    current_user_role: getProjectRole(project.id, currentUserId),
    members,
    tasks: taskRows(project.id)
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/signup", validate(signupSchema), (req, res) => {
  const { name, email, password, role } = req.validated;
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ message: "Email is already registered." });

  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  const assignedRole = userCount === 0 ? "admin" : role || "member";
  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)")
    .run(name, email, passwordHash, assignedRole);

  const user = rowToPublicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid));
  res.status(201).json({ user, token: signToken(user) });
});

app.post("/api/auth/login", validate(loginSchema), (req, res) => {
  const { email, password } = req.validated;
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const user = rowToPublicUser(row);
  res.json({ user, token: signToken(user) });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/users", requireAuth, (req, res) => {
  const users = db
    .prepare("SELECT id, name, email, role, created_at FROM users ORDER BY name")
    .all();
  res.json({ users });
});

app.get("/api/projects", requireAuth, (req, res) => {
  const projects =
    req.user.role === "admin"
      ? db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all()
      : db
          .prepare(`
            SELECT projects.*
            FROM projects
            JOIN project_members ON project_members.project_id = projects.id
            WHERE project_members.user_id = ?
            ORDER BY projects.created_at DESC
          `)
          .all(req.user.id);

  res.json({ projects: projects.map((project) => projectPayload(project, req.user.id)) });
});

app.post("/api/projects", requireAuth, validate(projectSchema), (req, res) => {
  const { name, description } = req.validated;
  const createProject = db.transaction(() => {
    const result = db
      .prepare("INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)")
      .run(name, description, req.user.id);
    db.prepare("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'admin')")
      .run(result.lastInsertRowid, req.user.id);
    return db.prepare("SELECT * FROM projects WHERE id = ?").get(result.lastInsertRowid);
  });

  const project = createProject();
  res.status(201).json({ project: projectPayload(project, req.user.id) });
});

app.put("/api/projects/:projectId", requireAuth, requireProjectAdmin, validate(projectSchema), (req, res) => {
  const { name, description } = req.validated;
  const result = db
    .prepare("UPDATE projects SET name = ?, description = ? WHERE id = ?")
    .run(name, description, req.projectId);

  if (!result.changes) return res.status(404).json({ message: "Project not found." });
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.projectId);
  res.json({ project: projectPayload(project, req.user.id) });
});

app.delete("/api/projects/:projectId", requireAuth, requireProjectAdmin, (req, res) => {
  db.prepare("DELETE FROM projects WHERE id = ?").run(req.projectId);
  res.status(204).send();
});

app.post("/api/projects/:projectId/members", requireAuth, requireProjectAdmin, validate(memberSchema), (req, res) => {
  const { email, role } = req.validated;
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (!user) return res.status(404).json({ message: "No user found with that email." });

  db.prepare(`
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (?, ?, ?)
    ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role
  `).run(req.projectId, user.id, role);

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.projectId);
  res.json({ project: projectPayload(project, req.user.id) });
});

app.delete("/api/projects/:projectId/members/:userId", requireAuth, requireProjectAdmin, (req, res) => {
  const userId = Number(req.params.userId);
  const project = db.prepare("SELECT owner_id FROM projects WHERE id = ?").get(req.projectId);
  if (project?.owner_id === userId) {
    return res.status(400).json({ message: "Project owner cannot be removed." });
  }

  db.prepare("DELETE FROM project_members WHERE project_id = ? AND user_id = ?").run(req.projectId, userId);
  res.status(204).send();
});

app.post("/api/tasks", requireAuth, validate(taskSchema), requireProjectAdmin, (req, res) => {
  const task = req.validated;

  if (task.assignee_id) {
    const assigneeRole = getProjectRole(task.project_id, task.assignee_id);
    if (!assigneeRole) return res.status(400).json({ message: "Assignee must be a project member." });
  }

  const result = db
    .prepare(`
      INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      task.project_id,
      task.title,
      task.description,
      task.status,
      task.priority,
      task.assignee_id || null,
      task.due_date || null,
      req.user.id
    );

  const created = db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ task: created });
});

app.put("/api/tasks/:taskId", requireAuth, validate(taskUpdateSchema), requireProjectMember, (req, res) => {
  const taskId = Number(req.params.taskId);
  const existing = db.prepare("SELECT * FROM tasks WHERE id = ? AND project_id = ?").get(taskId, req.projectId);
  if (!existing) return res.status(404).json({ message: "Task not found." });

  const isProjectAdmin = req.user.role === "admin" || req.projectRole === "admin";
  const isAssignee = existing.assignee_id === req.user.id;
  if (!isProjectAdmin && !isAssignee) {
    return res.status(403).json({ message: "Only project admins or assignees can update this task." });
  }

  const next = { ...existing, ...req.validated };
  if (!isProjectAdmin) {
    next.title = existing.title;
    next.description = existing.description;
    next.priority = existing.priority;
    next.assignee_id = existing.assignee_id;
    next.due_date = existing.due_date;
  }

  if (next.assignee_id) {
    const assigneeRole = getProjectRole(next.project_id, next.assignee_id);
    if (!assigneeRole) return res.status(400).json({ message: "Assignee must be a project member." });
  }

  db.prepare(`
    UPDATE tasks
    SET title = ?, description = ?, status = ?, priority = ?, assignee_id = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND project_id = ?
  `).run(
    next.title,
    next.description,
    next.status,
    next.priority,
    next.assignee_id || null,
    next.due_date || null,
    taskId,
    req.projectId
  );

  res.json({ task: db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) });
});

app.delete("/api/tasks/:taskId", requireAuth, (req, res) => {
  const taskId = Number(req.params.taskId);
  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);
  if (!existing) return res.status(404).json({ message: "Task not found." });

  const role = getProjectRole(existing.project_id, req.user.id);
  if (req.user.role !== "admin" && role !== "admin") {
    return res.status(403).json({ message: "Project admin access required." });
  }

  db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
  res.status(204).send();
});

app.get("/api/dashboard", requireAuth, (req, res) => {
  const projectFilter =
    req.user.role === "admin"
      ? ""
      : "AND tasks.project_id IN (SELECT project_id FROM project_members WHERE user_id = @userId)";
  const assignedFilter = "AND tasks.assignee_id = @userId";

  const summary = db
    .prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'todo') AS todo,
        SUM(status = 'in_progress') AS in_progress,
        SUM(status = 'done') AS done,
        SUM(status != 'done' AND due_date IS NOT NULL AND date(due_date) < date('now')) AS overdue
      FROM tasks
      WHERE 1 = 1 ${projectFilter}
    `)
    .get({ userId: req.user.id });

  const mine = db
    .prepare(`
      SELECT tasks.*, projects.name AS project_name
      FROM tasks
      JOIN projects ON projects.id = tasks.project_id
      WHERE 1 = 1 ${assignedFilter}
      ORDER BY tasks.due_date IS NULL, tasks.due_date ASC, tasks.updated_at DESC
      LIMIT 8
    `)
    .all({ userId: req.user.id });

  res.json({ summary, mine });
});

const distPath = path.resolve(__dirname, "../dist");
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Team Task Manager running on port ${PORT}`);
});
