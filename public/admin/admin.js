document.addEventListener('DOMContentLoaded', function () {
  const loginForm = document.getElementById('loginForm');
  const loginMsg = document.getElementById('loginMsg');
  const loginCard = document.getElementById('login');
  const dashboard = document.getElementById('dashboard');
  const authArea = document.getElementById('auth-area');

  function setLoggedIn(user) {
    loginCard.style.display = 'none';
    dashboard.style.display = '';
    authArea.innerHTML = `<strong>${escapeHtml(user.name || user.email)}</strong>`;
    loadTab('users');
  }

  function showLoginError(msg) {
    loginMsg.textContent = msg;
  }

  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    loginMsg.textContent = '';
    const data = new FormData(loginForm);
    const body = { email: data.get('email'), password: data.get('password') };
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return showLoginError(err.message || 'Login failed');
      }
      const payload = await res.json();
      setLoggedIn(payload.user);
    } catch (e) {
      showLoginError('Network error');
    }
  });

  // Tabs
  document.querySelectorAll('.tabs button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      loadTab(tab);
    });
  });

  function escapeHtml(s) { 
    return (s || '').replace(/[&<>"']/g, function (c) { 
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; 
    }); 
  }

  async function loadTab(tab) {
    // Hide all views first
    document.getElementById('usersView').style.display = 'none';
    document.getElementById('jobsView').style.display = 'none';
    document.getElementById('paymentsView').style.display = 'none';

    // Show and load the selected tab
    if (tab === 'users') {
      const el = document.getElementById('usersView');
      el.style.display = 'block';
      el.innerHTML = '<p class="muted">Loading users...</p>';
      try {
        const r = await fetch('/api/admin/users');
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          return el.innerHTML = `<p class="muted">${escapeHtml(err.message || 'Unable to load users')}</p>`;
        }
        const json = await r.json();
        renderUsers(json.data || []);
      } catch (e) {
        el.innerHTML = '<p class="muted">Network error loading users</p>';
      }
    }
    
    if (tab === 'jobs') {
      const el = document.getElementById('jobsView');
      el.style.display = 'block';
      el.innerHTML = '<p class="muted">Loading jobs...</p>';
      try {
        const r = await fetch('/api/admin/jobs');
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          return el.innerHTML = `<p class="muted">${escapeHtml(err.message || 'Unable to load jobs')}</p>`;
        }
        const json = await r.json();
        renderJobs(json.data || []);
      } catch (e) {
        el.innerHTML = '<p class="muted">Network error loading jobs</p>';
      }
    }
    
    if (tab === 'payments') {
      const el = document.getElementById('paymentsView');
      el.style.display = 'block';
      el.innerHTML = '<p class="muted">Loading payments...</p>';
      try {
        const r = await fetch('/api/admin/payments');
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          return el.innerHTML = `<p class="muted">${escapeHtml(err.message || 'Unable to load payments')}</p>`;
        }
        const json = await r.json();
        renderPayments(json.data || []);
      } catch (e) {
        el.innerHTML = '<p class="muted">Network error loading payments</p>';
      }
    }
  }

  function renderUsers(users) {
    const el = document.getElementById('usersView');
    if (!users.length) return el.innerHTML = '<p class="muted">No users found</p>';
    const rows = users.map(u => `<tr><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.phone)}</td><td>${escapeHtml(u.role)}</td><td>${new Date(u.createdAt).toLocaleString()}</td></tr>`).join('');
    el.innerHTML = `<h3>Total Users: ${users.length}</h3><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderJobs(jobs) {
    const el = document.getElementById('jobsView');
    if (!jobs.length) return el.innerHTML = '<p class="muted">No jobs found</p>';
    const rows = jobs.map(j => `<tr><td>${escapeHtml(j.title)}</td><td>${escapeHtml((j.description||'').substring(0,80))}</td><td>${escapeHtml((j.employer || {}).name || '')}</td><td>${new Date(j.createdAt).toLocaleString()}</td></tr>`).join('');
    el.innerHTML = `<h3>Total Jobs: ${jobs.length}</h3><table><thead><tr><th>Title</th><th>Description</th><th>Employer</th><th>Posted</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderPayments(payments) {
    const el = document.getElementById('paymentsView');
    if (!payments.length) return el.innerHTML = '<p class="muted">No payments found</p>';
    const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const rows = payments.map(p => `<tr><td>${escapeHtml(p.type)}</td><td>${escapeHtml((p.worker||{}).name||'')}</td><td>${escapeHtml((p.employer||{}).name||'')}</td><td>${p.amount} ${escapeHtml(p.currency||'')}</td><td>${new Date(p.createdAt).toLocaleString()}</td></tr>`).join('');
    el.innerHTML = `<h3>Total Payments: ${payments.length} | Total Amount: ${totalAmount.toLocaleString()}</h3><table><thead><tr><th>Type</th><th>Worker</th><th>Employer</th><th>Amount</th><th>Date</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

});
