describe('Security shared bootstrap', () => {
  let normalizeAIBasedAutomaticNetworkConfigurationSystemData

  beforeEach(() => {
    process.env.VUE_APP_PROJECT_PERMISSION_PATHS = '/dashboard,/security/permissions/menu,/security/permissions/group,/security/permissions/matrix,/security/audit,/accounts/directory'
    jest.resetModules()
    normalizeAIBasedAutomaticNetworkConfigurationSystemData = require('@/store/modules/Security/bootstrap-filter').normalizeAIBasedAutomaticNetworkConfigurationSystemData
  })

  it('filters aibasedautomaticnetworkconfigurationsystem security bootstrap to aibasedautomaticnetworkconfigurationsystem-owned IAM paths only', () => {
    const result = normalizeAIBasedAutomaticNetworkConfigurationSystemData({
      types: [
        { _id: 'type-1', name: 'AI Based Automatic Network Configuration System Administration' },
        { _id: 'type-custom', name: 'Custom AIBasedAutomaticNetworkConfigurationSystem Type', appId: 'aibasedautomaticnetworkconfigurationsystem' },
        { _id: 'type-2', name: 'Other System' }
      ],
      menus: [
        { _id: 'menu-1', path: '/dashboard' },
        { _id: 'menu-2', path: '/ai-based-automatic-network-configuration-system/security/permission' },
        { _id: 'menu-custom', path: '/custom/aibasedautomaticnetworkconfigurationsystem-tool', typeId: 'type-custom', appId: 'aibasedautomaticnetworkconfigurationsystem' },
        { _id: 'menu-3', path: '/other' }
      ],
      groups: [
        { _id: 'group-1', visibleTypeId: 'type-1' },
        { _id: 'group-2', visibleTypeId: 'type-2' }
      ],
      permissions: [
        { _id: 'perm-1', groupId: 'group-1', menuId: 'menu-1' },
        { _id: 'perm-2', groupId: 'group-1', menuId: 'menu-2' },
        { _id: 'perm-3', groupId: 'group-2', menuId: 'menu-3' }
      ]
    })

    expect(result.types).toHaveLength(2)
    expect(result.types[0]._id).toBe('type-1')
    expect(result.types.map(item => item._id).sort()).toEqual(['type-1', 'type-custom'])
    expect(result.menus).toHaveLength(3)
    expect(result.menus.map(item => item.path).sort()).toEqual([
      '/custom/aibasedautomaticnetworkconfigurationsystem-tool',
      '/dashboard',
      '/ai-based-automatic-network-configuration-system/security/permission'
    ])
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0]._id).toBe('group-1')
    expect(result.permissions).toHaveLength(2)
    expect(result.permissions.map(item => item._id).sort()).toEqual([
      'perm-1',
      'perm-2'
    ])
  })
})
