import { useEffect, useMemo, useState } from 'react';

const types = ['Video creator', 'Streamer', 'Writer / newsletter creator', 'Podcaster', 'Musician', 'Educator', 'Artist / designer', 'Multi-format creator', 'Other'];
const platforms = ['YouTube', 'TikTok', 'Instagram', 'Twitch', 'Substack', 'Spotify', 'Patreon', 'Other'];
const categories = ['Content creation', 'Planning', 'Community', 'Business', 'Personal'];
const emptyProfile = { displayName: '', creatorType: 'Multi-format creator', mainPlatform: 'YouTube', focus: '', bio: '' };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const prettyDate = date => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...options.headers }, ...options });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(emptyProfile);
  const [tab, setTab] = useState('home');
  const [authMode, setAuthMode] = useState('register');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [booting, setBooting] = useState(true);
  const [date, setDate] = useState(today());
  const [tasks, setTasks] = useState([]);
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentPlan, setAgentPlan] = useState(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentError, setAgentError] = useState('');
  const [savedSuggestions, setSavedSuggestions] = useState([]);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    Promise.all([api('/me').catch(() => null), api('/health').catch(() => null)]).then(([me, status]) => {
      setHealth(status); if (me) { setUser(me.user); setProfile({ ...emptyProfile, ...me.profile }); }
    }).finally(() => setBooting(false));
  }, []);
  useEffect(() => { if (user) api(`/tasks?date=${date}`).then(data => setTasks(data.tasks)).catch(error => setTaskError(error.message)); }, [user, date]);

  const pending = tasks.filter(task => !task.completed);
  const completed = tasks.filter(task => task.completed).length;
  const plannedMinutes = pending.reduce((sum, task) => sum + task.minutes, 0);
  const greeting = useMemo(() => profile.displayName.trim().split(/\s+/)[0] || user?.email?.split('@')[0] || 'creator', [profile.displayName, user]);

  async function authenticate(event) {
    event.preventDefault(); setAuthError(''); setAuthBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await api(`/auth/${authMode}`, { method: 'POST', body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) });
      setUser(result.user); setProfile({ ...emptyProfile, ...result.profile });
    } catch (error) { setAuthError(error.message); } finally { setAuthBusy(false); }
  }
  async function signOut() { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); setTasks([]); setTab('home'); }
  async function saveProfile(event) {
    event.preventDefault(); setProfileMessage('Saving…');
    try { const result = await api('/profile', { method: 'PUT', body: JSON.stringify(profile) }); setProfile({ ...emptyProfile, ...result.profile }); setProfileMessage('Saved'); }
    catch (error) { setProfileMessage(error.message); }
  }
  async function addTask(task) {
    const result = await api('/tasks', { method: 'POST', body: JSON.stringify({ ...task, date }) });
    setTasks(current => [...current, result.task].sort((a, b) => a.time.localeCompare(b.time)));
  }
  async function submitTask(event) {
    event.preventDefault(); setTaskBusy(true); setTaskError('');
    const form = new FormData(event.currentTarget);
    try { await addTask({ title: form.get('title'), time: form.get('time'), minutes: Number(form.get('minutes')), category: form.get('category') }); event.currentTarget.reset(); }
    catch (error) { setTaskError(error.message); } finally { setTaskBusy(false); }
  }
  async function toggleTask(task) {
    try { const result = await api(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ completed: !task.completed }) }); setTasks(current => current.map(item => item.id === task.id ? result.task : item)); }
    catch (error) { setTaskError(error.message); }
  }
  async function removeTask(task) {
    try { await api(`/tasks/${task.id}`, { method: 'DELETE' }); setTasks(current => current.filter(item => item.id !== task.id)); }
    catch (error) { setTaskError(error.message); }
  }
  async function askAgent(event) {
    event.preventDefault(); setAgentBusy(true); setAgentError(''); setAgentPlan(null); setSavedSuggestions([]);
    try { setAgentPlan(await api('/agent/plan', { method: 'POST', body: JSON.stringify({ prompt: agentPrompt, currentTasks: pending.map(({ title, time, minutes }) => ({ title, time, minutes })) }) })); }
    catch (error) { setAgentError(error.message); } finally { setAgentBusy(false); }
  }
  async function saveSuggestion(suggestion, index) {
    try { await addTask(suggestion); setSavedSuggestions(current => [...current, index]); }
    catch (error) { setAgentError(error.message); }
  }

  if (booting) return <div className="boot"><span className="mark">cp</span><p>Opening your creator workspace…</p></div>;
  if (!user) return <AuthScreen mode={authMode} setMode={mode => { setAuthMode(mode); setAuthError(''); }} busy={authBusy} error={authError} onSubmit={authenticate} />;

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="wordmark" href="#home" onClick={event => { event.preventDefault(); setTab('home'); }}><span className="mark">cp</span><span>CreatorPulse</span></a>
      <div className="workspace-label">YOUR WORKSPACE</div>
      <nav className="side-nav" aria-label="Workspace">
        <NavButton active={tab === 'home'} onClick={() => setTab('home')} icon="⌂">Home</NavButton>
        <NavButton active={tab === 'profile'} onClick={() => setTab('profile')} icon="◉">Creator profile</NavButton>
        <NavButton active={tab === 'attend'} onClick={() => setTab('attend')} icon="◷">Attend</NavButton>
      </nav>
      <div className="sidebar-bottom"><a href="/demo/" target="_blank" rel="noreferrer" className="demo-link"><span>↗</span> Open original demo</a><div className="account-chip"><span className="account-avatar">{greeting[0]?.toUpperCase()}</span><span className="account-email">{user.email}</span><button title="Sign out" onClick={signOut}>↪</button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><span className="mobile-brand"><span className="mark">cp</span> CreatorPulse</span><span className="secure-label"><i></i> Your private workspace</span></header>
      <div className="content-wrap">
        {tab === 'home' && <section>
          <div className="welcome-row"><div><span className="kicker">YOUR CREATOR WORKSPACE</span><h1>Make room for the work, {greeting}.</h1><p className="subhead">Your creative work, your time, and your next steps in one place.</p></div><div className="welcome-date">{prettyDate(today())}</div></div>
          <div className="stat-grid"><article className="stat-card accent-card"><span>Today’s focus</span><strong>{pending.length}</strong><small>open tasks on your plan</small></article><article className="stat-card"><span>Time planned</span><strong>{plannedMinutes >= 60 ? `${Math.floor(plannedMinutes / 60)}h ${plannedMinutes % 60 ? `${plannedMinutes % 60}m` : ''}` : `${plannedMinutes}m`}</strong><small>remaining today</small></article><article className="stat-card"><span>Completed</span><strong>{completed}</strong><small>tasks checked off today</small></article></div>
          <div className="home-grid"><article className="panel focus-panel"><div className="panel-heading"><div><span className="kicker">ATTEND</span><h2>Today’s plan</h2></div><button className="inline-link" onClick={() => setTab('attend')}>Open Attend <span>→</span></button></div><TaskList tasks={tasks.slice(0, 4)} onToggle={toggleTask} onRemove={removeTask} emptyTitle="Nothing scheduled yet" emptyText="Add a task to give your day a little shape." /></article>
            <AgentPanel prompt={agentPrompt} setPrompt={setAgentPrompt} busy={agentBusy} plan={agentPlan} error={agentError} saved={savedSuggestions} onSubmit={askAgent} onSave={saveSuggestion} />
          </div>
          {!profile.displayName && <div className="setup-nudge"><span className="nudge-icon">✳</span><div><b>Make this space yours</b><p>Add your creator type and focus so your workspace reflects how you work.</p></div><button className="btn-secondary" onClick={() => setTab('profile')}>Set up profile <span>→</span></button></div>}
        </section>}
        {tab === 'profile' && <section>
          <PageHeading kicker="YOUR CREATOR IDENTITY" title="Creator profile" intro="Tell CreatorPulse what you make. Your workspace should work for your kind of creative work." />
          <form className="panel profile-form" onSubmit={saveProfile}><div className="field-grid">
            <Field label="Creator or brand name"><input maxLength="180" required value={profile.displayName} onChange={e => setProfile({ ...profile, displayName: e.target.value })} placeholder="e.g. Alex Rivera" /></Field>
            <Field label="What kind of creator are you?"><select value={profile.creatorType} onChange={e => setProfile({ ...profile, creatorType: e.target.value })}>{types.map(value => <option key={value}>{value}</option>)}</select></Field>
            <Field label="Main platform"><select value={profile.mainPlatform} onChange={e => setProfile({ ...profile, mainPlatform: e.target.value })}>{platforms.map(value => <option key={value}>{value}</option>)}</select></Field>
            <Field label="Current focus"><input maxLength="180" value={profile.focus} onChange={e => setProfile({ ...profile, focus: e.target.value })} placeholder="e.g. Publish consistently" /></Field>
            <Field label="About your work" wide><textarea maxLength="1200" rows="5" value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} placeholder="What do you make, and who is it for?" /></Field>
          </div><div className="form-footer"><span className="form-status" role="status">{profileMessage || 'Only you can see this profile.'}</span><button className="btn-primary" type="submit">Save profile</button></div></form>
          <article className="profile-preview"><div className="profile-avatar">{profile.displayName.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'cp'}</div><div><span className="kicker">PROFILE PREVIEW</span><h2>{profile.displayName || 'Your creator profile'}</h2><p>{profile.creatorType} · {profile.mainPlatform}</p><p>{profile.bio || 'Add a short introduction to make this profile yours.'}</p>{profile.focus && <span className="focus-tag">Focused on {profile.focus}</span>}</div></article>
        </section>}
        {tab === 'attend' && <section>
          <PageHeading kicker="MAKE SPACE FOR YOUR WORK" title="Attend" intro="A simple daily plan for protecting time and keeping creator work moving." />
          <div className="date-switcher"><button aria-label="Previous day" onClick={() => shiftDate(-1)}>←</button><strong>{prettyDate(date)}</strong><button aria-label="Next day" onClick={() => shiftDate(1)}>→</button>{date !== today() && <button className="today-button" onClick={() => setDate(today())}>Today</button>}</div>
          <div className="attend-grid"><article className="panel"><span className="kicker">ADD A TASK</span><h2>What needs your attention?</h2><form className="task-form" onSubmit={submitTask}><Field label="Task"><input name="title" maxLength="240" required placeholder="e.g. Record the intro for my next video" /></Field><div className="field-grid two"><Field label="Time"><input name="time" type="time" defaultValue="10:00" required /></Field><Field label="Time needed"><select name="minutes" defaultValue="30"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select></Field></div><Field label="Work type"><select name="category">{categories.map(value => <option key={value}>{value}</option>)}</select></Field>{taskError && <p className="error-text" role="alert">{taskError}</p>}<button className="btn-primary" disabled={taskBusy}>{taskBusy ? 'Adding…' : 'Add to my day'}</button></form></article>
            <article className="panel plan-panel"><div className="panel-heading"><div><span className="kicker">YOUR DAY</span><h2>Today's plan</h2></div><span className="task-count">{pending.length} left · {completed} done</span></div><TaskList tasks={tasks} onToggle={toggleTask} onRemove={removeTask} emptyTitle="Your day is open" emptyText="Add a task or ask your agent to help you plan." /></article></div>
          <div className="agent-callout"><div className="agent-spark">✦</div><div><b>Want a hand planning?</b><p>Tell the creator agent what you need to do. Review its suggested tasks before adding them to your day.</p></div><button className="btn-secondary" onClick={() => { setTab('home'); window.scrollTo(0, 0); }}>Ask the agent <span>→</span></button></div>
        </section>}
      </div>
      <footer className="footer"><span>CreatorPulse · Early access</span>{health && <span>Free local planner mode · no API key connected</span>}</footer>
    </main>
  </div>;

  function shiftDate(amount) { const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + amount); const d = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`; setDate(d); }
}

function AuthScreen({ mode, setMode, busy, error, onSubmit }) {
  return <main className="auth-screen"><section className="auth-story"><a className="wordmark" href="#"><span className="mark">cp</span><span>CreatorPulse</span></a><div className="auth-message"><span className="kicker">A HOME FOR YOUR CREATIVE WORK</span><h1>Your ideas deserve a little more room.</h1><p>CreatorPulse brings your creator identity, daily focus, and next steps together—so you can spend more time making.</p><div className="auth-chips"><span>Creator profiles</span><span>Attend planner</span><span>Task agent</span></div></div><a className="auth-demo-link" href="/demo/" target="_blank" rel="noreferrer">Take a look at the original demo <span>↗</span></a></section><section className="auth-form-wrap"><form className="auth-form" onSubmit={onSubmit}><span className="kicker">{mode === 'register' ? 'START YOUR WORKSPACE' : 'WELCOME BACK'}</span><h2>{mode === 'register' ? 'Create your account' : 'Sign in'}</h2><p>{mode === 'register' ? 'Your workspace is private and ready when you are.' : 'Pick up where you left off.'}</p><Field label="Email address"><input type="email" name="email" autoComplete="email" required placeholder="you@example.com" /></Field><Field label="Password"><input type="password" name="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength="10" required placeholder="At least 10 characters" /></Field>{error && <p className="error-text" role="alert">{error}</p>}<button className="btn-primary auth-submit" disabled={busy}>{busy ? 'One moment…' : mode === 'register' ? 'Create account' : 'Sign in'} <span>→</span></button><p className="auth-switch">{mode === 'register' ? 'Already have an account?' : 'New to CreatorPulse?'} <button type="button" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>{mode === 'register' ? 'Sign in' : 'Create an account'}</button></p><small className="privacy-note">Passwords are protected and your creator workspace belongs to your account.</small></form></section></main>;
}
function Field({ label, wide, children }) { return <label className={`field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>; }
function NavButton({ active, onClick, icon, children }) { return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><span className="nav-icon">{icon}</span>{children}</button>; }
function PageHeading({ kicker, title, intro }) { return <div className="page-heading"><span className="kicker">{kicker}</span><h1>{title}</h1><p>{intro}</p></div>; }
function TaskList({ tasks, onToggle, onRemove, emptyTitle, emptyText }) {
  if (!tasks.length) return <div className="empty-state"><div className="empty-symbol">✳</div><b>{emptyTitle}</b><p>{emptyText}</p></div>;
  return <ul className="task-list">{tasks.map(task => <li className={`task-row ${task.completed ? 'completed' : ''}`} key={task.id}><input type="checkbox" checked={task.completed} aria-label={`Mark ${task.title} ${task.completed ? 'incomplete' : 'complete'}`} onChange={() => onToggle(task)} /><div className="task-copy"><b>{task.title}</b><span>{task.time} · {task.minutes >= 60 ? `${task.minutes / 60} hr${task.minutes > 60 ? 's' : ''}` : `${task.minutes} min`}</span></div><span className="category-pill">{task.category}</span><button className="remove-button" aria-label={`Remove ${task.title}`} onClick={() => onRemove(task)}>×</button></li>)}</ul>;
}
function AgentPanel({ prompt, setPrompt, busy, plan, error, saved, onSubmit, onSave }) {
  return <article className="panel agent-panel"><div className="panel-heading"><div><span className="kicker">YOUR CREATOR AGENT</span><h2>What should we work on?</h2></div><span className="agent-indicator">✦</span></div><p className="panel-intro">Describe a project, a goal, or a list of things on your mind. The agent will turn it into tasks for you to review.</p><div className="prompt-examples"><button onClick={() => setPrompt('Help me plan and publish my weekly video')}>Plan a weekly video</button><button onClick={() => setPrompt('Record a podcast, write show notes, and share clips')}>Break down a project</button></div><form onSubmit={onSubmit} className="agent-form"><textarea value={prompt} onChange={event => setPrompt(event.target.value)} maxLength="1800" rows="3" required placeholder="e.g. I want to make and publish my next video this week…" /><button className="btn-primary" disabled={busy}>{busy ? <><span className="spinner" />Thinking…</> : <>Make a plan <span>→</span></>}</button></form>{error && <p className="error-text" role="alert">{error}</p>}{plan && <div className="agent-results"><p className="agent-message">{plan.message} {plan.mode === 'local' && <span className="mode-tag">Local mode</span>}</p>{plan.tasks.map((task, index) => <div className="suggestion" key={`${task.title}-${index}`}><span className="suggestion-time">{task.time}</span><span className="suggestion-copy"><b>{task.title}</b><small>{task.minutes} min · {task.category}</small></span><button disabled={saved.includes(index)} onClick={() => onSave(task, index)}>{saved.includes(index) ? 'Added ✓' : 'Add +'}</button></div>)}</div>}</article>;
}
