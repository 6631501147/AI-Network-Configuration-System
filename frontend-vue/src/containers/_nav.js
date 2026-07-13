export default function buildNav (t) {
  return [
    {
      _name: 'CSidebarNav',
      _children: [
        {
          _name: 'CSidebarNavItem',
          name: t('nav.dashboard'),
          to: '/dashboard',
          icon: 'cil-speedometer',
          permission: { path: '/dashboard', action: 'view' }
        },
        {
          _name: 'CSidebarNavItem',
          name: 'AI Engine',
          href: '/ai-engine/dashboard.html',
          icon: 'cil-chart-pie',
          permission: { path: '/dashboard', action: 'view' }
        },
      ]
    }
  ]
}
