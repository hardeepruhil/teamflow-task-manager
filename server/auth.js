import jwt from "jsonwebtoken";
import { db, rowToPublicUser } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.id);
    if (!user) return res.status(401).json({ message: "Invalid session." });
    req.user = rowToPublicUser(user);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session." });
  }
}

export function requireGlobalAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  return next();
}

export function getProjectRole(projectId, userId) {
  const row = db
    .prepare("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?")
    .get(projectId, userId);
  return row?.role || null;
}

export function requireProjectMember(req, res, next) {
  const projectId = Number(req.params.projectId || req.body.project_id);
  if (!Number.isInteger(projectId)) {
    return res.status(400).json({ message: "Valid project id is required." });
  }

  const role = getProjectRole(projectId, req.user.id);
  if (!role && req.user.role !== "admin") {
    return res.status(403).json({ message: "You are not a member of this project." });
  }

  req.projectRole = role || "admin";
  req.projectId = projectId;
  return next();
}

export function requireProjectAdmin(req, res, next) {
  const projectId = Number(req.params.projectId || req.body.project_id);
  const role = getProjectRole(projectId, req.user.id);
  if (req.user.role !== "admin" && role !== "admin") {
    return res.status(403).json({ message: "Project admin access required." });
  }
  req.projectRole = role || "admin";
  req.projectId = projectId;
  return next();
}
