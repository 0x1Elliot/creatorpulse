import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import Database from 'better-sqlite3';

try { process.loadEnvFile(); } catch {}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const databasePath = path.resolve(process.env.DATABASE_PATH || path.join(root, 'data/creatorpulse.sqlite'));
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT '',
    creator_type TEXT NOT NULL DEFAULT 'Multi-format creator',
    main_platform TEXT NOT NULL DEFAULT 'YouTube',
    focus TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    task_date TEXT NOT NULL,
    task_time TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    category TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS tasks_by_user_day ON tasks(user_id, task_date, task_time);
`);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
const cookieName = 'creatorpulse_session';
const sessionDays = Math.min(Math.max(Number(process.env.SESSION_DAYS || 14), 1), 90);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const randomId = () => crypto.randomUUID();
const cookie = (value, maxAge) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
function getCookie(req) {
  const raw = req.headers.cookie || '';
  const entry = raw.split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`));
  return entry ? decodeURIComponent(entry.slice(cookieName.length + 1)) : '';
}
function publicProfile(userId) {
  return db.prepare('SELECT display_name AS displayName, creator_type AS creatorType, main_platform AS mainPlatform, focus, bio FROM profiles WHERE user_id = ?').get(userId);
}
function makeSession(userId, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const maxAge = sessionDays * 24 * 60 * 60;
  db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES(?, ?, ?)').run(hash(token), userId, Date.now() + maxAge * 1000);
  res.setHeader('Set-Cookie', cookie(token, maxAge));
}
function requireAuth(req, res, next) {
  const token = getCookie(req);
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  const session = db.prepare('SELECT user_id AS userId, expires_at AS expiresAt FROM sessions WHERE token_hash = ?').get(hash(token));
  if (!session || session.expiresAt < Date.now()) {
    if (session) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token));
    res.setHeader('Set-Cookie', cookie('', 0));
    return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
  }
  req.userId = session.userId;
  next();
}
const validEmail = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;

app.get('/api/health', (_req, res) => res.json({ ok: true, agent: 'local-planner' }));
app.post('/api/auth/register', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 10 || password.length > 200) return res.status(400).json({ error: 'Use a password between 10 and 200 characters.' });
  const userId = randomId();
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
  try {
    const create = db.transaction(() => {
      db.prepare('INSERT INTO users(id, email, password_hash) VALUES(?, ?, ?)').run(userId, email, passwordHash);
      db.prepare('INSERT INTO profiles(user_id) VALUES(?)').run(userId);
    });
    create();
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'An account with that email already exists.' });
    throw error;
  }
  makeSession(userId, res);
  res.status(201).json({ user: { email }, profile: publicProfile(userId) });
});
app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = db.prepare('SELECT id, email, password_hash AS passwordHash FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Email or password is incorrect.' });
  const [salt, expectedHex] = user.passwordHash.split(':');
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return res.status(401).json({ error: 'Email or password is incorrect.' });
  makeSession(user.id, res);
  res.json({ user: { email: user.email }, profile: publicProfile(user.id) });
});
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = getCookie(req);
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token));
  res.setHeader('Set-Cookie', cookie('', 0));
  res.status(204).end();
});
app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.userId);
  res.json({ user, profile: publicProfile(req.userId) });
});
app.put('/api/profile', requireAuth, (req, res) => {
  const body = req.body || {};
  const fields = ['displayName', 'creatorType', 'mainPlatform', 'focus', 'bio'];
  if (fields.some(field => typeof body[field] !== 'string' || body[field].length > (field === 'bio' ? 1200 : 180))) return res.status(400).json({ error: 'Profile fields are missing or too long.' });
  db.prepare(`UPDATE profiles SET display_name=?, creator_type=?, main_platform=?, focus=?, bio=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`)
    .run(body.displayName.trim(), body.creatorType, body.mainPlatform, body.focus.trim(), body.bio.trim(), req.userId);
  res.json({ profile: publicProfile(req.userId) });
});

const taskShape = row => ({ id: row.id, title: row.title, date: row.task_date, time: row.task_time, minutes: row.minutes, category: row.category, completed: Boolean(row.completed) });
app.get('/api/tasks', requireAuth, (req, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  const rows = db.prepare('SELECT * FROM tasks WHERE user_id=? AND task_date=? ORDER BY task_time, created_at').all(req.userId, date);
  res.json({ tasks: rows.map(taskShape) });
});
app.post('/api/tasks', requireAuth, (req, res) => {
  const { title, date, time, minutes, category } = req.body || {};
  if (typeof title !== 'string' || !title.trim() || title.length > 240) return res.status(400).json({ error: 'Enter a task title under 240 characters.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(time || '')) return res.status(400).json({ error: 'Choose a valid date and time.' });
  const length = Number(minutes);
  if (!Number.isInteger(length) || length < 5 || length > 720) return res.status(400).json({ error: 'Task length must be between 5 minutes and 12 hours.' });
  const categories = ['Content creation', 'Planning', 'Community', 'Business', 'Personal'];
  if (!categories.includes(category)) return res.status(400).json({ error: 'Choose a valid task category.' });
  const id = randomId();
  db.prepare('INSERT INTO tasks(id,user_id,title,task_date,task_time,minutes,category) VALUES(?,?,?,?,?,?,?)').run(id, req.userId, title.trim(), date, time, length, category);
  res.status(201).json({ task: taskShape(db.prepare('SELECT * FROM tasks WHERE id=? AND user_id=?').get(id, req.userId)) });
});
app.patch('/api/tasks/:id', requireAuth, (req, res) => {
  const completed = req.body?.completed;
  if (typeof completed !== 'boolean') return res.status(400).json({ error: 'Completed must be true or false.' });
  const result = db.prepare('UPDATE tasks SET completed=? WHERE id=? AND user_id=?').run(completed ? 1 : 0, req.params.id, req.userId);
  if (!result.changes) return res.status(404).json({ error: 'Task not found.' });
  res.json({ task: taskShape(db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id)) });
});
app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id=? AND user_id=?').run(req.params.id, req.userId);
  if (!result.changes) return res.status(404).json({ error: 'Task not found.' });
  res.status(204).end();
});

const categories = ['Content creation', 'Planning', 'Community', 'Business', 'Personal'];
function localPlan(prompt, currentTasks) {
  const segments = prompt.split(/\n|\s*;\s*|\s+and then\s+/i).map(part => part.replace(/^[-*\d.)\s]+/, '').trim()).filter(Boolean).slice(0, 4);
  const start = Math.max(9, 9 + currentTasks.length);
  return { message: 'Here is a starter plan based on your request. Review each task before adding it to Attend.', tasks: segments.map((title, index) => ({ title: title.slice(0, 160), time: `${String(Math.min(17, start + index)).padStart(2, '0')}:00`, minutes: 30, category: /email|reply|comment|community/i.test(title) ? 'Community' : /plan|outline|idea/i.test(title) ? 'Planning' : 'Content creation' })) };
}
app.post('/api/agent/plan', requireAuth, (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt || prompt.length > 1800) return res.status(400).json({ error: 'Describe a task or a plan (up to 1,800 characters).' });
  const currentTasks = Array.isArray(req.body?.currentTasks) ? req.body.currentTasks.slice(0, 20) : [];
  res.json({ ...localPlan(prompt, currentTasks), mode: 'local' });
});

if (process.env.NODE_ENV === 'production') {
  const webRoot = path.join(root, 'dist');
  app.use(express.static(webRoot, { index: false }));
  app.get('/{*splat}', (req, res, next) => req.path.startsWith('/api/') ? next() : res.sendFile(path.join(webRoot, 'index.html')));
}
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});
const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`CreatorPulse API ready on http://localhost:${port}`));
