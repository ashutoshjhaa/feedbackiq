import { useState, useEffect } from 'react';
import { api } from './api.js';

function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    try {
      const data = await api(`/auth/${mode}`, 'POST', { email, password });
      localStorage.setItem('token', data.token);
      onLogin();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="box small">
      <h2>{mode === 'login' ? 'Login' : 'Register'}</h2>
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button onClick={submit}>{mode === 'login' ? 'Login' : 'Create account'}</button>
      <p className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New user? Register' : 'Already have an account? Login'}
      </p>
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api('/stats').then(setStats).catch(() => {}); }, []);
  if (!stats) return <p>Loading...</p>;

  const count = (name) => stats.sentiment.find((s) => s._id === name)?.n || 0;
  const total = count('positive') + count('negative') + count('neutral');
  const max = Math.max(1, ...stats.topics.map((t) => t.negative));

  if (!total) return <p>No reviews yet. Go to Upload tab.</p>;

  return (
    <div>
      {stats.spikes.length > 0 && (
        <div className="alert">
          Spike alert: negative reviews increased this week for{' '}
          {stats.spikes.map((s) => `${s._id} (${s.prev} → ${s.last})`).join(', ')}
        </div>
      )}
      <div className="row">
        <div className="box"><b>{total}</b><br />Total reviews</div>
        <div className="box"><b>{count('positive')}</b><br />Positive</div>
        <div className="box"><b>{count('neutral')}</b><br />Neutral</div>
        <div className="box"><b>{count('negative')}</b><br />Negative</div>
      </div>
      <div className="box">
        <h3>Negative reviews by topic</h3>
        {stats.topics.map((t) => (
          <div key={t._id} className="bar-row">
            <span className="bar-name">{t._id}</span>
            <div className="bar" style={{ width: `${(t.negative / max) * 100}%` }} />
            <span>{t.negative}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Upload() {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  function readFile(e) {
    const file = e.target.files[0];
    if (file) file.text().then(setText);
  }

  async function submit() {
    setLoading(true);
    setMsg('');
    try {
      const data = await api('/reviews/upload', 'POST', { text });
      setMsg(`${data.saved} reviews analyzed and saved.`);
      setText('');
    } catch (e) {
      setMsg(e.message);
    }
    setLoading(false);
  }

  return (
    <div className="box">
      <h3>Upload reviews</h3>
      <p className="hint">One review per line. Optional date: 2025-03-14, review text (max 200 lines)</p>
      <input type="file" accept=".txt,.csv" onChange={readFile} />
      <textarea rows="10" placeholder="Paste reviews here..." value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={submit} disabled={loading || !text.trim()}>{loading ? 'Analyzing...' : 'Analyze'}</button>
      {msg && <p>{msg}</p>}
    </div>
  );
}

function Issues() {
  const [issues, setIssues] = useState([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => api('/issues').then(setIssues).catch(() => {});
  useEffect(() => { load(); }, []);

  async function generate() {
    setLoading(true);
    setMsg('');
    try {
      const data = await api('/issues/generate', 'POST');
      setMsg(`${data.created} issues created.`);
      load();
    } catch (e) {
      setMsg(e.message);
    }
    setLoading(false);
  }

  async function setStatus(id, status) {
    await api('/issues/' + id, 'PATCH', { status });
    load();
  }

  return (
    <div>
      <button onClick={generate} disabled={loading}>{loading ? 'Grouping...' : 'Group new negative reviews into issues'}</button>
      {msg && <p>{msg}</p>}
      {issues.map((i) => (
        <div key={i._id} className="box">
          <div className="between">
            <b>{i.title}</b>
            <span className="tag">{i.reviewCount} reviews · {i.topic}</span>
          </div>
          <p>Suggested fix: {i.suggestion}</p>
          <select value={i.status} onChange={(e) => setStatus(i._id, e.target.value)}>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="fixed">Fixed</option>
          </select>
          {i.impact && (
            <p className="hint">
              Negative "{i.topic}" reviews: {i.impact.before} before fix, {i.impact.after} after fix
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('token'));
  const [tab, setTab] = useState('dashboard');

  function logout() {
    localStorage.removeItem('token');
    setLoggedIn(false);
  }

  return (
    <div className="container">
      <div className="between header">
        <h1>FeedbackIQ</h1>
        {loggedIn && <span className="link" onClick={logout}>Logout</span>}
      </div>
      {!loggedIn ? (
        <Login onLogin={() => setLoggedIn(true)} />
      ) : (
        <>
          <div className="tabs">
            {['dashboard', 'upload', 'issues'].map((t) => (
              <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'upload' && <Upload />}
          {tab === 'issues' && <Issues />}
        </>
      )}
    </div>
  );
}
