<template>
  <div class="aibasedautomaticnetworkconfigurationsystem-registry-page">
    <div class="aibasedautomaticnetworkconfigurationsystem-header">
      <div>
        <div class="aibasedautomaticnetworkconfigurationsystem-header__eyebrow">AI Based Automatic Network Configuration System Management</div>
        <h1>AI Based Automatic Network Configuration System Registry</h1>
        <p>Track agreements, ownership, review state, and renewal timing in one IAM-protected workspace.</p>
      </div>
      <div class="aibasedautomaticnetworkconfigurationsystem-header__actions">
        <CButton color="primary" variant="outline" :disabled="loading" @click="fetchAll">
          <CIcon name="cil-reload" class="mr-2" />
          Refresh
        </CButton>
        <CButton color="success" variant="outline" :disabled="saving" @click="seedDemo">
          <CIcon name="cil-plus" class="mr-2" />
          Seed Demo
        </CButton>
      </div>
    </div>

    <CRow>
      <CCol v-for="item in statCards" :key="item.key" xl="3" md="6" class="mb-3">
        <CCard class="aibasedautomaticnetworkconfigurationsystem-card aibasedautomaticnetworkconfigurationsystem-stat">
          <CCardBody>
            <div class="aibasedautomaticnetworkconfigurationsystem-stat__label">{{ item.label }}</div>
            <div class="aibasedautomaticnetworkconfigurationsystem-stat__value">{{ item.value }}</div>
            <div class="aibasedautomaticnetworkconfigurationsystem-stat__hint">{{ item.hint }}</div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CRow>
      <CCol lg="4" class="mb-3">
        <CCard class="aibasedautomaticnetworkconfigurationsystem-card h-100">
          <CCardBody>
            <h2>{{ form._id ? 'Update AIBasedAutomaticNetworkConfigurationSystem' : 'Create AIBasedAutomaticNetworkConfigurationSystem' }}</h2>
            <CInput v-model.trim="form.aibasedautomaticnetworkconfigurationsystemNo" label="AIBasedAutomaticNetworkConfigurationSystem No." placeholder="AIBasedAutomaticNetworkConfigurationSystem-INT-2026-001" />
            <CInput v-model.trim="form.title" label="Title" placeholder="Academic Collaboration" />
            <CInput v-model.trim="form.partnerName" label="Partner" placeholder="Partner organization" />
            <CInput v-model.trim="form.partnerType" label="Partner Type" placeholder="University, Institute, Company" />
            <CInput v-model.trim="form.country" label="Country" placeholder="Thailand" />
            <CInput v-model.trim="form.ownerUnit" label="Owner Unit" placeholder="International Affairs Division" />
            <CInput v-model.trim="form.coordinatorName" label="Coordinator" placeholder="Coordinator name" />
            <CInput v-model.trim="form.coordinatorEmail" type="email" label="Coordinator Email" placeholder="aibasedautomaticnetworkconfigurationsystem@mfu.ac.th" />
            <CSelect v-model="form.status" label="Status" :options="statusOptions" />
            <CInput v-model="form.effectiveDate" type="date" label="Effective Date" />
            <CInput v-model="form.expiryDate" type="date" label="Expiry Date" />
            <CInput v-model.trim="form.tags" label="Tags" placeholder="academic, exchange" />
            <CTextarea v-model.trim="form.notes" label="Notes" rows="3" />
            <div class="aibasedautomaticnetworkconfigurationsystem-form-actions">
              <CButton color="primary" :disabled="saving" @click="saveDocument">
                <CIcon name="cil-save" class="mr-2" />
                {{ form._id ? 'Update' : 'Create' }}
              </CButton>
              <CButton color="secondary" variant="outline" @click="resetForm">Clear</CButton>
            </div>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol lg="8" class="mb-3">
        <CCard class="aibasedautomaticnetworkconfigurationsystem-card h-100">
          <CCardBody>
            <div class="aibasedautomaticnetworkconfigurationsystem-toolbar">
              <CInput v-model.trim="filters.q" placeholder="Search AIBasedAutomaticNetworkConfigurationSystem no., title, partner, owner" class="aibasedautomaticnetworkconfigurationsystem-search" @keyup.enter="fetchDocuments" />
              <CSelect v-model="filters.status" :options="filterStatusOptions" class="aibasedautomaticnetworkconfigurationsystem-status" />
              <CButton color="primary" @click="fetchDocuments">Search</CButton>
            </div>

            <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
            <div class="aibasedautomaticnetworkconfigurationsystem-table-wrap">
              <table class="aibasedautomaticnetworkconfigurationsystem-table">
                <thead>
                  <tr>
                    <th>AIBasedAutomaticNetworkConfigurationSystem</th>
                    <th>Partner</th>
                    <th>Owner</th>
                    <th>Period</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="loading">
                    <td colspan="6" class="aibasedautomaticnetworkconfigurationsystem-empty">Loading</td>
                  </tr>
                  <tr v-else-if="!documents.length">
                    <td colspan="6" class="aibasedautomaticnetworkconfigurationsystem-empty">No AIBasedAutomaticNetworkConfigurationSystem records found</td>
                  </tr>
                  <tr v-for="item in documents" :key="item._id">
                    <td>
                      <strong>{{ item.aibasedautomaticnetworkconfigurationsystemNo }}</strong>
                      <span>{{ item.title }}</span>
                    </td>
                    <td>
                      <strong>{{ item.partnerName }}</strong>
                      <span>{{ item.partnerType || '-' }} · {{ item.country || '-' }}</span>
                    </td>
                    <td>{{ item.ownerUnit || '-' }}</td>
                    <td>
                      <strong>{{ formatDate(item.effectiveDate) }}</strong>
                      <span>to {{ formatDate(item.expiryDate) }}</span>
                    </td>
                    <td>
                      <CBadge :color="statusColor(item.status)">{{ statusLabel(item.status) }}</CBadge>
                    </td>
                    <td class="aibasedautomaticnetworkconfigurationsystem-row-actions">
                      <CButton size="sm" color="primary" variant="outline" @click="editDocument(item)">
                        <CIcon name="cil-pencil" />
                      </CButton>
                      <CButton size="sm" color="danger" variant="outline" @click="removeDocument(item)">
                        <CIcon name="cil-trash" />
                      </CButton>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  </div>
</template>

<script>
import api from '@/service/api'

const EMPTY_FORM = {
  _id: '',
  aibasedautomaticnetworkconfigurationsystemNo: '',
  title: '',
  partnerName: '',
  partnerType: 'University',
  country: 'Thailand',
  ownerUnit: '',
  coordinatorName: '',
  coordinatorEmail: '',
  status: 'draft',
  effectiveDate: '',
  expiryDate: '',
  tags: '',
  notes: ''
}

function unwrap(response) {
  return response && response.data && response.data.data ? response.data.data : {}
}

function toInputDate(value) {
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
      documents: [],
      stats: {
        total: 0,
        active: 0,
        review: 0,
        expiring: 0,
        expired: 0
      },
      filters: {
        q: '',
        status: 'all'
      },
      form: Object.assign({}, EMPTY_FORM),
      statusOptions: [
        { label: 'Draft', value: 'draft' },
        { label: 'In Review', value: 'review' },
        { label: 'Active', value: 'active' },
        { label: 'Expiring', value: 'expiring' },
        { label: 'Expired', value: 'expired' },
        { label: 'Archived', value: 'archived' }
      ],
      filterStatusOptions: [
        { label: 'All Statuses', value: 'all' },
        { label: 'Draft', value: 'draft' },
        { label: 'In Review', value: 'review' },
        { label: 'Active', value: 'active' },
        { label: 'Expiring', value: 'expiring' },
        { label: 'Expired', value: 'expired' },
        { label: 'Archived', value: 'archived' }
      ]
    }
  },
  computed: {
    statCards () {
      return [
        { key: 'total', label: 'Total AIBasedAutomaticNetworkConfigurationSystems', value: this.stats.total, hint: 'All registry records' },
        { key: 'active', label: 'Active', value: this.stats.active, hint: 'Valid agreements' },
        { key: 'review', label: 'In Review', value: this.stats.review, hint: 'Waiting for approval' },
        { key: 'expiring', label: 'Expiring', value: this.stats.expiring, hint: 'Renewal within 90 days' }
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
      } catch (error) {
        this.handleError(error)
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
      } catch (error) {
        this.handleError(error)
      } finally {
        this.loading = false
      }
    },
    async saveDocument () {
      this.saving = true
      this.errorMessage = ''
      try {
        const payload = Object.assign({}, this.form, {
          tags: String(this.form.tags || '').split(',').map(item => item.trim()).filter(Boolean)
        })
        if (payload._id) {
          payload.id = payload._id
          await api.aibasedautomaticnetworkconfigurationsystemDocuments('update', payload)
        } else {
          await api.aibasedautomaticnetworkconfigurationsystemDocuments('create', payload)
        }
        this.resetForm()
        await this.fetchAll()
      } catch (error) {
        this.handleError(error)
      } finally {
        this.saving = false
      }
    },
    editDocument (item) {
      this.form = Object.assign({}, EMPTY_FORM, item, {
        effectiveDate: toInputDate(item.effectiveDate),
        expiryDate: toInputDate(item.expiryDate),
        tags: Array.isArray(item.tags) ? item.tags.join(', ') : ''
      })
    },
    async removeDocument (item) {
      if (!item || !item._id) return
      this.saving = true
      this.errorMessage = ''
      try {
        await api.aibasedautomaticnetworkconfigurationsystemDocuments('delete', item)
        await this.fetchAll()
      } catch (error) {
        this.handleError(error)
      } finally {
        this.saving = false
      }
    },
    async seedDemo () {
      this.saving = true
      this.errorMessage = ''
      try {
        await api.aibasedautomaticnetworkconfigurationsystemDocuments('seed-demo')
        await this.fetchAll()
      } catch (error) {
        this.handleError(error)
      } finally {
        this.saving = false
      }
    },
    resetForm () {
      this.form = Object.assign({}, EMPTY_FORM)
    },
    formatDate (value) {
      if (!value) return '-'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return '-'
      return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
    },
    statusLabel (status) {
      const match = this.statusOptions.find(item => item.value === status)
      return match ? match.label : status || '-'
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
    },
    handleError (error) {
      this.errorMessage = error && error.response && error.response.data && error.response.data.message
        ? error.response.data.message
        : 'Unable to complete the AIBasedAutomaticNetworkConfigurationSystem request.'
    }
  }
}
</script>

<style scoped>
.aibasedautomaticnetworkconfigurationsystem-registry-page {
  padding: 0.25rem;
}

.aibasedautomaticnetworkconfigurationsystem-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.aibasedautomaticnetworkconfigurationsystem-header__eyebrow {
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.aibasedautomaticnetworkconfigurationsystem-header h1 {
  margin: 0.25rem 0;
  color: #0f172a;
  font-size: 1.75rem;
  font-weight: 700;
}

.aibasedautomaticnetworkconfigurationsystem-header p {
  max-width: 720px;
  margin: 0;
  color: #475569;
}

.aibasedautomaticnetworkconfigurationsystem-header__actions,
.aibasedautomaticnetworkconfigurationsystem-form-actions,
.aibasedautomaticnetworkconfigurationsystem-row-actions {
  display: flex;
  gap: 0.5rem;
}

.aibasedautomaticnetworkconfigurationsystem-card {
  border: 0;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}

.aibasedautomaticnetworkconfigurationsystem-card h2 {
  margin-bottom: 1rem;
  color: #0f172a;
  font-size: 1.1rem;
  font-weight: 700;
}

.aibasedautomaticnetworkconfigurationsystem-stat__label {
  color: #64748b;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.aibasedautomaticnetworkconfigurationsystem-stat__value {
  margin: 0.35rem 0;
  color: #0f172a;
  font-size: 1.65rem;
  font-weight: 700;
}

.aibasedautomaticnetworkconfigurationsystem-stat__hint {
  color: #475569;
}

.aibasedautomaticnetworkconfigurationsystem-toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 180px auto;
  gap: 0.75rem;
  align-items: start;
  margin-bottom: 1rem;
}

.aibasedautomaticnetworkconfigurationsystem-table-wrap {
  overflow-x: auto;
}

.aibasedautomaticnetworkconfigurationsystem-table {
  width: 100%;
  border-collapse: collapse;
}

.aibasedautomaticnetworkconfigurationsystem-table th {
  color: #64748b;
  font-size: 0.78rem;
  font-weight: 700;
  text-align: left;
  text-transform: uppercase;
}

.aibasedautomaticnetworkconfigurationsystem-table th,
.aibasedautomaticnetworkconfigurationsystem-table td {
  padding: 0.85rem;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
}

.aibasedautomaticnetworkconfigurationsystem-table strong,
.aibasedautomaticnetworkconfigurationsystem-table span {
  display: block;
}

.aibasedautomaticnetworkconfigurationsystem-table span {
  color: #64748b;
  font-size: 0.86rem;
}

.aibasedautomaticnetworkconfigurationsystem-empty {
  color: #64748b;
  text-align: center;
}

@media (max-width: 768px) {
  .aibasedautomaticnetworkconfigurationsystem-header {
    flex-direction: column;
  }

  .aibasedautomaticnetworkconfigurationsystem-header__actions,
  .aibasedautomaticnetworkconfigurationsystem-form-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .aibasedautomaticnetworkconfigurationsystem-toolbar {
    grid-template-columns: 1fr;
  }
}
</style>
