function loadAuthModuleWithMocks () {
  jest.resetModules()
  window.localStorage.clear()

  const serviceMock = {
    authenticated: jest.fn()
  }
  const storeMock = {
    state: {
      XAccessToken: ''
    },
    getters: {
      'security/landingPath': '/dashboard'
    },
    commit: jest.fn(),
    dispatch: jest.fn()
  }
  const routerMock = {
    push: jest.fn()
  }
  const dbMock = {
    setItem: jest.fn().mockResolvedValue(true),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(true)
  }
  const sessionHintMock = {
    hasSessionHint: jest.fn().mockReturnValue(false),
    setSessionHint: jest.fn()
  }

  jest.doMock('@/service/api', () => ({
    __esModule: true,
    default: serviceMock
  }))
  jest.doMock('@/store/store', () => ({
    __esModule: true,
    default: storeMock
  }))
  jest.doMock('@/router/index', () => ({
    __esModule: true,
    default: routerMock
  }))
  jest.doMock('@/router/index.js', () => ({
    __esModule: true,
    default: routerMock
  }))
  jest.doMock('@/utils/db', () => dbMock)
  jest.doMock('@/service/session-hint', () => sessionHintMock)

  const authModule = require('@/store/modules/Authen').default
  return {
    authModule,
    serviceMock,
    storeMock,
    dbMock,
    sessionHintMock
  }
}

function createState () {
  return {
    authenticated: {
      isAuthen: false,
      isOAuth: false
    },
    pendingToken: '',
    isSignIn: true,
    is2FA: false,
    profile: null,
    message: []
  }
}

describe('store/modules/Authen bootstrapSession', () => {
  test('does not call silent auth/me when no token and no session hint exist', async () => {
    const { authModule, serviceMock } = loadAuthModuleWithMocks()
    const commit = jest.fn()
    const state = createState()

    await authModule.actions.bootstrapSession({ commit, state })

    expect(serviceMock.authenticated).not.toHaveBeenCalled()
    expect(commit).toHaveBeenCalledWith('authenticated', { isAuthen: false, isOAuth: false })
    expect(commit).toHaveBeenCalledWith('profile', null)
  })

  test('restores session through silent auth/me when a local token exists', async () => {
    const { authModule, serviceMock, storeMock, dbMock, sessionHintMock } = loadAuthModuleWithMocks()
    const commit = jest.fn()
    const state = createState()
    window.localStorage.setItem('x-access-token', 'stored-token')
    serviceMock.authenticated.mockResolvedValue({
      data: {
        data: {
          _id: 'acc-1',
          email: 'aibasedautomaticnetworkconfigurationsystem.owner@example.com',
          sessionToken: 'refreshed-token'
        }
      }
    })

    await authModule.actions.bootstrapSession({ commit, state })

    expect(serviceMock.authenticated).toHaveBeenCalledWith('me-silent', {}, {})
    expect(storeMock.commit).toHaveBeenCalledWith('set', ['XAccessToken', 'stored-token'])
    expect(storeMock.commit).toHaveBeenCalledWith('set', ['XAccessToken', 'refreshed-token'])
    expect(dbMock.setItem).toHaveBeenCalledWith('objs', { xAccessToken: 'refreshed-token' })
    expect(sessionHintMock.setSessionHint).toHaveBeenCalledWith(true)
    expect(commit).toHaveBeenCalledWith('authenticated', { isAuthen: true, isOAuth: true })
  })

  test('uses session hint to restore IAM cookie session without a local token', async () => {
    const { authModule, serviceMock, sessionHintMock } = loadAuthModuleWithMocks()
    const commit = jest.fn()
    const state = createState()
    sessionHintMock.hasSessionHint.mockReturnValue(true)
    serviceMock.authenticated.mockResolvedValue({
      data: {
        data: {
          _id: 'acc-1',
          email: 'aibasedautomaticnetworkconfigurationsystem.owner@example.com',
          sessionToken: 'cookie-session-token'
        }
      }
    })

    await authModule.actions.bootstrapSession({ commit, state })

    expect(serviceMock.authenticated).toHaveBeenCalledWith('me-silent', {}, {})
    expect(commit).toHaveBeenCalledWith('authenticated', { isAuthen: true, isOAuth: true })
  })
})
