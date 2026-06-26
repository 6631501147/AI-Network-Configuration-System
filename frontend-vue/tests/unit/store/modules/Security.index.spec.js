function loadSecurityModuleWithMocks () {
  jest.resetModules()
  const serviceMock = {
    security: jest.fn()
  }
  jest.doMock('@/service/api', () => ({
    __esModule: true,
    default: serviceMock
  }))
  const securityModule = require('@/store/modules/Security').default
  return { securityModule, serviceMock }
}

describe('store/modules/Security fetchMyPermissions', () => {
  it('reuses the same in-flight request for concurrent callers', async () => {
    const { securityModule, serviceMock } = loadSecurityModuleWithMocks()
    const state = {
      matrix: {},
      assignments: [],
      permissions: [],
      loaded: false,
      loading: false
    }
    const commit = jest.fn((type, value) => {
      if (type === 'setLoading') state.loading = value
    })
    let resolveRequest
    serviceMock.security.mockReturnValue(new Promise(resolve => {
      resolveRequest = resolve
    }))

    const first = securityModule.actions.fetchMyPermissions({
      state,
      commit,
      rootGetters: {
        'auth/profile': { _id: 'acc-1' }
      }
    })
    const second = securityModule.actions.fetchMyPermissions({
      state,
      commit,
      rootGetters: {
        'auth/profile': { _id: 'acc-1' }
      }
    })

    expect(serviceMock.security).toHaveBeenCalledTimes(1)
    resolveRequest({
      data: {
        data: {
          matrix: {
            '/dashboard': { view: true }
          },
          assignments: [],
          permissions: []
        }
      }
    })

    await Promise.all([first, second])

    expect(commit).toHaveBeenCalledWith('setMyPermissions', expect.objectContaining({
      matrix: expect.objectContaining({
        '/dashboard': expect.objectContaining({ view: true })
      })
    }))
    expect(commit).toHaveBeenLastCalledWith('setLoading', false)
  })
})
