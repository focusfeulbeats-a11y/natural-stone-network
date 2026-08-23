// Natural Stone Network — API client
// Talks to the backend in ../backend. No build step, no dependencies.
// Auth token is kept in sessionStorage so a refresh doesn't log the user out,
// but closing the tab does (fine for an MVP demo).

const API_BASE = window.NSN_API_BASE || 'http://localhost:4000/api';
const TOKEN_KEY = 'nsn_token';
const USER_KEY = 'nsn_user';

const Auth = {
  getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  },
  getUser() {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, user) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  },
  isLoggedIn() {
    return !!Auth.getToken();
  },
};

async function apiRequest(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = Auth.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    const err = new Error('Could not reach the Natural Stone Network API. Is the backend running?');
    err.cause = networkErr;
    err.offline = true;
    throw err;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.statusCode = res.status;
    throw err;
  }
  return data;
}

const Api = {
  // Auth
  register(payload) { return apiRequest('/auth/register', { method: 'POST', body: payload }); },
  login(payload) { return apiRequest('/auth/login', { method: 'POST', body: payload }); },
  me() { return apiRequest('/auth/me', { auth: true }); },

  // Professionals & suppliers
  listProfessionals(params = {}) { return apiRequest(`/professionals${qs(params)}`); },
  getProfessional(id) { return apiRequest(`/professionals/${id}`); },
  listSuppliers(params = {}) { return apiRequest(`/suppliers${qs(params)}`); },
  getSupplier(id) { return apiRequest(`/suppliers/${id}`); },

  // Projects
  listProjects(params = {}) { return apiRequest(`/projects${qs(params)}`); },
  getProject(id) { return apiRequest(`/projects/${id}`); },
  createProject(payload) { return apiRequest('/projects', { method: 'POST', body: payload, auth: true }); },
  likeProject(id) { return apiRequest(`/projects/${id}/like`, { method: 'POST', auth: true }); },
  unlikeProject(id) { return apiRequest(`/projects/${id}/like`, { method: 'DELETE', auth: true }); },
  saveProject(id) { return apiRequest(`/projects/${id}/save`, { method: 'POST', auth: true }); },
  unsaveProject(id) { return apiRequest(`/projects/${id}/save`, { method: 'DELETE', auth: true }); },
  listComments(id) { return apiRequest(`/projects/${id}/comments`); },
  postComment(id, body) { return apiRequest(`/projects/${id}/comments`, { method: 'POST', body: { body }, auth: true }); },
  follow(userId) { return apiRequest(`/users/${userId}/follow`, { method: 'POST', auth: true }); },
  unfollow(userId) { return apiRequest(`/users/${userId}/follow`, { method: 'DELETE', auth: true }); },

  // Enquiries / quotes / messages
  createEnquiry(payload) { return apiRequest('/enquiries', { method: 'POST', body: payload, auth: true }); },
  listMyEnquiries() { return apiRequest('/enquiries', { auth: true }); },
  getEnquiry(id) { return apiRequest(`/enquiries/${id}`, { auth: true }); },
  updateEnquiryStatus(id, status) { return apiRequest(`/enquiries/${id}`, { method: 'PATCH', body: { status }, auth: true }); },
  sendQuote(enquiryId, payload) { return apiRequest(`/enquiries/${enquiryId}/quotes`, { method: 'POST', body: payload, auth: true }); },
  approveQuote(quoteId) { return apiRequest(`/quotes/${quoteId}/approve`, { method: 'POST', auth: true }); },
  listMessages(enquiryId) { return apiRequest(`/enquiries/${enquiryId}/messages`, { auth: true }); },
  sendMessage(enquiryId, body) { return apiRequest(`/enquiries/${enquiryId}/messages`, { method: 'POST', body: { body }, auth: true }); },

  // Opportunities
  listOpportunities(params = {}) { return apiRequest(`/opportunities${qs(params)}`); },
  getOpportunity(id) { return apiRequest(`/opportunities/${id}`); },
  createOpportunity(payload) { return apiRequest('/opportunities', { method: 'POST', body: payload, auth: true }); },
  applyToOpportunity(id, coverNote) { return apiRequest(`/opportunities/${id}/apply`, { method: 'POST', body: { coverNote }, auth: true }); },
  listApplications(id) { return apiRequest(`/opportunities/${id}/applications`, { auth: true }); },

  // Dashboards
  professionalDashboard() { return apiRequest('/dashboard/professional', { auth: true }); },
  businessDashboard() { return apiRequest('/dashboard/business', { auth: true }); },
};

function qs(params) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : '';
}

// ---------- Shared header auth state ----------
// Any page with a `[data-auth-slot]` element in its nav gets a login/signup
// link swapped for the user's name + a logout link once they're signed in.
function renderAuthSlot() {
  document.querySelectorAll('[data-auth-slot]').forEach((slot) => {
    const user = Auth.getUser();
    if (user) {
      slot.innerHTML = `<span class="auth-user">${escapeHtml(user.name)}</span> <a href="#" data-logout>Log out</a>`;
      slot.querySelector('[data-logout]').addEventListener('click', (e) => {
        e.preventDefault();
        Auth.clearSession();
        window.location.reload();
      });
    } else {
      slot.innerHTML = `<a href="signup.html">Sign up</a> / <a href="signup.html?mode=login">Log in</a>`;
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function formatGBP(cents) {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
}

function timeAgo(isoLike) {
  if (!isoLike) return '';
  const then = new Date(isoLike.replace(' ', 'T') + 'Z');
  const diffMs = Date.now() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

document.addEventListener('DOMContentLoaded', renderAuthSlot);

window.NSN = { Api, Auth, escapeHtml, formatGBP, timeAgo, qs };
