import { Bell, Search } from 'lucide-react'

export function Topbar({ onSearch }: { onSearch: (value: string) => void }) {
  return <header className="topbar">
    <label className="global-search"><Search size={17}/><input placeholder="Buscar em toda a plataforma..." onChange={e => onSearch(e.target.value)}/><kbd>⌘ K</kbd></label>
    <div className="topbar__right"><span className="live-status"><i/> Sistemas operacionais</span><button className="icon-button"><Bell size={19}/><b/></button><div className="avatar">VL</div></div>
  </header>
}
