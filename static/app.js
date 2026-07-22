const MAX_SCORE = 85; // 50 urgency + 30 priority + 5 quick-win bonus, ceiling for meter width

const els = {
  nextUpDot: document.getElementById('next-up-dot'),
  nextUpBody: document.getElementById('next-up-body'),
  queueList: document.getElementById('queue-list'),
  queueCount: document.getElementById('queue-count'),
  logList: document.getElementById('log-list'),
  logToggle: document.getElementById('log-toggle'),
  logChevron: document.getElementById('log-chevron'),
  addForm: document.getElementById('add-form'),
  formError: document.getElementById('form-error'),
};

function band(score) {
  if (score >= 55) return 'overdue';
  if (score >= 35) return 'soon';
  return 'later';
}

function fmtDeadline(deadline) {
  if (!deadline) return 'no deadline';
  const d = new Date(deadline + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Something went wrong.');
  }
  return res.status === 204 ? null : res.json();
}

// ---------- Rendering ----------

function renderNextUp(suggestion) {
  if (!suggestion) {
    els.nextUpDot.className = 'dot';
    els.nextUpBody.innerHTML = '<p class="next-up-empty">Nothing queued. Add a task to get a recommendation.</p>';
    return;
  }

  const b = band(suggestion.score);
  els.nextUpDot.className = 'dot ' + (b === 'overdue' ? 'urgent' : b === 'soon' ? 'soon' : '');
  const pct = Math.min(100, Math.round((suggestion.score / MAX_SCORE) * 100));

  els.nextUpBody.innerHTML = `
    <h2 class="next-up-title">${escapeHtml(suggestion.title)}</h2>
    <div class="next-up-meter"><div class="next-up-meter-fill" style="width:${pct}%"></div></div>
    <div class="next-up-meta">
      <span>Score <b>${suggestion.score}</b></span>
      <span>Priority <b>${suggestion.priority}</b></span>
      <span>Due <b>${fmtDeadline(suggestion.deadline)}</b></span>
      <span>Effort <b>${suggestion.effort_hours}h</b></span>
    </div>
    <p class="next-up-reason">Why: ${escapeHtml(suggestion.reason)}.</p>
    <div class="next-up-actions">
      <button class="btn-ghost" data-action="complete" data-id="${suggestion.id}">Mark complete</button>
    </div>
  `;
}

function renderQueue(openTasks) {
  els.queueCount.textContent = `${openTasks.length} open`;

  if (openTasks.length === 0) {
    els.queueList.innerHTML = '<p class="empty-state">Your queue is empty. Nice work, or time to add something.</p>';
    return;
  }

  els.queueList.innerHTML = openTasks.map((t, i) => {
    const b = band(t.score);
    const pct = Math.min(100, Math.round((t.score / MAX_SCORE) * 100));
    return `
      <div class="queue-row" data-id="${t.id}">
        <div class="queue-rank">${String(i + 1).padStart(2, '0')}</div>
        <div class="queue-main">
          <p class="queue-title">${escapeHtml(t.title)}</p>
          <div class="queue-bar-track"><div class="queue-bar-fill band-${b}" style="width:${pct}%"></div></div>
          <div class="queue-tags">
            <span class="pill">${t.priority}</span>
            <span>${fmtDeadline(t.deadline)}</span>
            <span>${t.effort_hours}h</span>
            <span>score ${t.score}</span>
          </div>
        </div>
        <div class="queue-actions">
          <button class="icon-btn complete" data-action="complete" data-id="${t.id}" title="Mark complete">✓</button>
          <button class="icon-btn delete" data-action="delete" data-id="${t.id}" title="Delete">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderLog(doneTasks) {
  if (doneTasks.length === 0) {
    els.logList.innerHTML = '<p class="log-empty">Nothing completed yet.</p>';
    return;
  }
  els.logList.innerHTML = doneTasks.map(t => `
    <div class="log-row">
      <span class="check">✓</span>
      <span class="log-title">${escapeHtml(t.title)}</span>
      <button class="icon-btn" data-action="reopen" data-id="${t.id}" title="Reopen">↺</button>
    </div>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---------- Data flow ----------

async function refresh() {
  const [tasksRes, suggestion] = await Promise.all([
    api('/api/tasks'),
    api('/api/suggest'),
  ]);
  renderNextUp(suggestion);
  renderQueue(tasksRes.open);
  renderLog(tasksRes.done);
}

async function handleAction(action, id) {
  try {
    if (action === 'complete') await api(`/api/tasks/${id}/complete`, { method: 'POST' });
    if (action === 'delete') await api(`/api/tasks/${id}`, { method: 'DELETE' });
    if (action === 'reopen') await api(`/api/tasks/${id}/reopen`, { method: 'POST' });
    await refresh();
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  handleAction(btn.dataset.action, btn.dataset.id);
});

els.addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.formError.textContent = '';

  const title = document.getElementById('f-title').value.trim();
  const priority = document.getElementById('f-priority').value;
  const deadline = document.getElementById('f-deadline').value;
  const effort_hours = document.getElementById('f-effort').value;

  if (!title) {
    els.formError.textContent = 'Give the task a title first.';
    return;
  }

  try {
    await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, priority, deadline, effort_hours }),
    });
    els.addForm.reset();
    document.getElementById('f-priority').value = 'medium';
    document.getElementById('f-effort').value = 1;
    await refresh();
  } catch (err) {
    els.formError.textContent = err.message;
  }
});

els.logToggle.addEventListener('click', () => {
  els.logList.classList.toggle('collapsed');
  els.logChevron.classList.toggle('open');
});

refresh();
