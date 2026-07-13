<template>
  <div class="netops-page">

    <!-- Page Header -->
    <div class="netops-header">
      <div>
        <div class="netops-header__eyebrow">AI-Based Automatic Network Configuration System</div>
        <h1>Network Operations Dashboard</h1>
        <div class="netops-header__meta">
          Real-time overview of configuration generation activity · Last updated: {{ lastUpdatedLabel }}
        </div>
      </div>
      <div class="netops-header__actions">
        <CButton color="primary" variant="outline" :disabled="loading" @click="refresh">
          <CIcon name="cil-reload" class="mr-2" />
          Refresh
        </CButton>
        <router-link class="btn btn-outline-secondary" to="/aibasedautomaticnetworkconfigurationsystem/registry">
          <CIcon name="cil-description" class="mr-2" />
          Configuration Registry
        </router-link>
        <a href="/ai-engine/dashboard.html" class="btn btn-outline-primary">
          <CIcon name="cil-chart-pie" class="mr-2" />
          AI Engine
        </a>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="errorMessage" class="alert alert-warning mb-3">
      <CIcon name="cil-warning" class="mr-2" />
      {{ errorMessage }}
    </div>

    <!-- Live Metric Cards -->
    <CRow class="mb-3">
      <CCol v-for="metric in metricCards" :key="metric.key" xl="3" md="6" col="12" class="mb-3">
        <CCard class="netops-metric" :class="`netops-metric--${metric.accent}`">
          <CCardBody>
            <div class="netops-metric__top">
              <div class="netops-metric__label">{{ metric.label }}</div>
              <CIcon :name="metric.icon" />
            </div>
            <div class="netops-metric__value">
              <template v-if="loading">—</template>
              <template v-else>{{ metric.value }}</template>
            </div>
            <div class="netops-metric__hint">{{ metric.hint }}</div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CRow>
      <!-- Configuration Pipeline -->
      <CCol lg="8" class="mb-3">
        <CCard class="netops-card h-100">
          <CCardBody>
            <div class="netops-section-heading">
              <div>
                <h2>Configuration Pipeline</h2>
                <span>Status distribution across all registry records</span>
              </div>
            </div>

            <div class="netops-pipeline-tabs">
              <button
                v-for="stage in pipelineStages"
                :key="stage.id"
                type="button"
                class="netops-pipeline-tab"
                :class="{ 'is-active': activePipelineId === stage.id }"
                :aria-pressed="activePipelineId === stage.id ? 'true' : 'false'"
                @click="setStage(stage.id)"
              >
                <span>{{ stage.name }}</span>
                <strong>
                  <template v-if="loading">—</template>
                  <template v-else>{{ stage.count }}</template>
                </strong>
              </button>
            </div>

            <div class="netops-active-stage">
              <div>
                <div class="netops-active-stage__label">Stage Focus</div>
                <h3>{{ activeStage.name }}</h3>
                <p>{{ activeStage.description }}</p>
              </div>
              <div
                class="netops-progress"
                :aria-label="`${activeStagePercent}% of total`"
                :title="`${activeStagePercent}% of all configurations`"
              >
                <div class="netops-progress__bar" :style="{ width: activeStagePercent + '%' }"></div>
              </div>
              <div class="netops-progress__label">{{ activeStagePercent }}% of total configurations</div>
            </div>
          </CCardBody>
        </CCard>
      </CCol>

      <!-- System Connections -->
      <CCol lg="4" class="mb-3">
        <CCard class="netops-card h-100">
          <CCardBody>
            <div class="netops-section-heading">
              <div>
                <h2>System Connections</h2>
                <span>Core services of the platform</span>
              </div>
            </div>
            <div class="netops-service-list">
              <div v-for="service in systemServices" :key="service.name" class="netops-service">
                <div>
                  <strong>{{ service.name }}</strong>
                  <span>{{ service.description }}</span>
                </div>
                <div class="netops-service__badge-wrap">
                  <a v-if="service.link" :href="service.link" class="netops-service__link">
                    <CBadge :color="service.badgeColor">{{ service.badge }}</CBadge>
                  </a>
                  <CBadge v-else :color="service.badgeColor">{{ service.badge }}</CBadge>
                </div>
              </div>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CRow>
      <!-- Recent Configurations Table -->
      <CCol lg="7" class="mb-3">
        <CCard class="netops-card h-100">
          <CCardBody>
            <div class="netops-section-heading">
              <div>
                <h2>Recent Configurations</h2>
                <span>Latest records in the Configuration Registry</span>
              </div>
              <router-link to="/aibasedautomaticnetworkconfigurationsystem/registry" class="netops-view-all">
                View all →
              </router-link>
            </div>

            <div class="netops-table-wrap">
              <table class="netops-table">
                <thead>
                  <tr>
                    <th>Config ID</th>
                    <th>Topology Name</th>
                    <th>Topology Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="loading">
                    <td colspan="4" class="netops-empty">Loading configurations…</td>
                  </tr>
                  <tr v-else-if="!recentDocs.length">
                    <td colspan="4" class="netops-empty">
                      No configurations yet.
                      <router-link to="/aibasedautomaticnetworkconfigurationsystem/registry">Create one →</router-link>
                    </td>
                  </tr>
                  <tr v-for="doc in recentDocs" :key="doc._id">
                    <td>
                      <strong class="netops-mono">{{ doc.aibasedautomaticnetworkconfigurationsystemNo }}</strong>
                    </td>
                    <td>
                      <strong>{{ doc.title }}</strong>
                      <span>{{ doc.ownerUnit || '—' }}</span>
                    </td>
                    <td>{{ doc.partnerName || '—' }}</td>
                    <td>
                      <CBadge :color="statusColor(doc.status)">{{ statusLabel(doc.status) }}</CBadge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CCardBody>
        </CCard>
      </CCol>

      <!-- Supported Topology Sources -->
      <CCol lg="5" class="mb-3">
        <CCard class="netops-card h-100">
          <CCardBody>
            <div class="netops-section-heading">
              <div>
                <h2>Supported Topology Sources</h2>
                <span>Upload any of these topology types to the AI Engine</span>
              </div>
            </div>
            <div class="netops-source-grid">
              <div
                v-for="source in topologySources"
                :key="source.label"
                class="netops-source-chip"
                :class="`netops-source-chip--${source.accent}`"
              >
                <CIcon :name="source.icon" class="mr-1" />
                {{ source.label }}
              </div>
            </div>

            <div class="netops-ai-cta">
              <CIcon name="cil-chart-pie" class="netops-ai-cta__icon" />
              <div>
                <strong>Ready to generate configurations?</strong>
                <span>Upload a network topology diagram to the AI Engine.</span>
              </div>
              <a href="/ai-engine/dashboard.html" class="netops-ai-cta__btn">
                Open AI Engine →
              </a>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  </div>
</template>

<script>
import api from '@/service/api'

const STATUS_MAP = {
  draft: { label: 'Draft', color: 'secondary' },
  review: { label: 'Under Review', color: 'warning' },
  active: { label: 'Deployed', color: 'success' },
  expiring: { label: 'Needs Update', color: 'danger' },
  expired: { label: 'Deprecated', color: 'dark' },
  archived: { label: 'Archived', color: 'secondary' }
}

export default {
  name: 'NetworkOperations',
  data () {
    return {
      loading: false,
      errorMessage: '',
      lastUpdated: new Date(),
      activePipelineId: 'draft',
      stats: {
        total: 0,
        active: 0,
        review: 0,
        expiring: 0,
        expired: 0
      },
      recentDocs: [],
      topologySources: [
        { label: 'GNS3', icon: 'cil-image', accent: 'blue' },
        { label: 'Packet Tracer', icon: 'cil-image1', accent: 'green' },
        { label: 'Visio Diagram', icon: 'cil-file', accent: 'purple' },
        { label: 'Real Diagram', icon: 'cil-camera', accent: 'amber' },
        { label: 'Hand-Drawn', icon: 'cil-pencil', accent: 'red' },
        { label: 'Topology File', icon: 'cil-cloud-upload', accent: 'teal' }
      ],
      systemServices: [
        {
          name: 'AI Engine',
          description: 'Topology analysis & config generation',
          badge: 'Visit',
          badgeColor: 'primary',
          link: '/ai-engine/dashboard.html'
        },
        {
          name: 'Configuration Registry',
          description: 'Store and manage generated configurations',
          badge: 'Active',
          badgeColor: 'success',
          link: null
        },
        {
          name: 'Account Management',
          description: 'User access and permissions control',
          badge: 'Active',
          badgeColor: 'success',
          link: null
        },
        {
          name: 'Audit Explorer',
          description: 'Track authentication and system events',
          badge: 'Active',
          badgeColor: 'success',
          link: null
        }
      ]
    }
  },
  computed: {
    metricCards () {
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
    pipelineStages () {
      return [
        {
          id: 'draft',
          name: 'Draft',
          count: Math.max(0, this.stats.total - this.stats.active - this.stats.review - this.stats.expiring - (this.stats.expired || 0)),
          description: 'Newly created configuration records that have not yet entered the validation workflow.'
        },
        {
          id: 'review',
          name: 'Under Review',
          count: this.stats.review,
          description: 'Configurations currently under technical validation before deployment approval.'
        },
        {
          id: 'active',
          name: 'Deployed',
          count: this.stats.active,
          description: 'Validated configurations that have been successfully deployed to the target network environment.'
        },
        {
          id: 'expiring',
          name: 'Needs Update',
          count: this.stats.expiring,
          description: 'Configurations that are outdated or require revision due to network topology changes.'
        }
      ]
    },
    activeStage () {
      return this.pipelineStages.find(s => s.id === this.activePipelineId) || this.pipelineStages[0]
    },
    activeStagePercent () {
      if (!this.stats.total) return 0
      return Math.round((this.activeStage.count / this.stats.total) * 100)
    },
    lastUpdatedLabel () {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }).format(this.lastUpdated)
    }
  },
  mounted () {
    this.refresh()
  },
  methods: {
    async refresh () {
      this.loading = true
      this.errorMessage = ''
      this.lastUpdated = new Date()
      try {
        await Promise.all([this.fetchStats(), this.fetchRecentDocs()])
      } finally {
        this.loading = false
      }
    },
    async fetchStats () {
      try {
        const response = await api.aibasedautomaticnetworkconfigurationsystemDocuments('stats')
        if (response && response.data && response.data.data) {
          this.stats = Object.assign({}, this.stats, response.data.data)
        }
      } catch (err) {
        this.errorMessage = 'Could not load configuration statistics. The registry may be empty or unavailable.'
      }
    },
    async fetchRecentDocs () {
      try {
        const response = await api.aibasedautomaticnetworkconfigurationsystemDocuments('list', { limit: 5 })
        if (response && response.data && response.data.data) {
          const data = response.data.data
          this.recentDocs = Array.isArray(data.rows) ? data.rows : []
        }
      } catch (err) {
        // Non-critical — table shows empty state
      }
    },
    setStage (stageId) {
      this.activePipelineId = stageId
    },
    statusLabel (status) {
      return (STATUS_MAP[status] && STATUS_MAP[status].label) || status || '—'
    },
    statusColor (status) {
      return (STATUS_MAP[status] && STATUS_MAP[status].color) || 'secondary'
    }
  }
}
</script>

<style scoped>
.netops-page {
  padding: 0.25rem;
}

/* ─── Header ──────────────────────────────────────────── */
.netops-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding: 1.1rem 1.25rem;
  border: 1px solid #d9e2ef;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 4px 16px rgba(34, 45, 70, 0.06);
}

.netops-header__eyebrow {
  color: #64748b;
  font-size: 0.73rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 0.2rem;
}

.netops-header h1 {
  margin: 0.1rem 0;
  color: #0f172a;
  font-size: 1.45rem;
  font-weight: 700;
}

.netops-header__meta {
  color: #64748b;
  font-size: 0.84rem;
  margin-top: 0.15rem;
}

.netops-header__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

/* ─── Metric Cards ────────────────────────────────────── */
.netops-metric {
  min-height: 130px;
  border: 1px solid #dfe7f2;
  border-left-width: 5px;
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(34, 45, 70, 0.05);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.netops-metric:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(34, 45, 70, 0.1);
}

.netops-metric--blue { border-left-color: #2563eb; }
.netops-metric--green { border-left-color: #16a34a; }
.netops-metric--amber { border-left-color: #d97706; }
.netops-metric--red { border-left-color: #dc2626; }

.netops-metric__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 0.4rem;
}

.netops-metric__label {
  color: #6b778c;
  font-size: 0.73rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.netops-metric__top .c-icon {
  color: #94a3b8;
  width: 18px;
  height: 18px;
}

.netops-metric__value {
  color: #0f172a;
  font-size: 1.85rem;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 0.35rem;
}

.netops-metric__hint {
  color: #64748b;
  font-size: 0.82rem;
}

/* ─── General Card ────────────────────────────────────── */
.netops-card {
  border: 1px solid #dfe7f2;
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(34, 45, 70, 0.055);
}

/* ─── Section Heading ─────────────────────────────────── */
.netops-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.netops-section-heading h2 {
  margin: 0;
  color: #0f172a;
  font-size: 1rem;
  font-weight: 700;
}

.netops-section-heading span {
  color: #64748b;
  font-size: 0.82rem;
}

.netops-view-all {
  flex: 0 0 auto;
  color: #2563eb;
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.netops-view-all:hover {
  text-decoration: underline;
}

/* ─── Pipeline Tabs ───────────────────────────────────── */
.netops-pipeline-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.netops-pipeline-tab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 46px;
  padding: 0.65rem 0.8rem;
  border: 1px solid #d8e0eb;
  border-radius: 8px;
  background: #f8fafc;
  color: #334155;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.netops-pipeline-tab:hover {
  border-color: #94a3b8;
  background: #f1f5f9;
}

.netops-pipeline-tab.is-active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #1d4ed8;
}

.netops-pipeline-tab strong {
  font-size: 1.05rem;
}

/* ─── Active Stage ────────────────────────────────────── */
.netops-active-stage {
  padding: 0.9rem 1rem;
  border: 1px solid #d8e0eb;
  border-radius: 8px;
  background: #fbfcfe;
}

.netops-active-stage__label {
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-bottom: 0.15rem;
}

.netops-active-stage h3 {
  margin: 0 0 0.3rem;
  color: #0f172a;
  font-size: 1rem;
  font-weight: 700;
}

.netops-active-stage p {
  color: #475569;
  font-size: 0.86rem;
  line-height: 1.5;
  margin-bottom: 0.85rem;
}

.netops-progress {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e2e8f0;
  margin-bottom: 0.4rem;
}

.netops-progress__bar {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #2563eb, #6366f1);
  transition: width 0.4s ease;
}

.netops-progress__label {
  color: #64748b;
  font-size: 0.78rem;
  text-align: right;
}

/* ─── Service List ────────────────────────────────────── */
.netops-service-list {
  display: grid;
  gap: 0.7rem;
}

.netops-service {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid #e8eef7;
  border-radius: 8px;
  background: #f9fbfd;
}

.netops-service strong,
.netops-service span {
  display: block;
}

.netops-service strong {
  color: #1e293b;
  font-size: 0.875rem;
}

.netops-service span {
  color: #64748b;
  font-size: 0.78rem;
}

.netops-service__badge-wrap {
  flex: 0 0 auto;
}

.netops-service__link {
  text-decoration: none;
}

/* ─── Recent Configs Table ────────────────────────────── */
.netops-table-wrap {
  overflow-x: auto;
}

.netops-table {
  width: 100%;
  border-collapse: collapse;
}

.netops-table th {
  color: #516072;
  font-size: 0.74rem;
  font-weight: 700;
  text-align: left;
  text-transform: uppercase;
  padding: 0.65rem 0.6rem;
  border-bottom: 1px solid #e5ebf3;
}

.netops-table td {
  color: #273449;
  padding: 0.7rem 0.6rem;
  border-bottom: 1px solid #edf1f7;
  vertical-align: top;
  font-size: 0.875rem;
}

.netops-table td strong,
.netops-table td span {
  display: block;
}

.netops-table td span {
  color: #64748b;
  font-size: 0.8rem;
}

.netops-mono {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.8rem;
  color: #2563eb;
}

.netops-empty {
  color: #64748b;
  text-align: center;
  padding: 2rem !important;
  font-size: 0.9rem;
}

/* ─── Topology Source Chips ───────────────────────────── */
.netops-source-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.netops-source-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid transparent;
}

.netops-source-chip .c-icon {
  width: 13px;
  height: 13px;
}

.netops-source-chip--blue { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
.netops-source-chip--green { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
.netops-source-chip--purple { background: #f5f3ff; color: #7c3aed; border-color: #ddd6fe; }
.netops-source-chip--amber { background: #fffbeb; color: #b45309; border-color: #fde68a; }
.netops-source-chip--red { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
.netops-source-chip--teal { background: #f0fdfa; color: #0d9488; border-color: #99f6e4; }

/* ─── AI CTA Box ──────────────────────────────────────── */
.netops-ai-cta {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 0.9rem 1rem;
  border-radius: 8px;
  background: linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%);
  border: 1px solid #c7d2fe;
}

.netops-ai-cta__icon {
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  color: #4f46e5;
  margin-top: 2px;
}

.netops-ai-cta strong,
.netops-ai-cta span {
  display: block;
}

.netops-ai-cta strong {
  color: #1e293b;
  font-size: 0.875rem;
  margin-bottom: 0.15rem;
}

.netops-ai-cta span {
  color: #475569;
  font-size: 0.8rem;
}

.netops-ai-cta__btn {
  flex: 0 0 auto;
  align-self: center;
  display: inline-block;
  padding: 0.4rem 0.85rem;
  border-radius: 6px;
  background: #4f46e5;
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s ease;
}

.netops-ai-cta__btn:hover {
  background: #4338ca;
  color: #ffffff;
  text-decoration: none;
}

/* ─── Responsive ──────────────────────────────────────── */
@media (max-width: 991.98px) {
  .netops-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .netops-pipeline-tabs {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 575.98px) {
  .netops-pipeline-tabs {
    grid-template-columns: 1fr;
  }
}
</style>
