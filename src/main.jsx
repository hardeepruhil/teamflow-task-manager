import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  LogOut,
  Plus,
  Shield,
  UserPlus,
  Users
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "";
const statuses = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done"
};

function api(path, options = {}) {
  const token = localStorage.getItem("ttm_token");
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  }).then(async (response) => {
    if (response.status === 204) return null;
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("API server is not responding. Start the backend with npm run dev:server or use npm run dev.");
    }
    if (!response.ok) throw new Error(data.message || "Something went wrong.");
    return data;
  });
}

function formatDate(value) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function isOverdue(task) {
  if (!task.due_date || task.status === "done") return false;
  return new Date(`${task.due_date}T23:59:59`) < new Date();
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "member" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body = mode === "login"
        ? { email: form.email, password: form.password }
        : form;
      const data = await api(path, { method: "POST", body: JSON.stringify(body) });
      localStorage.setItem("ttm_token", data.token);
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <div className="brand-mark">
          <FolderKanban size={30} />
        </div>
        <h1>Team Task Manager</h1>
        <p>Run projects, assign ownership, and keep delivery visible across the team.</p>
        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Signup</button>
        </div>
        <form onSubmit={submit} className="stack">
          {mode === "signup" && (
            <label>
              Name
              <input required minLength="2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
          )}
          <label>
            Email
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            Password
            <input required type="password" minLength="6" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          {mode === "signup" && (
            <label>
              Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          )}
          {error && <div className="error">{error}</div>}
          <button className="primary" disabled={loading}>{loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}</button>
        </form>
      </section>
    </main>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="stat-card">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value || 0}</strong>
    </div>
  );
}

function Dashboard({ dashboard }) {
  const summary = dashboard?.summary || {};
  return (
    <section className="dashboard">
      <div className="stats">
        <StatCard icon={ClipboardList} label="Total tasks" value={summary.total} />
        <StatCard icon={BarChart3} label="In progress" value={summary.in_progress} />
        <StatCard icon={CalendarClock} label="Overdue" value={summary.overdue} />
        <StatCard icon={CheckCircle2} label="Done" value={summary.done} />
      </div>
      <div className="panel">
        <div className="panel-title">
          <h2>My Tasks</h2>
        </div>
        <div className="task-list compact">
          {(dashboard?.mine || []).map((task) => (
            <div key={task.id} className="task-row">
              <span className={`status-dot ${task.status}`} />
              <div>
                <strong>{task.title}</strong>
                <small>{task.project_name} · {formatDate(task.due_date)}</small>
              </div>
              <span className={`pill ${task.priority}`}>{task.priority}</span>
            </div>
          ))}
          {!dashboard?.mine?.length && <p className="muted">No assigned tasks yet.</p>}
        </div>
      </div>
    </section>
  );
}

function ProjectForm({ onCreate }) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await onCreate(form);
      setForm({ name: "", description: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="panel form-grid" onSubmit={submit}>
      <div className="panel-title">
        <h2>New Project</h2>
        <Plus size={18} />
      </div>
      <label>
        Project name
        <input required minLength="2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <label>
        Description
        <textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </label>
      {error && <div className="error">{error}</div>}
      <button className="primary">Create project</button>
    </form>
  );
}

function TeamManager({ project, onAddMember, onRemoveMember }) {
  const [form, setForm] = useState({ email: "", role: "member" });
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await onAddMember(project.id, form);
      setForm({ email: "", role: "member" });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">
        <h2>Team</h2>
        <Users size={18} />
      </div>
      <div className="member-list">
        {project.members.map((member) => (
          <div className="member-row" key={member.id}>
            <div>
              <strong>{member.name}</strong>
              <small>{member.email}</small>
            </div>
            <span className="role-chip"><Shield size={13} />{member.role}</span>
            {project.owner_id !== member.id && (
              <button className="ghost danger" onClick={() => onRemoveMember(project.id, member.id)}>Remove</button>
            )}
          </div>
        ))}
      </div>
      <form className="inline-form" onSubmit={submit}>
        <input type="email" required placeholder="member@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button className="icon-button" title="Add member"><UserPlus size={18} /></button>
      </form>
      {error && <div className="error">{error}</div>}
    </div>
  );
}

function TaskForm({ project, onCreateTask }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignee_id: "",
    priority: "medium",
    status: "todo",
    due_date: ""
  });
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await onCreateTask({
        ...form,
        project_id: project.id,
        assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
        due_date: form.due_date || null
      });
      setForm({ title: "", description: "", assignee_id: "", priority: "medium", status: "todo", due_date: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="panel form-grid" onSubmit={submit}>
      <div className="panel-title">
        <h2>New Task</h2>
        <Plus size={18} />
      </div>
      <label>
        Title
        <input required minLength="2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </label>
      <label>
        Description
        <textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </label>
      <div className="two-col">
        <label>
          Assignee
          <select value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
            <option value="">Unassigned</option>
            {project.members.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </label>
        <label>
          Due date
          <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        </label>
      </div>
      <div className="two-col">
        <label>
          Status
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Priority
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
      {error && <div className="error">{error}</div>}
      <button className="primary">Create task</button>
    </form>
  );
}

function TaskBoard({ project, onUpdateTask, onDeleteTask }) {
  const grouped = useMemo(() => {
    return Object.keys(statuses).reduce((acc, status) => {
      acc[status] = project.tasks.filter((task) => task.status === status);
      return acc;
    }, {});
  }, [project.tasks]);

  return (
    <div className="board">
      {Object.entries(statuses).map(([status, label]) => (
        <section className="column" key={status}>
          <div className="column-title">
            <h3>{label}</h3>
            <span>{grouped[status].length}</span>
          </div>
          {grouped[status].map((task) => (
            <article className={`task-card ${isOverdue(task) ? "overdue" : ""}`} key={task.id}>
              <div className="task-heading">
                <strong>{task.title}</strong>
                <span className={`pill ${task.priority}`}>{task.priority}</span>
              </div>
              {task.description && <p>{task.description}</p>}
              <div className="task-meta">
                <span>{task.assignee_name || "Unassigned"}</span>
                <span>{formatDate(task.due_date)}</span>
              </div>
              <div className="task-actions">
                <select value={task.status} onChange={(e) => onUpdateTask(task, { status: e.target.value })}>
                  {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <button className="ghost danger" onClick={() => onDeleteTask(task.id)}>Delete</button>
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || projects[0];

  async function refresh() {
    const [projectData, dashboardData] = await Promise.all([
      api("/api/projects"),
      api("/api/dashboard")
    ]);
    setProjects(projectData.projects);
    setDashboard(dashboardData);
    setSelectedProjectId((current) => current || projectData.projects[0]?.id || null);
  }

  useEffect(() => {
    const token = localStorage.getItem("ttm_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api("/api/auth/me")
      .then((data) => {
        setUser(data.user);
        return refresh();
      })
      .catch(() => localStorage.removeItem("ttm_token"))
      .finally(() => setLoading(false));
  }, []);

  async function onAuth(nextUser) {
    setUser(nextUser);
    await refresh();
  }

  async function createProject(form) {
    await api("/api/projects", { method: "POST", body: JSON.stringify(form) });
    await refresh();
  }

  async function addMember(projectId, form) {
    await api(`/api/projects/${projectId}/members`, { method: "POST", body: JSON.stringify(form) });
    await refresh();
  }

  async function removeMember(projectId, userId) {
    await api(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" });
    await refresh();
  }

  async function createTask(form) {
    await api("/api/tasks", { method: "POST", body: JSON.stringify(form) });
    await refresh();
  }

  async function updateTask(task, patch) {
    try {
      await api(`/api/tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...task, ...patch, project_id: task.project_id })
      });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteTask(taskId) {
    await api(`/api/tasks/${taskId}`, { method: "DELETE" });
    await refresh();
  }

  function logout() {
    localStorage.removeItem("ttm_token");
    setUser(null);
    setProjects([]);
    setDashboard(null);
  }

  if (loading) return <main className="loading">Loading workspace...</main>;
  if (!user) return <AuthScreen onAuth={onAuth} />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <FolderKanban />
          <div>
            <strong>Team Task Manager</strong>
            <small>{user.role}</small>
          </div>
        </div>
        <nav>
          {projects.map((project) => (
            <button
              key={project.id}
              className={selectedProject?.id === project.id ? "active" : ""}
              onClick={() => setSelectedProjectId(project.id)}
            >
              {project.name}
            </button>
          ))}
        </nav>
        <button className="logout" onClick={logout}><LogOut size={18} />Logout</button>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{selectedProject?.name || "Dashboard"}</h1>
            <p>{selectedProject?.description || "Create a project to begin assigning team tasks."}</p>
          </div>
          <div className="user-badge">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
        </header>
        {error && <div className="error banner">{error}</div>}
        <Dashboard dashboard={dashboard} />
        <section className="content-grid">
          <ProjectForm onCreate={createProject} />
          {selectedProject && (
            <TeamManager project={selectedProject} onAddMember={addMember} onRemoveMember={removeMember} />
          )}
        </section>
        {selectedProject ? (
          <>
            <section className="content-grid task-tools">
              <TaskForm project={selectedProject} onCreateTask={createTask} />
            </section>
            <TaskBoard project={selectedProject} onUpdateTask={updateTask} onDeleteTask={deleteTask} />
          </>
        ) : (
          <div className="empty-state">No projects yet. Create one to open the task board.</div>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
