<template>
  <div class="registry-page">
    <!-- Header -->
    <div class="reg-header">
      <div>
        <div class="reg-header__eyebrow">AI Based Automatic Network Configuration System</div>
        <h1>Network Configuration Registry</h1>
        <div class="reg-header__meta">{{ totalRecords }} total configurations · Last updated {{ lastUpdatedLabel }}</div>
      </div>
      <div class="reg-header__actions">
        <CButton color="primary" @click="showAddModal = true" id="btn-add-config">
          <CIcon name="cil-plus" class="mr-2" />
          Add Configuration
        </CButton>
        <CButton color="secondary" variant="outline" @click="refresh" id="btn-refresh">
          <CIcon name="cil-reload" class="mr-2" />
          Refresh
        </CButton>
      </div>
    </div>

    <!-- Summary Metrics -->
    <CRow class="mb-3">
      <CCol v-for="metric in metrics" :key="metric.label" xl="3" md="6" col="12" class="mb-3">
        <CCard class="reg-card reg-metric" :class="`reg-metric--${metric.accent}`">
          <CCardBody>
            <div class="reg-metric__top">
              <div class="reg-metric__label">{{ metric.label }}</div>
              <CIcon :name="metric.icon" />
            </div>
            <div class="reg-metric__value">{{ metric.value }}</div>
            <div class="reg-metric__hint">{{ metric.hint }}</div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <!-- Filter Bar -->
    <CCard class="reg-card mb-3">
      <CCardBody class="reg-filter-bar">
        <div class="reg-filter-bar__search">
          <CIcon name="cil-search" />
          <input
            id="registry-search"
            v-model="searchQuery"
            type="text"
            placeholder="Search by host, IP, or template…"
            class="reg-search-input"
          />
        </div>
        <div class="reg-filter-bar__selects">
          <select v-model="filterStatus" class="reg-select" id="filter-status">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="error">Error</option>
            <option value="archived">Archived</option>
          </select>
          <select v-model="filterType" class="reg-select" id="filter-type">
            <option value="">All Types</option>
            <option value="router">Router</option>
            <option value="switch">Switch</option>
            <option value="firewall">Firewall</option>
            <option value="ap">Access Point</option>
          </select>
        </div>
      </CCardBody>
    </CCard>

    <!-- Registry Table -->
    <CCard class="reg-card">
      <CCardBody>
        <div class="reg-section-heading">
          <div>
            <h2>Configuration Records</h2>
            <span>{{ filteredRecords.length }} record{{ filteredRecords.length !== 1 ? 's' : '' }} shown</span>
          </div>
          <div class="reg-legend">
            <span v-for="s in statusLegend" :key="s.label" class="reg-legend__item">
              <span class="reg-legend__dot" :class="`reg-legend__dot--${s.color}`"></span>
              {{ s.label }}
            </span>
          </div>
        </div>

        <div class="reg-table-wrap">
          <table class="reg-table" aria-label="Network Configuration Registry">
            <thead>
              <tr>
                <th>Host / Device</th>
                <th>IP Address</th>
                <th>Type</th>
                <th>Template</th>
                <th>Applied By</th>
                <th>Last Run</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredRecords.length === 0">
                <td colspan="8" class="reg-empty">
                  <CIcon name="cil-ban" />
                  <span>No configurations found</span>
                </td>
              </tr>
              <tr v-for="record in filteredRecords" :key="record.id" class="reg-row">
                <td>
                  <strong>{{ record.hostname }}</strong>
                  <span>{{ record.description }}</span>
                </td>
                <td class="reg-mono">{{ record.ip }}</td>
                <td>
                  <span class="reg-type-badge" :class="`reg-type-badge--${record.deviceType}`">
                    {{ record.deviceType }}
                  </span>
                </td>
                <td>{{ record.template }}</td>
                <td>{{ record.appliedBy }}</td>
                <td>{{ record.lastRun }}</td>
                <td>
                  <CBadge :color="statusColor(record.status)" class="reg-status-badge">
                    {{ record.status }}
                  </CBadge>
                </td>
                <td>
                  <div class="reg-actions">
                    <CButton size="sm" color="info" variant="outline" @click="viewRecord(record)" :id="`btn-view-${record.id}`">
                      <CIcon name="cil-notes" />
                    </CButton>
                    <CButton size="sm" color="warning" variant="outline" @click="rerunRecord(record)" :id="`btn-rerun-${record.id}`">
                      <CIcon name="cil-reload" />
                    </CButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CCardBody>
    </CCard>

    <!-- Add Configuration Modal -->
    <CModal :show.sync="showAddModal" title="Add Network Configuration" size="lg" id="modal-add-config">
      <CForm>
        <CRow>
          <CCol sm="6">
            <div class="form-group">
              <label for="field-hostname">Hostname</label>
              <input id="field-hostname" v-model="newRecord.hostname" type="text" class="form-control" placeholder="e.g. core-sw-01" />
            </div>
          </CCol>
          <CCol sm="6">
            <div class="form-group">
              <label for="field-ip">IP Address</label>
              <input id="field-ip" v-model="newRecord.ip" type="text" class="form-control" placeholder="e.g. 192.168.1.1" />
            </div>
          </CCol>
        </CRow>
        <CRow>
          <CCol sm="6">
            <div class="form-group">
              <label for="field-device-type">Device Type</label>
              <select id="field-device-type" v-model="newRecord.deviceType" class="form-control">
                <option value="">Select type…</option>
                <option value="router">Router</option>
                <option value="switch">Switch</option>
                <option value="firewall">Firewall</option>
                <option value="ap">Access Point</option>
              </select>
            </div>
          </CCol>
          <CCol sm="6">
            <div class="form-group">
              <label for="field-template">Template</label>
              <select id="field-template" v-model="newRecord.template" class="form-control">
                <option value="">Select template…</option>
                <option v-for="t in templates" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
          </CCol>
        </CRow>
        <div class="form-group">
          <label for="field-description">Description</label>
          <textarea id="field-description" v-model="newRecord.description" class="form-control" rows="2" placeholder="Brief device description…"></textarea>
        </div>
      </CForm>
      <template #footer>
        <CButton color="secondary" @click="showAddModal = false" id="btn-modal-cancel">Cancel</CButton>
        <CButton color="primary" @click="addRecord" id="btn-modal-save">Save Configuration</CButton>
      </template>
    </CModal>

    <!-- Detail Modal -->
    <CModal :show.sync="showDetailModal" :title="selectedRecord ? selectedRecord.hostname : ''" size="lg" id="modal-detail">
      <div v-if="selectedRecord" class="reg-detail">
        <CRow>
          <CCol sm="6">
            <div class="reg-detail__field"><span>IP Address</span><strong class="reg-mono">{{ selectedRecord.ip }}</strong></div>
            <div class="reg-detail__field"><span>Device Type</span><strong>{{ selectedRecord.deviceType }}</strong></div>
            <div class="reg-detail__field"><span>Template</span><strong>{{ selectedRecord.template }}</strong></div>
          </CCol>
          <CCol sm="6">
            <div class="reg-detail__field"><span>Applied By</span><strong>{{ selectedRecord.appliedBy }}</strong></div>
            <div class="reg-detail__field"><span>Last Run</span><strong>{{ selectedRecord.lastRun }}</strong></div>
            <div class="reg-detail__field"><span>Status</span>
              <CBadge :color="statusColor(selectedRecord.status)">{{ selectedRecord.status }}</CBadge>
            </div>
          </CCol>
        </CRow>
        <div class="reg-detail__field mt-2"><span>Description</span><p>{{ selectedRecord.description }}</p></div>
        <div class="reg-log-panel">
          <div class="reg-log-panel__header">Configuration Log</div>
          <div class="reg-log-panel__body">
            <div v-for="(line, i) in selectedRecord.log" :key="i" class="reg-log-line" :class="{ 'is-error': line.startsWith('ERROR') }">{{ line }}</div>
          </div>
        </div>
      </div>
      <template #footer>
        <CButton color="secondary" @click="showDetailModal = false" id="btn-detail-close">Close</CButton>
      </template>
    </CModal>
  </div>
</template>

<script>
const TEMPLATES = [
  'base-router-v2',
  'campus-switch-v3',
  'edge-firewall-v1',
  'wifi-ap-standard',
  'vlan-segmented-v2',
  'bgp-peering-v1'
]

const SEED_RECORDS = [
  {
    id: 1, hostname: 'core-sw-01', ip: '10.0.0.1', deviceType: 'switch',
    template: 'campus-switch-v3', appliedBy: 'ai-agent', lastRun: '2026-06-24 09:12',
    status: 'active', description: 'Core distribution switch, Building A',
    log: ['INFO  Loading template campus-switch-v3', 'INFO  Applying VLAN config: 10,20,30', 'INFO  Setting STP root priority', 'OK    Configuration applied successfully']
  },
  {
    id: 2, hostname: 'edge-fw-01', ip: '203.150.1.1', deviceType: 'firewall',
    template: 'edge-firewall-v1', appliedBy: 'admin@mfu.ac.th', lastRun: '2026-06-23 14:45',
    status: 'active', description: 'Perimeter firewall, main internet gateway',
    log: ['INFO  Loading template edge-firewall-v1', 'INFO  Applying ACL ruleset v4', 'INFO  Enabling IPS module', 'OK    Configuration applied successfully']
  },
  {
    id: 3, hostname: 'dist-rt-02', ip: '10.0.1.2', deviceType: 'router',
    template: 'bgp-peering-v1', appliedBy: 'ai-agent', lastRun: '2026-06-24 07:00',
    status: 'pending', description: 'Distribution router awaiting BGP peer confirmation',
    log: ['INFO  Loading template bgp-peering-v1', 'INFO  Configuring BGP AS 65001', 'WARN  Peer 10.0.1.254 not responding', 'INFO  Retrying in 5 minutes…']
  },
  {
    id: 4, hostname: 'ap-lib-03', ip: '172.16.4.3', deviceType: 'ap',
    template: 'wifi-ap-standard', appliedBy: 'ai-agent', lastRun: '2026-06-22 11:30',
    status: 'error', description: 'Library wing AP — authentication failure during last run',
    log: ['INFO  Loading template wifi-ap-standard', 'INFO  Setting SSID and channel', 'ERROR Authentication to device failed (timeout)', 'ERROR Configuration not applied']
  },
  {
    id: 5, hostname: 'acc-sw-04', ip: '10.1.4.4', deviceType: 'switch',
    template: 'vlan-segmented-v2', appliedBy: 'admin@mfu.ac.th', lastRun: '2026-06-20 16:00',
    status: 'archived', description: 'Decommissioned access switch, Lab Block C',
    log: ['INFO  Last config archived', 'INFO  Device removed from active pool']
  },
  {
    id: 6, hostname: 'core-rt-01', ip: '10.0.0.254', deviceType: 'router',
    template: 'base-router-v2', appliedBy: 'ai-agent', lastRun: '2026-06-24 10:05',
    status: 'active', description: 'Core routing backbone, inter-VLAN routing',
    log: ['INFO  Loading template base-router-v2', 'INFO  Configuring OSPF area 0', 'INFO  Applying route policies', 'OK    Configuration applied successfully']
  }
]

export default {
  name: 'AIBasedAutomaticNetworkConfigurationSystemRegistry',
  data () {
    return {
      records: SEED_RECORDS.map(r => ({ ...r })),
      nextId: SEED_RECORDS.length + 1,
      lastUpdated: new Date(),
      searchQuery: '',
      filterStatus: '',
      filterType: '',
      showAddModal: false,
      showDetailModal: false,
      selectedRecord: null,
      newRecord: { hostname: '', ip: '', deviceType: '', template: '', description: '' }
    }
  },
  computed: {
    templates () { return TEMPLATES },
    totalRecords () { return this.records.length },
    metrics () {
      const active = this.records.filter(r => r.status === 'active').length
      const pending = this.records.filter(r => r.status === 'pending').length
      const error = this.records.filter(r => r.status === 'error').length
      return [
        { label: 'Total Devices', value: this.records.length, hint: 'In registry', icon: 'cil-devices', accent: 'blue' },
        { label: 'Active', value: active, hint: 'Successfully configured', icon: 'cil-check-circle', accent: 'green' },
        { label: 'Pending', value: pending, hint: 'Awaiting confirmation', icon: 'cil-clock', accent: 'amber' },
        { label: 'Errors', value: error, hint: 'Require attention', icon: 'cil-warning', accent: 'red' }
      ]
    },
    statusLegend () {
      return [
        { label: 'Active', color: 'green' },
        { label: 'Pending', color: 'amber' },
        { label: 'Error', color: 'red' },
        { label: 'Archived', color: 'grey' }
      ]
    },
    filteredRecords () {
      return this.records.filter(r => {
        const q = this.searchQuery.toLowerCase()
        const matchSearch = !q ||
          r.hostname.toLowerCase().includes(q) ||
          r.ip.includes(q) ||
          r.template.toLowerCase().includes(q)
        const matchStatus = !this.filterStatus || r.status === this.filterStatus
        const matchType = !this.filterType || r.deviceType === this.filterType
        return matchSearch && matchStatus && matchType
      })
    },
    lastUpdatedLabel () {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      }).format(this.lastUpdated)
    }
  },
  methods: {
    refresh () { this.lastUpdated = new Date() },
    statusColor (status) {
      const s = String(status || '').toLowerCase()
      if (s === 'active') return 'success'
      if (s === 'pending') return 'warning'
      if (s === 'error') return 'danger'
      return 'secondary'
    },
    viewRecord (record) {
      this.selectedRecord = record
      this.showDetailModal = true
    },
    rerunRecord (record) {
      record.status = 'pending'
      record.lastRun = new Intl.DateTimeFormat('en-GB', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }).format(new Date()).replace(',', '')
    },
    addRecord () {
      if (!this.newRecord.hostname || !this.newRecord.ip) return
      this.records.push({
        id: this.nextId++,
        hostname: this.newRecord.hostname,
        ip: this.newRecord.ip,
        deviceType: this.newRecord.deviceType || 'router',
        template: this.newRecord.template || TEMPLATES[0],
        appliedBy: 'manual',
        lastRun: '—',
        status: 'pending',
        description: this.newRecord.description || '—',
        log: ['INFO  Record added manually — pending first configuration run']
      })
      this.newRecord = { hostname: '', ip: '', deviceType: '', template: '', description: '' }
      this.showAddModal = false
    }
  }
}
</script>

<style scoped>
.registry-page {
  padding: 0.25rem;
}

/* Header */
.reg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1rem 1.1rem;
  border: 1px solid #d9e2ef;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(34, 45, 70, 0.06);
}

.reg-header__eyebrow {
  color: #6b778c;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
}

.reg-header h1 {
  margin: 0.1rem 0;
  color: #172033;
  font-size: 1.55rem;
  font-weight: 700;
}

.reg-header__meta {
  color: #667085;
  font-size: 0.86rem;
}

.reg-header__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.6rem;
}

/* Cards */
.reg-card {
  border: 1px solid #dfe7f2;
  border-radius: 8px;
  box-shadow: 0 10px 24px rgba(34, 45, 70, 0.055);
}

/* Metrics */
.reg-metric {
  min-height: 130px;
  border-left-width: 5px;
}

.reg-metric--blue { border-left-color: #2563eb; }
.reg-metric--green { border-left-color: #16a34a; }
.reg-metric--amber { border-left-color: #d97706; }
.reg-metric--red { border-left-color: #dc2626; }

.reg-metric__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.reg-metric__label {
  color: #6b778c;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
}

.reg-metric__value {
  margin-top: 0.7rem;
  color: #111827;
  font-size: 1.75rem;
  font-weight: 700;
}

.reg-metric__hint {
  color: #667085;
  font-size: 0.83rem;
}

/* Filter bar */
.reg-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.reg-filter-bar__search {
  display: flex;
  flex: 1 1 240px;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem;
  border: 1px solid #cdd6e3;
  border-radius: 6px;
  background: #f8fafc;
}

.reg-search-input {
  flex: 1;
  padding: 0.5rem 0;
  border: none;
  background: transparent;
  font-size: 0.9rem;
  outline: none;
  color: #1f2937;
}

.reg-filter-bar__selects {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.reg-select {
  padding: 0.45rem 0.7rem;
  border: 1px solid #cdd6e3;
  border-radius: 6px;
  background: #f8fafc;
  color: #243047;
  font-size: 0.88rem;
  cursor: pointer;
}

/* Section heading */
.reg-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.reg-section-heading h2 {
  margin: 0;
  color: #172033;
  font-size: 1rem;
  font-weight: 700;
}

.reg-section-heading span {
  color: #667085;
  font-size: 0.86rem;
}

/* Legend */
.reg-legend {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.reg-legend__item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: #516072;
}

.reg-legend__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.reg-legend__dot--green { background: #16a34a; }
.reg-legend__dot--amber { background: #d97706; }
.reg-legend__dot--red { background: #dc2626; }
.reg-legend__dot--grey { background: #9ca3af; }

/* Table */
.reg-table-wrap { overflow-x: auto; }

.reg-table {
  width: 100%;
  border-collapse: collapse;
}

.reg-table th {
  padding: 0.8rem 0.65rem;
  border-bottom: 2px solid #e5ebf3;
  color: #516072;
  font-size: 0.76rem;
  font-weight: 700;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

.reg-table td {
  padding: 0.8rem 0.65rem;
  border-bottom: 1px solid #e5ebf3;
  color: #273449;
  vertical-align: middle;
}

.reg-row:hover td { background: #f4f7fb; }

.reg-table td strong { display: block; color: #1f2937; }
.reg-table td span { display: block; color: #667085; font-size: 0.82rem; }

.reg-mono {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.88rem;
  color: #1d4ed8 !important;
}

.reg-empty {
  text-align: center;
  color: #9ca3af;
  padding: 2.5rem !important;
}

.reg-empty .c-icon {
  display: block;
  margin: 0 auto 0.5rem;
  font-size: 1.5rem;
}

/* Type badge */
.reg-type-badge {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: capitalize;
  background: #e8edf5;
  color: #374151;
}

.reg-type-badge--router { background: #dbeafe; color: #1d4ed8; }
.reg-type-badge--switch { background: #d1fae5; color: #065f46; }
.reg-type-badge--firewall { background: #fee2e2; color: #991b1b; }
.reg-type-badge--ap { background: #ede9fe; color: #5b21b6; }

.reg-status-badge { font-size: 0.78rem; }

/* Row actions */
.reg-actions {
  display: flex;
  gap: 0.35rem;
}

/* Detail modal */
.reg-detail__field {
  margin-bottom: 0.75rem;
}

.reg-detail__field span {
  display: block;
  color: #6b778c;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 0.15rem;
}

.reg-detail__field strong,
.reg-detail__field p {
  color: #1f2937;
  margin: 0;
}

/* Log panel */
.reg-log-panel {
  margin-top: 1rem;
  border: 1px solid #dfe7f2;
  border-radius: 6px;
  overflow: hidden;
}

.reg-log-panel__header {
  padding: 0.5rem 0.85rem;
  background: #f1f5fb;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #516072;
  border-bottom: 1px solid #dfe7f2;
}

.reg-log-panel__body {
  padding: 0.75rem 0.85rem;
  background: #0f172a;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.82rem;
  line-height: 1.8;
  max-height: 180px;
  overflow-y: auto;
}

.reg-log-line { color: #94a3b8; }
.reg-log-line.is-error { color: #f87171; }

@media (max-width: 991.98px) {
  .reg-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .reg-header__actions { justify-content: flex-start; }
  .reg-section-heading { flex-direction: column; align-items: flex-start; }
}
</style>
