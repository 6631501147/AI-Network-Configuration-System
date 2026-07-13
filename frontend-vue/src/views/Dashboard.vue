<template>
  <div class="ai-dashboard">

    <!-- Hero Banner -->
    <div class="ai-hero">
      <div class="ai-hero__body">
        <div class="ai-hero__badge">
          <span class="ai-hero__badge-dot"></span>
          Mae Fah Luang University · Applied Digital Technology
        </div>
        <h1 class="ai-hero__title">AI-Based Automatic Network Configuration System</h1>
        <p class="ai-hero__subtitle">
          Upload network topology diagrams and let AI automatically generate device configurations.
          Supports GNS3 and Cisco Packet Tracer topology screenshots.
        </p>
        <div class="ai-hero__actions">
          <a href="/ai-engine/dashboard.html" class="ai-btn ai-btn--primary">
            <CIcon name="cil-chart-pie" class="mr-2" />
            Open AI Engine
          </a>
        </div>
      </div>
      <div class="ai-hero__graphic">
        <div class="ai-hero__icon-wrap">
          <svg class="ai-hero__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="ai-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#60a5fa" />
                <stop offset="100%" stop-color="#c084fc" />
              </linearGradient>
            </defs>
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="url(#ai-glow)" stroke-width="1.5" stroke-linejoin="round" />
            <path d="M2 17L12 22L22 17" stroke="url(#ai-glow)" stroke-width="1.5" stroke-linejoin="round" />
            <path d="M2 12L12 17L22 12" stroke="url(#ai-glow)" stroke-width="1.5" stroke-linejoin="round" />
            <circle cx="12" cy="12" r="3" fill="url(#ai-glow)" opacity="0.4" />
            <circle cx="12" cy="2" r="1.5" fill="#60a5fa" />
            <circle cx="2" cy="7" r="1.5" fill="#60a5fa" />
            <circle cx="22" cy="7" r="1.5" fill="#c084fc" />
            <circle cx="2" cy="12" r="1.5" fill="#60a5fa" />
            <circle cx="22" cy="12" r="1.5" fill="#c084fc" />
            <circle cx="2" cy="17" r="1.5" fill="#60a5fa" />
            <circle cx="22" cy="17" r="1.5" fill="#c084fc" />
            <circle cx="12" cy="22" r="1.5" fill="#c084fc" />
            <circle cx="12" cy="12" r="1.5" fill="#ffffff" />
          </svg>
        </div>
      </div>
    </div>

    <CRow>
      <!-- Topology Sources -->
      <CCol lg="4" class="mb-4">
        <CCard class="ai-card h-100">
          <CCardBody>
            <div class="ai-section-header">
              <div class="ai-section-header__eyebrow">Supported Input Types</div>
              <h2 class="ai-section-header__title">Topology Sources</h2>
            </div>
            <div class="ai-source-list">
              <div
                v-for="source in topologySources"
                :key="source.label"
                class="ai-source-item"
              >
                <div class="ai-source-item__icon-wrap" :class="`ai-source-item__icon-wrap--${source.accent}`">
                  <CIcon :name="source.icon" />
                </div>
                <div class="ai-source-item__body">
                  <strong>{{ source.label }}</strong>
                  <span>{{ source.description }}</span>
                </div>
              </div>
            </div>
          </CCardBody>
        </CCard>
      </CCol>

      <!-- AI Workflow -->
      <CCol lg="5" class="mb-4">
        <CCard class="ai-card h-100">
          <CCardBody>
            <div class="ai-section-header">
              <div class="ai-section-header__eyebrow">How It Works</div>
              <h2 class="ai-section-header__title">AI Workflow</h2>
            </div>
            <div class="ai-workflow">
              <div v-for="(step, index) in workflowSteps" :key="index" class="ai-workflow__step">
                <div class="ai-workflow__number">{{ index + 1 }}</div>
                <div class="ai-workflow__body">
                  <strong>{{ step.title }}</strong>
                  <span>{{ step.description }}</span>
                </div>
              </div>
            </div>
          </CCardBody>
        </CCard>
      </CCol>

      <!-- System Info -->
      <CCol lg="3" class="mb-4">
        <CCard class="ai-card h-100">
          <CCardBody>
            <div class="ai-section-header">
              <div class="ai-section-header__eyebrow">Platform</div>
              <h2 class="ai-section-header__title">System Info</h2>
            </div>
            <div class="ai-info-list">
              <div class="ai-info-row">
                <span class="ai-info-row__label">Department</span>
                <span class="ai-info-row__value">Applied Digital Technology</span>
              </div>
              <div class="ai-info-row">
                <span class="ai-info-row__label">University</span>
                <span class="ai-info-row__value">Mae Fah Luang</span>
              </div>
              <div class="ai-info-row">
                <span class="ai-info-row__label">AI Engine</span>
                <a href="/ai-engine/dashboard.html" class="ai-info-row__link">
                  <CBadge color="success">Online</CBadge>
                </a>
              </div>
              <div class="ai-info-row">
                <span class="ai-info-row__label">Date</span>
                <span class="ai-info-row__value">{{ todayLabel }}</span>
              </div>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  </div>
</template>

<script>
import api from '@/service/api'

export default {
  name: 'Dashboard',
  data () {
    return {
      statsLoading: true,
      stats: {
        total: 0,
        active: 0,
        review: 0,
        expiring: 0
      },
      topologySources: [
        { label: 'GNS3 Topology Images', description: 'Export topology diagrams from the GNS3 simulator.', icon: 'cil-image', accent: 'blue' },
        { label: 'Cisco Packet Tracer Screenshots', description: 'Capture and upload Cisco Packet Tracer topology screenshots.', icon: 'cil-image1', accent: 'green' }
      ],
      workflowSteps: [
        { title: 'Upload Topology', description: 'Upload a network topology image or file to the AI Engine.' },
        { title: 'AI Analysis', description: 'The AI model analyzes the diagram and identifies devices, links, and network structure.' },
        { title: 'Config Generation', description: 'Device configurations are automatically generated based on the topology.' },
        { title: 'Results Saved Automatically', description: 'Analysis results and generated configurations are automatically saved in the dashboard as part of the project flow.' }
      ]
    }
  },
  computed: {
    statCards () {
      return [
        {
          key: 'total',
          label: 'Total Configurations',
          value: this.stats.total,
          hint: 'All registry records',
          icon: 'cil-description',
          accent: 'blue'
        },
        {
          key: 'active',
          label: 'Deployed',
          value: this.stats.active,
          hint: 'Active and validated',
          icon: 'cil-check-circle',
          accent: 'green'
        },
        {
          key: 'review',
          label: 'Under Review',
          value: this.stats.review,
          hint: 'Awaiting validation',
          icon: 'cil-list-rich',
          accent: 'amber'
        },
        {
          key: 'expiring',
          label: 'Needs Update',
          value: this.stats.expiring,
          hint: 'Outdated or expiring',
          icon: 'cil-warning',
          accent: 'red'
        }
      ]
    },
    todayLabel () {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).format(new Date())
    }
  },
  mounted () {
    this.fetchStats()
  },
  methods: {
    async fetchStats () {
      this.statsLoading = true
      try {
        const response = await api.aibasedautomaticnetworkconfigurationsystemDocuments('stats')
        if (response && response.data && response.data.data) {
          this.stats = Object.assign({}, this.stats, response.data.data)
        }
      } catch (err) {
        // Stats are non-critical — dashboard still renders without them
      } finally {
        this.statsLoading = false
      }
    }
  }
}
</script>

<style scoped>
/* ─── Page Layout ─────────────────────────────────────── */
.ai-dashboard {
  padding: 0.25rem;
}

/* ─── Hero Banner ─────────────────────────────────────── */
.ai-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 2rem 2.25rem;
  margin-bottom: 1.5rem;
  border-radius: 12px;
  background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #1d4ed8 100%);
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.18);
  overflow: hidden;
  position: relative;
}

.ai-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 80% 50%, rgba(99, 102, 241, 0.18) 0%, transparent 70%);
  pointer-events: none;
}

.ai-hero__body {
  position: relative;
  flex: 1;
}

.ai-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
  padding: 0.3rem 0.85rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.ai-hero__badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.3);
  animation: ai-pulse 2s ease-in-out infinite;
}

@keyframes ai-pulse {
  0%, 100% { box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.3); }
  50% { box-shadow: 0 0 0 5px rgba(74, 222, 128, 0.1); }
}

.ai-hero__title {
  margin: 0 0 0.75rem;
  color: #ffffff;
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.ai-hero__subtitle {
  max-width: 620px;
  margin: 0 0 1.5rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.95rem;
  line-height: 1.65;
}

.ai-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.ai-hero__graphic {
  flex: 0 0 auto;
  position: relative;
}

.ai-hero__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: radial-gradient(circle at top left, rgba(96, 165, 250, 0.15), rgba(192, 132, 252, 0.05));
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 0 25px rgba(96, 165, 250, 0.25), inset 0 0 15px rgba(192, 132, 252, 0.15);
}

.ai-hero__icon {
  width: 60px;
  height: 60px;
  color: rgba(255, 255, 255, 0.9);
  filter: drop-shadow(0 0 8px rgba(96, 165, 250, 0.4));
}

/* ─── Buttons ─────────────────────────────────────────── */
.ai-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.55rem 1.1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.18s ease;
  cursor: pointer;
  border: none;
}

.ai-btn--primary {
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
}

.ai-btn--primary:hover {
  background: #1d4ed8;
  color: #ffffff;
  text-decoration: none;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.5);
}

.ai-btn--outline {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.ai-btn--outline:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  text-decoration: none;
  border-color: rgba(255, 255, 255, 0.4);
}

.ai-btn--ghost {
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.ai-btn--ghost:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
  text-decoration: none;
}

/* ─── Stat Cards ──────────────────────────────────────── */
.ai-stat-card {
  border: 0;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.07);
  border-left: 4px solid transparent;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.ai-stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.ai-stat-card--blue { border-left-color: #2563eb; }
.ai-stat-card--green { border-left-color: #16a34a; }
.ai-stat-card--amber { border-left-color: #d97706; }
.ai-stat-card--red { border-left-color: #dc2626; }

.ai-stat-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.ai-stat-card__label {
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.ai-stat-card__icon {
  color: #94a3b8;
  width: 18px;
  height: 18px;
}

.ai-stat-card__value {
  color: #0f172a;
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 0.35rem;
}

.ai-stat-card__hint {
  color: #64748b;
  font-size: 0.82rem;
}

/* ─── General Card ────────────────────────────────────── */
.ai-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
}

/* ─── Section Header ──────────────────────────────────── */
.ai-section-header {
  margin-bottom: 1rem;
}

.ai-section-header__eyebrow {
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 0.2rem;
}

.ai-section-header__title {
  margin: 0;
  color: #0f172a;
  font-size: 1rem;
  font-weight: 700;
}

/* ─── Topology Source List ────────────────────────────── */
.ai-source-list {
  display: grid;
  gap: 0.65rem;
}

.ai-source-item {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 0.7rem 0.85rem;
  border-radius: 8px;
  border: 1px solid #f1f5f9;
  background: #f8fafc;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.ai-source-item:hover {
  border-color: #cbd5e1;
  background: #f1f5f9;
}

.ai-source-item__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  border-radius: 7px;
}

.ai-source-item__icon-wrap--blue { background: #eff6ff; color: #2563eb; }
.ai-source-item__icon-wrap--green { background: #f0fdf4; color: #16a34a; }
.ai-source-item__icon-wrap--purple { background: #f5f3ff; color: #7c3aed; }
.ai-source-item__icon-wrap--amber { background: #fffbeb; color: #d97706; }
.ai-source-item__icon-wrap--red { background: #fef2f2; color: #dc2626; }

.ai-source-item__body strong,
.ai-source-item__body span {
  display: block;
}

.ai-source-item__body strong {
  color: #1e293b;
  font-size: 0.875rem;
  font-weight: 600;
}

.ai-source-item__body span {
  color: #64748b;
  font-size: 0.8rem;
  line-height: 1.4;
}

/* ─── Workflow Steps ──────────────────────────────────── */
.ai-workflow {
  display: grid;
  gap: 0.75rem;
}

.ai-workflow__step {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}

.ai-workflow__number {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #2563eb;
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 700;
}

.ai-workflow__body strong,
.ai-workflow__body span {
  display: block;
}

.ai-workflow__body strong {
  color: #1e293b;
  font-size: 0.875rem;
  font-weight: 600;
}

.ai-workflow__body span {
  color: #64748b;
  font-size: 0.8rem;
  line-height: 1.4;
}

/* ─── Quick Links ─────────────────────────────────────── */
.ai-links {
  display: grid;
  gap: 0.45rem;
}

.ai-link-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  color: #334155;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  border: 1px solid transparent;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.ai-link-item:hover {
  background: #f1f5f9;
  border-color: #e2e8f0;
  color: #1e293b;
  text-decoration: none;
}

.ai-link-item__icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
}

.ai-link-item__icon--blue { color: #2563eb; }
.ai-link-item__icon--green { color: #16a34a; }
.ai-link-item__icon--purple { color: #7c3aed; }
.ai-link-item__icon--amber { color: #d97706; }

.ai-link-item span {
  flex: 1;
}

.ai-link-item__arrow {
  width: 14px;
  height: 14px;
  color: #94a3b8;
}

/* ─── System Info ─────────────────────────────────────── */
.ai-info-list {
  display: grid;
  gap: 0.5rem;
}

.ai-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.85rem;
}

.ai-info-row:last-child {
  border-bottom: 0;
}

.ai-info-row__label {
  color: #64748b;
  font-weight: 500;
}

.ai-info-row__value {
  color: #1e293b;
  font-weight: 600;
}

.ai-info-row__link {
  text-decoration: none;
}

/* ─── Responsive ──────────────────────────────────────── */
@media (max-width: 768px) {
  .ai-hero {
    flex-direction: column;
    padding: 1.5rem;
  }

  .ai-hero__graphic {
    display: none;
  }

  .ai-hero__title {
    font-size: 1.35rem;
  }

  .ai-hero__actions {
    flex-direction: column;
  }

  .ai-btn {
    justify-content: center;
  }
}
</style>
