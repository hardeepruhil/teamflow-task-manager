import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, migrate } from "./db.js";

migrate();

const passwordHash = bcrypt.hashSync("password123", 10);
const insertUser = db.prepare(`
  INSERT INTO users (name, email, password_hash, role)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(email) DO NOTHING
`);

insertUser.run("Asha Admin", "admin@example.com", passwordHash, "admin");
insertUser.run("Mohan Member", "member@example.com", passwordHash, "member");

const admin = db.prepare("SELECT * FROM users WHERE email = ?").get("admin@example.com");
const member = db.prepare("SELECT * FROM users WHERE email = ?").get("member@example.com");

let project = db.prepare("SELECT * FROM projects WHERE name = ?").get("Launch Website");
if (!project) {
  const result = db
    .prepare("INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)")
    .run("Launch Website", "Coordinate design, content, and release tasks.", admin.id);
  project = db.prepare("SELECT * FROM projects WHERE id = ?").get(result.lastInsertRowid);
}

db.prepare("INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)")
  .run(project.id, admin.id, "admin");
db.prepare("INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)")
  .run(project.id, member.id, "member");

const taskCount = db.prepare("SELECT COUNT(*) AS count FROM tasks WHERE project_id = ?").get(project.id).count;
if (taskCount === 0) {
  const insertTask = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, due_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertTask.run(project.id, "Finalize homepage copy", "Review content for the product launch page.", "in_progress", "high", member.id, "2026-05-03", admin.id);
  insertTask.run(project.id, "QA signup flow", "Test validation and error states before launch.", "todo", "medium", admin.id, "2026-05-05", admin.id);
  insertTask.run(project.id, "Publish launch checklist", "Share owner, timeline, and rollback details.", "done", "low", member.id, "2026-04-26", admin.id);
}

console.log("Seed complete.");
console.log("Admin: admin@example.com / password123");
console.log("Member: member@example.com / password123");
