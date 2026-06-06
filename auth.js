/* =========================================================
   auth.js  — NetConf AI · MFU IAM Login / Register
   Backend: Python HTTP server (start_dashboard.py) + MySQL
   ========================================================= */

'use strict';

/* ── API base URL ─────────────────────────────────────────
   Same server as the HTML (port 8000) — no CORS issues.
   ─────────────────────────────────────────────────────── */
const API_BASE = '/api';

/* ── Particle canvas background ── */
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const COLORS = ['rgba(198,160,96,', 'rgba(160,26,46,', 'rgba(56,189,248,'];

  function mkParticle() {
    const c = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      x:     Math.random() * W,
      y:     Math.random() * H,
      r:     Math.random() * 1.6 + 0.4,
      dx:    (Math.random() - 0.5) * 0.35,
      dy:    (Math.random() - 0.5) * 0.35,
      alpha: Math.random() * 0.5 + 0.15,
      color: c,
    };
  }

  for (let i = 0; i < 90; i++) particles.push(mkParticle());

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + p.alpha + ')';
      ctx.fill();

      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0 || p.x > W) p.dx *= -1;
      if (p.y < 0 || p.y > H) p.dy *= -1;
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ── Utility helpers ── */
function showAlert(el, msg, type = 'error') {
  el.textContent = msg;
  el.className = 'alert-box ' + type;
  el.style.display = 'block';
}

function hideAlert(el) {
  el.style.display = 'none';
}

function setLoading(btn, loading) {
  const text   = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (text)   text.style.display   = loading ? 'none'         : '';
  if (loader) loader.style.display = loading ? 'inline-flex'  : 'none';
}

/* ── Password toggle ── */
function bindPasswordToggle(toggleId, inputId, eyeOpenId, eyeClosedId) {
  const btn     = document.getElementById(toggleId);
  const input   = document.getElementById(inputId);
  const eyeOpen = document.getElementById(eyeOpenId);
  const eyeClose= document.getElementById(eyeClosedId);
  if (!btn || !input) return;

  btn.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    if (eyeOpen)  eyeOpen.style.display  = show ? 'none'   : '';
    if (eyeClose) eyeClose.style.display = show ? ''       : 'none';
  });
}

/* ── Generic API call ── */
async function apiPost(endpoint, payload) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method:      'POST',
    credentials: 'include',   // send session cookies
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify(payload),
  });
  const data = await res.json();
  return { status: res.status, data };
}

/* ── Login page ── */
function initLogin() {
  const form  = document.getElementById('login-form');
  const alert = document.getElementById('login-alert');
  const btn   = document.getElementById('login-btn');
  if (!form) return;

  bindPasswordToggle('toggle-pw-login', 'login-password', 'eye-open', 'eye-closed');

  // Restore remember-me email
  const saved = localStorage.getItem('mfu_remember_email');
  if (saved) {
    const emailInput = document.getElementById('login-email');
    if (emailInput) emailInput.value = saved;
    const cb = document.getElementById('remember-me');
    if (cb) cb.checked = true;
  }

  // Google SSO (placeholder)
  const googleBtn = document.getElementById('btn-google-login');
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      showAlert(alert, '🔗 MFU Google SSO integration — connect your OAuth 2.0 client here.', 'error');
    });
  }

  // Forgot password (placeholder)
  const forgot = document.getElementById('forgot-link');
  if (forgot) {
    forgot.addEventListener('click', (e) => {
      e.preventDefault();
      showAlert(alert, '📧 Contact your system administrator to reset your password.', 'info');
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(alert);

    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('remember-me')?.checked ?? false;

    if (!email || !password) {
      showAlert(alert, '⚠️ Please fill in all fields.'); return;
    }

    setLoading(btn, true);

    try {
      const { status, data } = await apiPost('login', { email, password, remember });

      if (!data.ok) {
        showAlert(alert, '❌ ' + (data.error || 'Authentication failed.'));
        setLoading(btn, false);
        return;
      }

      // Save remember-me preference
      if (remember) {
        localStorage.setItem('mfu_remember_email', email);
      } else {
        localStorage.removeItem('mfu_remember_email');
      }

      // Store user info for the dashboard to read
      sessionStorage.setItem('mfu_user', JSON.stringify(data.user));

      showAlert(alert, '✅ Sign in successful! Redirecting to dashboard...', 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1200);

    } catch (err) {
      console.error('[Login] Network error:', err);
      showAlert(alert, '❌ Cannot reach the server. Make sure start_dashboard.py is running (python start_dashboard.py).');
      setLoading(btn, false);
    }
  });
}

/* ── Password strength meter ── */
function calcStrength(pw) {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

function renderStrength(score, fillEl, labelEl) {
  const levels = [
    { pct: '0%',   color: 'transparent',            label: '',              labelColor: 'transparent' },
    { pct: '25%',  color: '#ef4444',                label: 'Weak',          labelColor: '#ef4444' },
    { pct: '50%',  color: '#f97316',                label: 'Fair',          labelColor: '#f97316' },
    { pct: '75%',  color: '#facc15',                label: 'Good',          labelColor: '#facc15' },
    { pct: '90%',  color: '#4ade80',                label: 'Strong',        labelColor: '#4ade80' },
    { pct: '100%', color: '#22c55e',                label: '✓ Very Strong', labelColor: '#22c55e' },
  ];
  const lvl = levels[Math.min(score, levels.length - 1)];
  fillEl.style.width      = lvl.pct;
  fillEl.style.background = lvl.color;
  labelEl.textContent     = lvl.label;
  labelEl.style.color     = lvl.labelColor;
}

/* ── Register page ── */
function initRegister() {
  const form  = document.getElementById('register-form');
  const alert = document.getElementById('register-alert');
  const btn   = document.getElementById('register-btn');
  if (!form) return;

  bindPasswordToggle('toggle-pw-reg', 'reg-password', 'reg-eye-open', 'reg-eye-closed');

  // Password strength
  const pwInput   = document.getElementById('reg-password');
  const fillEl    = document.getElementById('pw-strength-fill');
  const labelEl   = document.getElementById('pw-strength-label');
  const confirmEl = document.getElementById('reg-confirm-password');
  const matchEl   = document.getElementById('pw-match-label');

  if (pwInput && fillEl && labelEl) {
    pwInput.addEventListener('input', () => {
      const score = calcStrength(pwInput.value);
      renderStrength(score, fillEl, labelEl);
      checkMatch();
    });
  }

  function checkMatch() {
    if (!confirmEl || !matchEl || !pwInput) return;
    const pw  = pwInput.value;
    const cpw = confirmEl.value;
    if (!cpw) { matchEl.textContent = ''; return; }
    if (pw === cpw) {
      matchEl.textContent = '✓ Passwords match';
      matchEl.style.color = '#4ade80';
    } else {
      matchEl.textContent = '✗ Passwords do not match';
      matchEl.style.color = '#ef4444';
    }
  }

  if (confirmEl) confirmEl.addEventListener('input', checkMatch);

  // Email validation — enforce MFU domain
  const emailInput = document.getElementById('reg-email');
  if (emailInput) {
    emailInput.addEventListener('blur', () => {
      const v = emailInput.value.trim();
      if (v && !v.endsWith('@lamduan.mfu.ac.th')) {
        emailInput.classList.add('invalid');
        emailInput.classList.remove('valid');
      } else if (v) {
        emailInput.classList.add('valid');
        emailInput.classList.remove('invalid');
      }
    });
  }

  // Google SSO (placeholder)
  const googleBtn = document.getElementById('btn-google-register');
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      showAlert(alert, '🔗 MFU Google SSO registration — connect your OAuth 2.0 client here.', 'error');
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(alert);

    const firstname = document.getElementById('reg-firstname').value.trim();
    const lastname  = document.getElementById('reg-lastname').value.trim();
    const studentId = document.getElementById('reg-student-id').value.trim();
    const email     = document.getElementById('reg-email').value.trim();
    const role      = document.getElementById('reg-role').value;
    const password  = document.getElementById('reg-password').value;
    const confirm   = document.getElementById('reg-confirm-password').value;
    const terms     = document.getElementById('reg-terms')?.checked;

    // Client-side validations (server will also validate)
    if (!firstname || !lastname || !studentId || !email || !role || !password || !confirm) {
      showAlert(alert, '⚠️ Please fill in all required fields.'); return;
    }
    if (!/^\d{10}$/.test(studentId)) {
      showAlert(alert, '⚠️ Student ID must be exactly 10 digits.'); return;
    }
    if (!email.endsWith('@lamduan.mfu.ac.th')) {
      showAlert(alert, '⚠️ Email must be your official @lamduan.mfu.ac.th address.'); return;
    }
    if (password.length < 8) {
      showAlert(alert, '⚠️ Password must be at least 8 characters.'); return;
    }
    if (password !== confirm) {
      showAlert(alert, '⚠️ Passwords do not match.'); return;
    }
    if (!terms) {
      showAlert(alert, '⚠️ You must agree to the Terms of Service.'); return;
    }

    setLoading(btn, true);

    try {
      const { status, data } = await apiPost('register', {
        firstname, lastname, studentId, email, role,
        password, confirmPassword: confirm,
      });

      if (!data.ok) {
        showAlert(alert, '❌ ' + (data.error || 'Registration failed.'));
        setLoading(btn, false);
        return;
      }

      showAlert(alert, '✅ Account created successfully! Redirecting to sign in...', 'success');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);

    } catch (err) {
      console.error('[Register] Network error:', err);
      showAlert(alert, '❌ Cannot reach the server. Make sure start_dashboard.py is running (python start_dashboard.py).');
      setLoading(btn, false);
    }
  });
}

/* ── Auto-init based on page ── */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('login-form'))    initLogin();
  if (document.getElementById('register-form')) initRegister();
});
