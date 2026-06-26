const DEFAULT_PATH = '/dashboard'
const ALTERNATE_PATH = '/ai-based-automatic-network-configuration-system/registry'

function loadRouter(canAccessImpl, loaded = true) {
  jest.resetModules()

  const storeMock = {
    state: { XAccessToken: 'token-1' },
    getters: {
      'auth/authenticated': { isAuthen: true },
      'security/loaded': loaded,
      'security/canAccess': canAccessImpl || jest.fn(() => false),
      'security/landingPath': ''
    },
    dispatch: jest.fn(() => Promise.resolve()),
    commit: jest.fn()
  }

  jest.doMock('@/store/store', () => ({
    __esModule: true,
    default: storeMock
  }))

  const router = require('@/router/index').default
  return { router, storeMock }
}

describe('router permission landing', () => {
  it('redirects authenticated login to the first accessible path', async () => {
    const canAccess = jest.fn((path, action) => path === ALTERNATE_PATH && action === 'view')
    const { router } = loadRouter(canAccess)
    const next = jest.fn()

    await router.beforeHooks[0]({ path: '/pages/login', meta: {} }, { path: '/' }, next)

    expect(next).toHaveBeenCalledWith({ path: ALTERNATE_PATH })
  })

  it('redirects denied default landing to another accessible path', async () => {
    const canAccess = jest.fn((path, action) => path === ALTERNATE_PATH && action === 'view')
    const { router } = loadRouter(canAccess)
    const next = jest.fn()

    await router.beforeHooks[0](
      { path: DEFAULT_PATH, meta: { permission: { path: DEFAULT_PATH, action: 'view' } } },
      { path: '/pages/login' },
      next
    )

    expect(next).toHaveBeenCalledWith({ path: ALTERNATE_PATH })
  })

  it('uses 403 for denied non-default routes', async () => {
    const canAccess = jest.fn((path, action) => path === ALTERNATE_PATH && action === 'view')
    const { router } = loadRouter(canAccess)
    const next = jest.fn()

    await router.beforeHooks[0](
      { path: '/accounts/directory', meta: { permission: { path: '/accounts/directory', action: 'view' } } },
      { path: DEFAULT_PATH },
      next
    )

    expect(next).toHaveBeenCalledWith({ path: '/pages/403' })
  })
})
