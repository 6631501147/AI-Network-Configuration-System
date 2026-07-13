<template>
  <div class="registry-page">
    <!-- Page Header -->
    <div class="registry-header">
      <div>
        <div class="registry-header__eyebrow">AI-Based Automatic Network Configuration System</div>
        <h1>Configuration Registry</h1>
        <p>Store, manage, and track AI-generated network configurations. Each record represents a topology analysis result linked to a specific network environment.</p>
      </div>
      <div class="registry-header__actions">
        <CButton color="primary" variant="outline" :disabled="loading" @click="fetchAll">
          <CIcon name="cil-reload" class="mr-2" />
          Refresh
        </CButton>
        <a href="/ai-engine/dashboard.html" class="btn btn-outline-secondary">
          <CIcon name="cil-chart-pie" class="mr-2" />
          AI Engine
        </a>
      </div>
    </div>

    <!-- Stat Cards -->
    <CRow class="mb-3">
      <CCol v-for="item in statCards" :key="item.key" xl="3" md="6" class="mb-3">
        <CCard class="registry-stat" :class="`registry-stat--${item.accent}`">
          <CCardBody>
            <div class="registry-stat__label">{{ item.label }}</div>
            <div class="registry-stat__value">{{ item.value }}</div>
            <div class="registry-stat__hint">{{ item.hint }}</div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CRow>
      <!-- Create / Edit Form -->
      <CCol lg="4" class="mb-3">
        <CCard class="registry-card h-100">
          <CCardBody>
            <h2>{{ form._id ? 'Update Configuration' : 'Create Configuration' }}</h2>

            <div class="registry-form-group">
              <label class="registry-label">Configuration ID <span class="registry-required">*</span></label>
              <CInput v-model.trim="form.aibasedautomaticnetworkconfigurationsystemNo" placeholder="CFG-2026-001" />
              <small class="registry-hint">Unique identifier for this configuration record.</small>
            </div>

            <div class="registry-form-group">
              <label class="registry-label">Topology Name <span class="registry-required">*</span></label>
              <CInput v-model.trim="form.title" placeholder="Campus Network - Building A" />
              <small class="registry-hint">Descriptive name of the network topology.</small>
            </div>

            <div class="registry-form-group">
              <label class="registry-label">Topology Type <span class="registry-required">*</span></label>
              <CSelect v-model="form.partnerName" :options="topologyTypeOptions" />
              <small class="registry-hint">Source type of the topology diagram.</small>
            </div>

            <div class="registry-form-group">
              <label class="registry-label">Network Category</label>
              <CSelect v-model="form.partnerType" :options="networkCategoryOptions" />
              <small class="registry-hint">General network architecture category.</small>
            </div>

            <div class="registry-form-group">
              <label class="registry-label">Network Environment / Site</label>
              <CInput v-model.trim="form.country" placeholder="e.g. MFU Campus, Branch Office, Lab" />
              <small class="registry-hint">Physical or logical environment where this configuration applies.</small>
            </div>

            <div class="registry-form-group">
              <label class="registry-label">Responsible Department</label>
              <CInput v-model.trim="form.ownerUnit" placeholder="e.g. Network Engineering, IT Operations" />
            </div>

            <div class="registry-form-group">
              <label class="registry-label">Created By</label>
              <CInput v-model.trim="form.coordinatorName" placeholder="Engineer name or team" />
            </div>

            <div class="registry-form-group">
              <label class="registry-label">Contact Email</label>
              <CInput v-model.trim="form.coordinatorEmail" type="email" placeholder="netops@example.ac.th" />
            </div>

            <div class="registry-form-group">
              <label class="registry-label">Status</label>
              <CSelect v-model="form.status" :options="statusOptions" />
            </div>

            <div class="registry-form-row">
              <div class="registry-form-group">
                <label class="registry-label">Created Date</label>
                <CInput v-model="form.effectiveDate" type="date" />
              </div>
              <div class="registry-form-group">
                <label class="registry-label">Review Date</label>
                <CInput v-model="form.expiryDate" type="date" />
              </div>
            </div>

            <div class="registry-form-group">
              <label class="registry-label">Tags</label>
              <CInput v-model.trim="form.tags" placeholder="campus, lan, ospf" />
              <small class="registry-hint">Comma-separated tags for search and filtering.</small>
            </div>

            <div class="registry-form-group">
              <label class="registry-label">Notes</label>
              <CTextarea v-model.trim="form.notes" rows="3" placeholder="Additional notes or deployment instructions…" />
            </div>

            <div v-if="formError" class="alert alert-danger registry-form-error">{{ formError }}</div>

            <div class="registry-form-actions">
              <CButton color="primary" :disabled="saving" @click="saveDocument">
                <CIcon name="cil-save" class="mr-2" />
                {{ form._id ? 'Update' : 'Create' }}
              </CButton>
              <CButton color="secondary" variant="outline" @click="resetForm">Clear</CButton>
            </div>
          </CCardBody>
        </CCard>
      </CCol>

      <!-- Registry Table -->
      <CCol lg="8" class="mb-3">
        <CCard class="registry-card h-100">
          <CCardBody>
            <!-- Search Toolbar -->
            <div class="registry-toolbar">
              <CInput
                v-model.trim="filters.q"
                placeholder="Search by Config ID, topology name, site, department…"
                class="registry-search"
                @keyup.enter="fetchDocuments"
              />
              <CSelect
                v-model="filters.status"
                :options="filterStatusOptions"
                class="registry-status-filter"
              />
              <CButton color="primary" @click="fetchDocuments">Search</CButton>
            </div>

            <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

            <!-- Table -->
            <div class="registry-table-wrap">
              <table class="registry-table">
                <thead>
                  <tr>
                    <th>Configuration ID</th>
                    <th>Topology Name</th>
                    <th>Topology Type</th>
                    <th>Network Site</th>
                    <th>Status</th>
                    <th>Created Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="loading">
                    <td colspan="7" class="registry-empty">
                      <CIcon name="cil-reload" class="registry-loading-icon" />
                      Loading configurations…
                    </td>
                  </tr>
                  <tr v-else-if="!documents.length">
                    <td colspan="7" class="registry-empty">
                      No configurations found.
                      <span v-if="filters.q || filters.status !== 'all'">Try clearing the search filters.</span>
                      <span v-else>Use the form on the left or the AI Engine to generate the first configuration.</span>
                    </td>
                  </tr>
                  <tr v-for="item in documents" :key="item._id" class="registry-row">
                    <td>
                      <span class="registry-config-id">{{ item.aibasedautomaticnetworkconfigurationsystemNo }}</span>
                    </td>
                    <td>
                      <strong>{{ item.title }}</strong>
                      <span v-if="item.ownerUnit" class="registry-sub">{{ item.ownerUnit }}</span>
                    </td>
                    <td>
                      <span class="registry-type-chip">{{ item.partnerName || '—' }}</span>
                    </td>
                    <td>
                      <span>{{ item.country || '—' }}</span>
                      <span v-if="item.partnerType" class="registry-sub">{{ item.partnerType }}</span>
                    </td>
                    <td>
                      <CBadge :color="statusColor(item.status)">{{ statusLabel(item.status) }}</CBadge>
                    </td>
                    <td>
                      <span>{{ formatDate(item.effectiveDate) }}</span>
                    </td>
                    <td class="registry-row-actions">
                      <CButton size="sm" color="primary" variant="outline" title="Edit" @click="editDocument(item)">
                        <CIcon name="cil-pencil" />
                      </CButton>
                      <CButton size="sm" color="danger" variant="outline" title="Delete" @click="removeDocument(item)">
                        <CIcon name="cil-trash" />
                      </CButton>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Results count -->
            <div v-if="!loading && documents.length" class="registry-results-count">
              Showing {{ documents.length }} configuration{{ documents.length !== 1 ? 's' : '' }}
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  </div>
</template>

<script>
import api from '@/service/api'

const TOPOLOGY_TYPES = [
  'GNS3 Topology Image',
  'Packet Tracer Screenshot',
  'Visio Network Diagram',
  'Real Network Diagram',
  'Hand-Drawn Sketch',
  'Topology File (.gns3)',
  'Topology File (.pkt)',
  'Other'
]

const NETWORK_CATEGORIES = [
  'LAN',
  'WAN',
  'Campus Network',
  'Data Center',
  'Branch Office',
  'Home Lab',
  'Industrial Network',
  'Hybrid / Multi-Site',
  'Other'
]

const EMPTY_FORM = {
  _id: '',
  aibasedautomaticnetworkconfigurationsystemNo: '',
  title: '',
  partnerName: 'GNS3 Topology Image',
  partnerType: 'LAN',
  country: '',
  ownerUnit: '',
  coordinatorName: '',
  coordinatorEmail: '',
  status: 'draft',
  effectiveDate: '',
  expiryDate: '',
  tags: '',
  notes: ''
}

function unwrap (response) {
  return response && response.data && response.data.data ? response.data.data : {}
}

function toInputDate (value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export default {
  name: 'AIBasedAutomaticNetworkConfigurationSystemRegistry',
  data () {
    return {
      loading: false,
      saving: false,
      errorMessage: '',
      formError: '',
      documents: [],
      stats: { total: 0, active: 0, review: 0, expiring: 0, expired: 0 },
      filters: { q: '', status: 'all' },
      form: Object.assign({}, EMPTY_FORM),
      topologyTypeOptions: TOPOLOGY_TYPES.map(t => ({ label: t, value: t })),
      networkCategoryOptions: NETWORK_CATEGORIES.map(c => ({ label: c, value: c })),
      statusOptions: [
        { label: 'Draft', value: 'draft' },
        { label: 'Under Review', value: 'review' },
        { label: 'Deployed', value: 'active' },
        { label: 'Needs Update', value: 'expiring' },
        { label: 'Deprecated', value: 'expired' },
        { label: 'Archived', value: 'archived' }
      ],
      filterStatusOptions: [
        { label: 'All Statuses', value: 'all' },
        { label: 'Draft', value: 'draft' },
        { label: 'Under Review', value: 'review' },
        { label: 'Deployed', value: 'active' },
        { label: 'Needs Update', value: 'expiring' },
        { label: 'Deprecated', value: 'expired' },
        { label: 'Archived', value: 'archived' }
      ]
    }
  },
  computed: {
    statCards () {
      return [
        { key: 'total', label: 'Total Configurations', value: this.stats.total, hint: 'All registry records', accent: 'blue' },
        { key: 'active', label: 'Deployed', value: this.stats.active, hint: 'Active and validated', accent: 'green' },
        { key: 'review', label: 'Under Review', value: this.stats.review, hint: 'Awaiting validation', accent: 'amber' },
        { key: 'expiring', label: 'Needs Update', value: this.stats.expiring, hint: 'Outdated configurations', accent: 'red' }
      ]
    }
  },
  mounted () {
    this.fetchAll()
  },
  methods: {
    async fetchAll () {
      await Promise.all([this.fetchStats(), this.fetchDocuments()])
    },
    async fetchStats () {
      try {
        const response = await api.aibasedautomaticnetworkconfigurationsystemDocuments('stats')
        this.stats = Object.assign({}, this.stats, unwrap(response))
      } catch (err) {
        // Stats non-critical
      }
    },
    async fetchDocuments () {
      this.loading = true
      this.errorMessage = ''
      try {
        const response = await api.aibasedautomaticnetworkconfigurationsystemDocuments('list', {
          q: this.filters.q,
          status: this.filters.status,
          limit: 100
        })
        const data = unwrap(response)
        this.documents = Array.isArray(data.rows) ? data.rows : []
      } catch (err) {
        this.errorMessage = 'Unable to load configurations. Please try again.'
      } finally {
        this.loading = false
      }
    },
    async saveDocument () {
      this.formError = ''
      if (!this.form.aibasedautomaticnetworkconfigurationsystemNo || !this.form.title || !this.form.partnerName) {
        this.formError = 'Configuration ID, Topology Name, and Topology Type are required.'
        return
      }
      this.saving = true
      try {
        const payload = Object.assign({}, this.form, {
          tags: String(this.form.tags || '').split(',').map(t => t.trim()).filter(Boolean)
        })
        if (payload._id) {
          payload.id = payload._id
          await api.aibasedautomaticnetworkconfigurationsystemDocuments('update', payload)
        } else {
          await api.aibasedautomaticnetworkconfigurationsystemDocuments('create', payload)
        }
        this.resetForm()
        await this.fetchAll()
      } catch (err) {
        this.formError = err && err.response && err.response.data && err.response.data.message
          ? err.response.data.message
          : 'Unable to save the configuration. Please check the fields and try again.'
      } finally {
        this.saving = false
      }
    },
    editDocument (item) {
      this.formError = ''
      this.form = Object.assign({}, EMPTY_FORM, item, {
        effectiveDate: toInputDate(item.effectiveDate),
        expiryDate: toInputDate(item.expiryDate),
        tags: Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || '')
      })
      // Scroll to form
      this.$nextTick(() => {
        const el = this.$el && this.$el.querySelector('.registry-card')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    },
    async removeDocument (item) {
      if (!item || !item._id) return
      if (!window.confirm(`Delete configuration "${item.aibasedautomaticnetworkconfigurationsystemNo} — ${item.title}"?\n\nThis action cannot be undone.`)) return
      this.saving = true
      this.errorMessage = ''
      try {
        await api.aibasedautomaticnetworkconfigurationsystemDocuments('delete', item)
        await this.fetchAll()
      } catch (err) {
        this.errorMessage = 'Unable to delete this configuration.'
      } finally {
        this.saving = false
      }
    },
    resetForm () {
      this.form = Object.assign({}, EMPTY_FORM)
      this.formError = ''
    },
    formatDate (value) {
      if (!value) return '—'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return '—'
      return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
    },
    statusLabel (status) {
      const match = this.statusOptions.find(o => o.value === status)
      return match ? match.label : (status || '—')
    },
    statusColor (status) {
      return {
        draft: 'secondary',
        review: 'warning',
        active: 'success',
        expiring: 'danger',
        expired: 'dark',
        archived: 'secondary'
      }[status] || 'secondary'
    }
  }
}
</script>

<style scoped>
/* ─── Page ────────────────────────────────────────────── */
.registry-page {
  padding: 0.25rem;
}

/* ─── Header ──────────────────────────────────────────── */
.registry-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.registry-header__eyebrow {
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 0.2rem;
}

.registry-header h1 {
  margin: 0.1rem 0 0.4rem;
  color: #0f172a;
  font-size: 1.65rem;
  font-weight: 800;
}

.registry-header p {
  max-width: 640px;
  margin: 0;
  color: #475569;
  font-size: 0.9rem;
  line-height: 1.55;
}

.registry-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  flex: 0 0 auto;
}

/* ─── Stat Cards ──────────────────────────────────────── */
.registry-stat {
  border: 0;
  border-left: 4px solid transparent;
  border-radius: 10px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.07);
  transition: transform 0.18s ease;
}

.registry-stat:hover {
  transform: translateY(-2px);
}

.registry-stat--blue { border-left-color: #2563eb; }
.registry-stat--green { border-left-color: #16a34a; }
.registry-stat--amber { border-left-color: #d97706; }
.registry-stat--red { border-left-color: #dc2626; }

.registry-stat__label {
  color: #64748b;
  font-size: 0.73rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.registry-stat__value {
  margin: 0.4rem 0 0.2rem;
  color: #0f172a;
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1;
}

.registry-stat__hint {
  color: #64748b;
  font-size: 0.8rem;
}

/* ─── General Card ────────────────────────────────────── */
.registry-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
}

.registry-card h2 {
  margin-bottom: 1.1rem;
  color: #0f172a;
  font-size: 1rem;
  font-weight: 700;
}

/* ─── Form ────────────────────────────────────────────── */
.registry-form-group {
  margin-bottom: 0.85rem;
}

.registry-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.registry-label {
  display: block;
  margin-bottom: 0.3rem;
  color: #334155;
  font-size: 0.82rem;
  font-weight: 600;
}

.registry-required {
  color: #dc2626;
  margin-left: 2px;
}

.registry-hint {
  display: block;
  margin-top: 0.2rem;
  color: #94a3b8;
  font-size: 0.75rem;
  line-height: 1.4;
}

.registry-form-error {
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
}

.registry-form-actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.25rem;
}

/* ─── Toolbar ─────────────────────────────────────────── */
.registry-toolbar {
  display: grid;
  grid-template-columns: 1fr 180px auto;
  gap: 0.65rem;
  align-items: start;
  margin-bottom: 1rem;
}

/* ─── Table ───────────────────────────────────────────── */
.registry-table-wrap {
  overflow-x: auto;
}

.registry-table {
  width: 100%;
  border-collapse: collapse;
}

.registry-table th {
  color: #64748b;
  font-size: 0.73rem;
  font-weight: 700;
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.6rem 0.75rem;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
}

.registry-table td {
  padding: 0.75rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
  font-size: 0.875rem;
  color: #334155;
}

.registry-row:hover td {
  background: #f8fafc;
}

.registry-config-id {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.8rem;
  color: #2563eb;
  font-weight: 600;
}

.registry-table td strong {
  display: block;
  color: #1e293b;
  font-weight: 600;
}

.registry-sub {
  display: block;
  color: #94a3b8;
  font-size: 0.78rem;
  margin-top: 0.1rem;
}

.registry-type-chip {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 5px;
  background: #f1f5f9;
  color: #475569;
  font-size: 0.78rem;
  font-weight: 600;
}

.registry-row-actions {
  display: flex;
  gap: 0.4rem;
  white-space: nowrap;
}

.registry-empty {
  color: #94a3b8;
  text-align: center;
  padding: 2.5rem 1rem !important;
  font-size: 0.9rem;
  line-height: 1.7;
}

.registry-loading-icon {
  display: inline-block;
  animation: spin 1s linear infinite;
  margin-right: 0.5rem;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.registry-results-count {
  margin-top: 0.65rem;
  color: #94a3b8;
  font-size: 0.8rem;
  text-align: right;
}

/* ─── Responsive ──────────────────────────────────────── */
@media (max-width: 991.98px) {
  .registry-header {
    flex-direction: column;
  }

  .registry-header__actions {
    width: 100%;
  }
}

@media (max-width: 575.98px) {
  .registry-toolbar {
    grid-template-columns: 1fr;
  }

  .registry-form-row {
    grid-template-columns: 1fr;
  }
}
</style>
