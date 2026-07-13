<template>
  <CSidebar
    aside
    :show="$store.state.asideShow"
    @update:show="(val) => $store.commit('set', ['asideShow', val])"
    colorScheme="light"
    overlaid
    size="lg"
  >
    <CSidebarClose @click.native="$store.commit('toggle', 'asideShow')" />
    <CTabs tabs class="nav-underline nav-underline-primary">

      <!-- Tab 1: Quick Links -->
      <CTab active>
        <template slot="title">
          <CIcon name="cil-link" />
        </template>

        <div class="aside-tab-body">
          <div class="aside-section-label">AI Engine</div>
          <a href="/ai-engine/dashboard.html" class="aside-link-item aside-link-item--primary">
            <div class="aside-link-item__icon-wrap aside-link-item__icon-wrap--blue">
              <CIcon name="cil-chart-pie" />
            </div>
            <div class="aside-link-item__body">
              <strong>AI Engine Dashboard</strong>
              <span>Upload topologies & generate configurations</span>
            </div>
            <CIcon name="cil-external-link" class="aside-link-item__ext" />
          </a>

          <div class="aside-section-label">Configuration</div>
          <router-link to="/aibasedautomaticnetworkconfigurationsystem/registry" class="aside-link-item" @click.native="closeAside">
            <div class="aside-link-item__icon-wrap aside-link-item__icon-wrap--green">
              <CIcon name="cil-description" />
            </div>
            <div class="aside-link-item__body">
              <strong>Configuration Registry</strong>
              <span>Browse and manage AI-generated configs</span>
            </div>
          </router-link>

          <router-link to="/operations/business" class="aside-link-item" @click.native="closeAside">
            <div class="aside-link-item__icon-wrap aside-link-item__icon-wrap--purple">
              <CIcon name="cil-layers" />
            </div>
            <div class="aside-link-item__body">
              <strong>Network Operations</strong>
              <span>Live stats and pipeline overview</span>
            </div>
          </router-link>

          <div class="aside-section-label">Administration</div>
          <router-link to="/accounts/directory" class="aside-link-item" @click.native="closeAside">
            <div class="aside-link-item__icon-wrap aside-link-item__icon-wrap--amber">
              <CIcon name="cil-user" />
            </div>
            <div class="aside-link-item__body">
              <strong>Account Directory</strong>
              <span>Manage user accounts and access</span>
            </div>
          </router-link>

          <router-link to="/security/permissions/matrix" class="aside-link-item" @click.native="closeAside">
            <div class="aside-link-item__icon-wrap aside-link-item__icon-wrap--red">
              <CIcon name="cil-lock-locked" />
            </div>
            <div class="aside-link-item__body">
              <strong>Permission Matrix</strong>
              <span>Review group access rules</span>
            </div>
          </router-link>

          <router-link to="/security/audit" class="aside-link-item" @click.native="closeAside">
            <div class="aside-link-item__icon-wrap aside-link-item__icon-wrap--gray">
              <CIcon name="cil-list" />
            </div>
            <div class="aside-link-item__body">
              <strong>Audit Explorer</strong>
              <span>Authentication and event logs</span>
            </div>
          </router-link>
        </div>
      </CTab>

      <!-- Tab 2: System Info -->
      <CTab>
        <template slot="title">
          <CIcon name="cil-monitor" />
        </template>

        <div class="aside-tab-body">
          <div class="aside-section-label">Platform</div>

          <div class="aside-info-card">
            <div class="aside-info-row">
              <span class="aside-info-row__label">System</span>
              <span class="aside-info-row__value">AI Net Config System</span>
            </div>
            <div class="aside-info-row">
              <span class="aside-info-row__label">University</span>
              <span class="aside-info-row__value">Mae Fah Luang</span>
            </div>
            <div class="aside-info-row">
              <span class="aside-info-row__label">Department</span>
              <span class="aside-info-row__value">Applied Digital Technology</span>
            </div>
            <div class="aside-info-row">
              <span class="aside-info-row__label">Date</span>
              <span class="aside-info-row__value">{{ todayLabel }}</span>
            </div>
          </div>

          <div class="aside-section-label">Services</div>

          <div class="aside-service-list">
            <div class="aside-service">
              <CIcon name="cil-chart-pie" class="aside-service__icon aside-service__icon--blue" />
              <div class="aside-service__body">
                <strong>AI Engine</strong>
                <span>Topology analysis service</span>
              </div>
              <a href="/ai-engine/dashboard.html" class="aside-service__visit">Visit →</a>
            </div>
            <div class="aside-service">
              <CIcon name="cil-description" class="aside-service__icon aside-service__icon--green" />
              <div class="aside-service__body">
                <strong>Config Registry</strong>
                <span>Configuration storage</span>
              </div>
              <CBadge color="success">Active</CBadge>
            </div>
            <div class="aside-service">
              <CIcon name="cil-shield-alt" class="aside-service__icon aside-service__icon--amber" />
              <div class="aside-service__body">
                <strong>IAM / Security</strong>
                <span>Access control layer</span>
              </div>
              <CBadge color="success">Active</CBadge>
            </div>
          </div>

          <div class="aside-section-label">Supported Topology Types</div>
          <div class="aside-chips">
            <span class="aside-chip aside-chip--blue">GNS3</span>
            <span class="aside-chip aside-chip--green">Packet Tracer</span>
            <span class="aside-chip aside-chip--purple">Visio</span>
            <span class="aside-chip aside-chip--amber">Real Diagram</span>
            <span class="aside-chip aside-chip--red">Hand-Drawn</span>
            <span class="aside-chip aside-chip--teal">Topo File</span>
          </div>
        </div>
      </CTab>

      <!-- Tab 3: Help -->
      <CTab>
        <template slot="title">
          <CIcon name="cil-info" />
        </template>

        <div class="aside-tab-body">
          <div class="aside-section-label">AI Workflow</div>

          <div class="aside-workflow">
            <div class="aside-workflow__step">
              <div class="aside-workflow__num">1</div>
              <div>
                <strong>Upload Topology</strong>
                <p>Upload a network topology image or file via the AI Engine Dashboard.</p>
              </div>
            </div>
            <div class="aside-workflow__step">
              <div class="aside-workflow__num">2</div>
              <div>
                <strong>AI Analysis</strong>
                <p>The AI model identifies devices, links, IP addresses, and network structure.</p>
              </div>
            </div>
            <div class="aside-workflow__step">
              <div class="aside-workflow__num">3</div>
              <div>
                <strong>Config Generation</strong>
                <p>Device configurations are automatically generated based on the detected topology.</p>
              </div>
            </div>
            <div class="aside-workflow__step">
              <div class="aside-workflow__num">4</div>
              <div>
                <strong>Registry Storage</strong>
                <p>Save generated configurations to the registry for review, validation, and deployment.</p>
              </div>
            </div>
          </div>

          <div class="aside-section-label">Quick Start</div>
          <a href="/ai-engine/dashboard.html" class="aside-cta-btn">
            <CIcon name="cil-chart-pie" class="mr-2" />
            Open AI Engine →
          </a>
        </div>
      </CTab>

    </CTabs>
  </CSidebar>
</template>

<script>
export default {
  name: 'TheAside',
  computed: {
    todayLabel () {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).format(new Date())
    }
  },
  methods: {
    closeAside () {
      this.$store.commit('set', ['asideShow', false])
    }
  }
}
</script>

<style scoped>
/* ─── Tab Body ────────────────────────────────────────── */
.aside-tab-body {
  padding: 1rem;
}

/* ─── Section Label ───────────────────────────────────── */
.aside-section-label {
  color: #94a3b8;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 1rem 0 0.5rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid #f1f5f9;
}

.aside-section-label:first-child {
  margin-top: 0;
}

/* ─── Link Items ──────────────────────────────────────── */
.aside-link-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.5rem;
  border-radius: 8px;
  text-decoration: none;
  color: #334155;
  transition: background 0.14s ease;
  margin-bottom: 0.3rem;
  border: 1px solid transparent;
}

.aside-link-item:hover {
  background: #f1f5f9;
  border-color: #e2e8f0;
  color: #0f172a;
  text-decoration: none;
}

.aside-link-item--primary:hover {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.aside-link-item__icon-wrap {
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
}

.aside-link-item__icon-wrap .c-icon {
  width: 15px;
  height: 15px;
}

.aside-link-item__icon-wrap--blue  { background: #eff6ff; color: #2563eb; }
.aside-link-item__icon-wrap--green { background: #f0fdf4; color: #16a34a; }
.aside-link-item__icon-wrap--purple{ background: #f5f3ff; color: #7c3aed; }
.aside-link-item__icon-wrap--amber { background: #fffbeb; color: #d97706; }
.aside-link-item__icon-wrap--red   { background: #fef2f2; color: #dc2626; }
.aside-link-item__icon-wrap--gray  { background: #f8fafc; color: #64748b; }

.aside-link-item__body {
  flex: 1;
  min-width: 0;
}

.aside-link-item__body strong {
  display: block;
  font-size: 0.845rem;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.aside-link-item__body span {
  display: block;
  font-size: 0.76rem;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.aside-link-item__ext {
  flex: 0 0 13px;
  width: 13px;
  height: 13px;
  color: #cbd5e1;
}

/* ─── Info Card ───────────────────────────────────────── */
.aside-info-card {
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  margin-bottom: 0.75rem;
}

.aside-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.3rem 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.82rem;
}

.aside-info-row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.aside-info-row__label {
  color: #94a3b8;
  font-weight: 500;
}

.aside-info-row__value {
  color: #334155;
  font-weight: 600;
  text-align: right;
}

/* ─── Service List ────────────────────────────────────── */
.aside-service-list {
  display: grid;
  gap: 0.45rem;
  margin-bottom: 0.75rem;
}

.aside-service {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid #e8eef7;
  border-radius: 7px;
  background: #f9fbfd;
}

.aside-service__icon {
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
}

.aside-service__icon--blue   { color: #2563eb; }
.aside-service__icon--green  { color: #16a34a; }
.aside-service__icon--amber  { color: #d97706; }

.aside-service__body {
  flex: 1;
  min-width: 0;
}

.aside-service__body strong {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: #1e293b;
}

.aside-service__body span {
  display: block;
  font-size: 0.74rem;
  color: #94a3b8;
}

.aside-service__visit {
  flex: 0 0 auto;
  font-size: 0.75rem;
  font-weight: 600;
  color: #2563eb;
  text-decoration: none;
  white-space: nowrap;
}

.aside-service__visit:hover {
  text-decoration: underline;
}

/* ─── Chips ───────────────────────────────────────────── */
.aside-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.aside-chip {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.73rem;
  font-weight: 600;
  border: 1px solid transparent;
}

.aside-chip--blue   { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
.aside-chip--green  { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
.aside-chip--purple { background: #f5f3ff; color: #7c3aed; border-color: #ddd6fe; }
.aside-chip--amber  { background: #fffbeb; color: #b45309; border-color: #fde68a; }
.aside-chip--red    { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
.aside-chip--teal   { background: #f0fdfa; color: #0d9488; border-color: #99f6e4; }

/* ─── Workflow ────────────────────────────────────────── */
.aside-workflow {
  display: grid;
  gap: 0.8rem;
  margin-bottom: 1rem;
}

.aside-workflow__step {
  display: flex;
  gap: 0.7rem;
}

.aside-workflow__num {
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #2563eb;
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 700;
  margin-top: 1px;
}

.aside-workflow__step strong {
  display: block;
  font-size: 0.845rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.2rem;
}

.aside-workflow__step p {
  margin: 0;
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.45;
}

/* ─── CTA Button ──────────────────────────────────────── */
.aside-cta-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  background: #2563eb;
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s ease;
  width: 100%;
}

.aside-cta-btn:hover {
  background: #1d4ed8;
  color: #ffffff;
  text-decoration: none;
}
</style>
