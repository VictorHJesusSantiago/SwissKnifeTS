import { Command, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { navigation } from '../../config/navigation'
import type { ModuleId } from '../../types'
import { classNames } from '../../utils/format'

export function Sidebar({ active, collapsed, onToggle, onNavigate }: { active: ModuleId; collapsed: boolean; onToggle: () => void; onNavigate: (id: ModuleId) => void }) {
  const sections = [...new Set(navigation.map(item => item.section))]
  return <aside className={classNames('sidebar', collapsed && 'sidebar--collapsed')}>
    <div className="brand"><div className="brand__mark"><Command size={20}/></div><div><strong>opsphere</strong><span>control center</span></div></div>
    <nav data-tour="sidebar-nav">{sections.map(section => <div className="nav-section" key={section}>
      <span className="nav-section__label">{section}</span>
      {navigation.filter(i => i.section===section).map(item => <button key={item.id} title={item.label} data-tour={item.id === 'settings' ? 'settings-link' : undefined} className={classNames('nav-item', active===item.id && 'is-active')} onClick={() => onNavigate(item.id)}>
        <item.icon size={18}/><span>{item.label}</span>{active===item.id && <i/>}
      </button>)}
    </div>)}</nav>
    <button className="sidebar__toggle" onClick={onToggle}>{collapsed ? <PanelLeftOpen size={17}/> : <><PanelLeftClose size={17}/><span>Recolher menu</span></>}</button>
  </aside>
}
