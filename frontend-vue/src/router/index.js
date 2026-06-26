import Vue from 'vue'
import Router from 'vue-router'
import store from '@/store/store'
import { resolveFirstAccessiblePath } from '@/projects/utils/permission-landing'

const TheContainer = () => import('@/containers/TheContainer')
const Dashboard = () => import('@/views/Dashboard')
const Page403 = () => import('@/views/pages/Page403')
const Page404 = () => import('@/views/pages/Page404')
const Page500 = () => import('@/views/pages/Page500')
const Login = () => import('@/views/pages/Login')
const AIBasedAutomaticNetworkConfigurationSystemRegistry = () => import('@/projects/views/aibasedautomaticnetworkconfigurationsystem/AIBasedAutomaticNetworkConfigurationSystemRegistry')
const AccountDirectory = () => import('@/projects/views/accounts/Management')
const BusinessOperations = () => import('@/projects/views/operations/BusinessOperations')
const CreateMenu = () => import('@/projects/views/security/CreateMenu')
const CreateGroup = () => import('@/projects/views/security/CreateGroup')
const PermissionMatrix = () => import('@/projects/views/security/PermissionMatrix')
const AuditExplorer = () => import('@/projects/views/security/AuditExplorer')
const SettingMessageAuthen = () => import('@/projects/views/setting/MessageAuthen')
const EmailNotifications = () => import('@/projects/views/setting/EmailNotifications')
const WorkflowActions = () => import('@/projects/views/setting/WorkflowActions')
const RuntimeAccess = () => import('@/projects/views/setting/RuntimeAccess')
const DatabaseBackup = () => import('@/projects/views/setting/DatabaseBackup')
const SettingMessage = () => import('@/projects/views/setting/Message')
const SettingVerification = () => import('@/projects/views/setting/Verification')
const SettingGroup = () => import('@/projects/views/setting/Group')
const SettingMessageStatus = () => import('@/projects/views/setting/Status')

Vue.use(Router)

const DEFAULT_LANDING_PATH = '/dashboard'

const router = new Router({
  hash: false,
  mode: 'history',
  linkActiveClass: 'open active',
  scrollBehavior: () => ({ y: 0 }),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
      name: 'Home',
      component: TheContainer,
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          meta: { permission: { path: '/dashboard', action: 'view' } },
          component: Dashboard
        },
        {
          path: 'aibasedautomaticnetworkconfigurationsystem/registry',
          name: 'AI Based Automatic Network Configuration System Registry',
          meta: { permission: { path: '/ai-based-automatic-network-configuration-system/registry', action: 'view' } },
          component: AIBasedAutomaticNetworkConfigurationSystemRegistry
        },
        {
          path: 'operations/business',
          name: 'Business Operations',
          meta: { permission: { path: '/operations/business', action: 'view' } },
          component: BusinessOperations
        },
        {
          path: 'accounts/directory',
          name: 'Account Directory',
          meta: { permission: { path: '/accounts/directory', action: 'view' } },
          component: AccountDirectory
        },
        {
          path: 'security/permissions',
          redirect: '/security/permissions/menu',
          name: 'Permission'
        },
        {
          path: 'security/permissions/menu',
          name: 'Create Menu',
          meta: { permission: { path: '/security/permissions/menu', action: 'view' } },
          component: CreateMenu
        },
        {
          path: 'security/permissions/group',
          name: 'Create Group',
          meta: { permission: { path: '/security/permissions/group', action: 'view' } },
          component: CreateGroup
        },
        {
          path: 'security/permissions/matrix',
          name: 'Permission Matrix',
          meta: { permission: { path: '/security/permissions/matrix', action: 'view' } },
          component: PermissionMatrix
        },
        {
          path: 'security/audit',
          name: 'Audit Explorer',
          meta: { permission: { path: '/security/audit', action: 'view' } },
          component: AuditExplorer
        },
        {
          path: 'config/message-authen',
          name: 'Message Authen',
          meta: { permission: { path: '/config/message-authen', action: 'view' } },
          component: SettingMessageAuthen
        },
        {
          path: 'config/email-notifications',
          name: 'Email Notifications',
          meta: { permission: { path: '/config/email-notifications', action: 'view' } },
          component: EmailNotifications
        },
        {
          path: 'config/workflow-actions',
          name: 'Workflow Actions',
          meta: { permission: { path: '/config/workflow-actions', action: 'view' } },
          component: WorkflowActions
        },
        {
          path: 'config/runtime-access',
          name: 'Runtime Access',
          component: RuntimeAccess,
          meta: { permission: { path: '/config/runtime-access', action: 'view' } }
        },
        {
          path: 'config/database-backup',
          name: 'Database Backup',
          component: DatabaseBackup,
          meta: { permission: { path: '/config/database-backup', action: 'view' } }
        },
        {
          path: 'config/setting-message',
          name: 'Setting Message',
          meta: { permission: { path: '/config/setting-message', action: 'view' } },
          component: SettingMessage
        },
        {
          path: 'config/verification',
          name: 'Setting Verification',
          meta: { permission: { path: '/config/verification', action: 'view' } },
          component: SettingVerification
        },
        {
          path: 'setting/group',
          name: 'Setting Group',
          meta: { permission: { path: '/setting/group', action: 'view' } },
          component: SettingGroup
        },
        {
          path: 'setting/message-status',
          name: 'Message Status',
          meta: { permission: { path: '/setting/message-status', action: 'view' } },
          component: SettingMessageStatus
        }
      ]
    },
    {
      path: '/pages',
      redirect: '/pages/404',
      name: 'Pages',
      component: {
        render (c) { return c('router-view') }
      },
      children: [
        {
          path: '403',
          name: 'Page403',
          component: Page403
        },
        {
          path: '404',
          name: 'Page404',
          component: Page404
        },
        {
          path: '500',
          name: 'Page500',
          component: Page500
        },
        {
          path: 'login',
          name: 'Login',
          component: Login
        }
      ]
    },
    {
      path: '*',
      redirect: '/pages/404'
    }
  ]
})

function normalizePermissionPath(path) {
  if (!path) return ''
  let normalized = String(path).trim()
  const queryIndex = normalized.indexOf('?')
  if (queryIndex !== -1) normalized = normalized.slice(0, queryIndex)
  const hashIndex = normalized.indexOf('#')
  if (hashIndex !== -1) normalized = normalized.slice(0, hashIndex)
  normalized = normalized.replace(/\/{2,}/g, '/')
  if (!normalized.startsWith('/')) normalized = `/${normalized}`
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return normalized
}

function swapPermissionPlurality(path) {
  const normalized = normalizePermissionPath(path)
  if (!normalized) return ''
  if (normalized.includes('/permissions')) {
    return normalized.replace('/permissions', '/permission')
  }
  if (normalized.includes('/permission')) {
    return normalized.replace('/permission', '/permissions')
  }
  return ''
}

function permissionMetaPaths(permissionMeta) {
  const paths = []
  if (permissionMeta && permissionMeta.path) paths.push(permissionMeta.path)
  if (permissionMeta && Array.isArray(permissionMeta.paths)) {
    permissionMeta.paths.forEach(path => paths.push(path))
  }
  return paths
}

function buildPermissionCandidates(to, permissionMeta) {
  const candidates = new Set()
  const rawRoutePath = to && to.path ? to.path : ''
  const normalizedRoutePath = normalizePermissionPath(rawRoutePath)

  permissionMetaPaths(permissionMeta)
    .map(normalizePermissionPath)
    .filter(Boolean)
    .forEach(path => {
      candidates.add(path)
      const alternate = swapPermissionPlurality(path)
      if (alternate) candidates.add(alternate)
    })

  ;[normalizedRoutePath, swapPermissionPlurality(normalizedRoutePath)]
    .filter(Boolean)
    .forEach(item => candidates.add(item))

  return Array.from(candidates)
}

async function ensurePermissionLoaded() {
  if (store.getters['security/loaded']) return
  try {
    await store.dispatch('security/fetchMyPermissions')
  } catch (err) {
    // Permission fetch failure is handled as access denied.
  }
}

function resolveLandingPath() {
  return store.getters['security/landingPath'] ||
    resolveFirstAccessiblePath(store.getters['security/canAccess'], DEFAULT_LANDING_PATH)
}

function shouldRedirectDeniedDefault(path) {
  return normalizePermissionPath(path) === normalizePermissionPath(DEFAULT_LANDING_PATH)
}

router.beforeEach(async (to, from, next) => {
  try {
    await store.dispatch('auth/bootstrapSession')
  } catch (err) {
    // ignore bootstrap error
  }

  const isPublicPage = to.path.startsWith('/pages')
  const hasToken = !!store.state.XAccessToken
  const authState = store.getters['auth/authenticated'] || {}
  const isAuthenticated = !!authState.isAuthen

  if (!isPublicPage && (!hasToken || !isAuthenticated)) {
    return next({ path: '/pages/login' })
  }

  if (to.path === '/pages/login' && hasToken && isAuthenticated) {
    await ensurePermissionLoaded()
    return next({ path: resolveLandingPath() })
  }

  const permissionMeta = to.meta && to.meta.permission
  if (permissionMeta && hasToken && isAuthenticated) {
    await ensurePermissionLoaded()
    const action = permissionMeta.action || 'view'
    const pathCandidates = buildPermissionCandidates(to, permissionMeta)
    const canAccess = pathCandidates.some(path => (
      store.getters['security/canAccess'](path, action)
    ))
    if (!canAccess) {
      const landingPath = resolveLandingPath()
      if (
        shouldRedirectDeniedDefault(to.path) &&
        normalizePermissionPath(landingPath) !== normalizePermissionPath(to.path) &&
        store.getters['security/canAccess'](landingPath, 'view')
      ) {
        return next({ path: landingPath })
      }
      return next({ path: '/pages/403' })
    }
  }

  return next()
})

export default router
