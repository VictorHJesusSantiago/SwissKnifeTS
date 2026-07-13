import { useRef, useState } from 'react'
import { Compass, Dices, Download, HelpCircle, Play, RotateCcw, Save, Shield, Sparkles, Star, Trash2, Upload } from 'lucide-react'
import { useTour } from '../context/TourContext'
import { PageHeader } from '../components/ui/PageHeader'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n/I18nContext'
import { useFavorites } from '../context/FavoritesContext'
import { useAudit } from '../context/AuditContext'
import { useNotifications } from '../context/NotificationContext'
import { useRole } from '../context/RoleContext'
import { useCurrentUser, mockUsers } from '../context/CurrentUserContext'
import { useUIPrefs, accentColors, type AccentColor } from '../context/UIPrefsContext'
import { useNavigationStats } from '../context/NavigationStatsContext'
import { useErrorLog } from '../context/ErrorLogContext'
import { useDemoMode } from '../context/DemoModeContext'
import { navigation } from '../config/navigation'
import { exportBackup, importBackup, clearAllData } from '../utils/backup'
import { ShortcutEditor } from '../components/settings/ShortcutEditor'
import { classNames } from '../utils/format'
import { getSeed, setSeed, randomSeed } from '../utils/seed'
import { listProfiles, saveProfile, applyProfile, deleteProfile } from '../utils/configProfiles'
import { ChangelogModal } from '../components/changelog/ChangelogModal'

function storageSizeKb() {
  let total = 0
  Object.keys(localStorage).filter(k => k.startsWith('opsphere-')).forEach(k => { total += (localStorage.getItem(k)?.length ?? 0) })
  return (total / 1024).toFixed(1)
}

export default function SettingsPage() {
  const { theme, toggleTheme, density, setDensity } = useTheme()
  const { lang, setLang, t } = useI18n()
  const { favorites, toggleFavorite } = useFavorites()
  const { entries, clear } = useAudit()
  const { addNotification } = useNotifications()
  const { role, setRole } = useRole()
  const { user, switchUser } = useCurrentUser()
  const { start: startTour } = useTour()
  const uiPrefs = useUIPrefs()
  const { visitCounts } = useNavigationStats()
  const { errors, clearErrors } = useErrorLog()
  const demo = useDemoMode()
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [seedValue, setSeedValue] = useState(() => getSeed())
  const [profiles, setProfiles] = useState(() => listProfiles())
  const [profileName, setProfileName] = useState('')
  const [showChangelog, setShowChangelog] = useState(false)

  const saveCurrentProfile = () => {
    if (!profileName.trim()) return
    saveProfile(profileName.trim())
    setProfiles(listProfiles())
    addNotification('Perfil salvo', `Perfil "${profileName.trim()}" salvo com as preferências atuais.`, 'healthy')
    setProfileName('')
  }
  const applyStoredProfile = (name: string) => {
    applyProfile(name)
    addNotification('Perfil aplicado', `Preferências do perfil "${name}" aplicadas. Recarregue para ver tudo.`, 'info')
    setTimeout(() => window.location.reload(), 300)
  }
  const removeProfile = (name: string) => {
    deleteProfile(name)
    setProfiles(listProfiles())
  }

  const clearStorageKey = (key: string) => {
    localStorage.removeItem(key)
    window.location.reload()
  }

  const topModules = Object.entries(visitCounts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 5)
  const opsphereKeys = Object.keys(localStorage).filter(k => k.startsWith('opsphere-')).sort()

  const applySeed = () => {
    setSeed(seedValue)
    addNotification('Seed aplicado', `Os dados de demonstração serão regenerados com o seed ${seedValue}.`, 'info')
    setTimeout(() => window.location.reload(), 300)
  }
  const randomizeSeed = () => {
    const next = randomSeed()
    setSeedValue(next)
    setSeed(next)
    setTimeout(() => window.location.reload(), 300)
  }

  const handleImport = async (file: File) => {
    try {
      await importBackup(file)
      setStatus('Backup importado com sucesso. Recarregue a página para ver as mudanças.')
      addNotification('Backup importado', 'Os dados locais foram restaurados a partir do arquivo.', 'healthy')
    } catch {
      setStatus('Falha ao importar backup: arquivo inválido.')
    }
  }

  const handleReset = () => {
    if (!confirm('Regenerar todos os dados de demonstração? Isso substitui os dados salvos localmente.')) return
    clearAllData()
    addNotification('Dados regenerados', 'Os dados de demonstração foram restaurados para o padrão.', 'info')
    setTimeout(() => window.location.reload(), 300)
  }

  const handleClear = () => {
    if (!confirm('Limpar TODOS os dados salvos localmente? Esta ação não pode ser desfeita.')) return
    clearAllData()
    window.location.reload()
  }

  return <>
    <PageHeader eyebrow="PLATAFORMA" title={t('settings.title')} description="Preferências de aparência, idioma, dados locais e produtividade."/>
    <section className="settings-grid">
      <article className="panel">
        <div className="panel__header"><div><span className="eyebrow">{t('settings.appearance').toUpperCase()}</span><h2>{t('settings.appearance')}</h2></div></div>
        <div className="settings-block">
          <div className="settings-row">
            <span>{t('settings.theme')}</span>
            <div className="segmented">
              <button className={classNames(theme === 'dark' && 'is-active')} onClick={() => theme !== 'dark' && toggleTheme()}>{t('settings.theme.dark')}</button>
              <button className={classNames(theme === 'light' && 'is-active')} onClick={() => theme !== 'light' && toggleTheme()}>{t('settings.theme.light')}</button>
            </div>
          </div>
          <div className="settings-row">
            <span>{t('settings.density')}</span>
            <div className="segmented">
              <button className={classNames(density === 'comfortable' && 'is-active')} onClick={() => setDensity('comfortable')}>{t('settings.density.comfortable')}</button>
              <button className={classNames(density === 'compact' && 'is-active')} onClick={() => setDensity('compact')}>{t('settings.density.compact')}</button>
            </div>
          </div>
          <div className="settings-row">
            <span>{t('settings.language')}</span>
            <div className="segmented">
              <button className={classNames(lang === 'pt' && 'is-active')} onClick={() => setLang('pt')}>PT</button>
              <button className={classNames(lang === 'en' && 'is-active')} onClick={() => setLang('en')}>EN</button>
            </div>
          </div>
          <div className="settings-row">
            <span>Cor de destaque</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {(Object.keys(accentColors) as AccentColor[]).map(c => <button key={c} className={classNames('accent-swatch', uiPrefs.accentColor === c && 'is-active')} style={{ background: accentColors[c] }} title={c} onClick={() => uiPrefs.setAccentColor(c)}/>)}
            </div>
          </div>
          <div className="settings-row">
            <span>Zoom da interface ({uiPrefs.uiScale}%)</span>
            <input type="range" min={80} max={130} step={5} value={uiPrefs.uiScale} onChange={e => uiPrefs.setUiScale(Number(e.target.value))}/>
          </div>
          <div className="settings-row"><span>Alto contraste</span><div className="segmented"><button className={classNames(uiPrefs.highContrast && 'is-active')} onClick={uiPrefs.toggleHighContrast}>{uiPrefs.highContrast ? 'Ativado' : 'Desativado'}</button></div></div>
          <div className="settings-row"><span>Modo leitura</span><div className="segmented"><button className={classNames(uiPrefs.readingMode && 'is-active')} onClick={uiPrefs.toggleReadingMode}>{uiPrefs.readingMode ? 'Ativado' : 'Desativado'}</button></div></div>
          <div className="settings-row"><span>Modo somente teclado</span><div className="segmented"><button className={classNames(uiPrefs.keyboardOnly && 'is-active')} onClick={uiPrefs.toggleKeyboardOnly}>{uiPrefs.keyboardOnly ? 'Ativado' : 'Desativado'}</button></div></div>
          <div className="settings-row"><span>Modo apresentação (Ctrl+Shift+P)</span><div className="segmented"><button className={classNames(uiPrefs.presentationMode && 'is-active')} onClick={uiPrefs.togglePresentationMode}>{uiPrefs.presentationMode ? 'Ativado' : 'Desativado'}</button></div></div>
        </div>
      </article>

      <article className="panel">
        <div className="panel__header"><div><span className="eyebrow">DEMONSTRAÇÃO</span><h2>Modo demonstração automática</h2></div></div>
        <div className="settings-block">
          <p style={{ color: 'var(--muted)', fontSize: 11, margin: 0 }}>Navega automaticamente entre todos os módulos a cada 4s — útil para vitrine em telas/apresentações. Atalho: Ctrl+Shift+M.</p>
          {demo.active
            ? <button className="button button--full" onClick={demo.stop}><Sparkles size={15}/> Parar demonstração</button>
            : <button className="button button--full button--primary" onClick={demo.start}><Play size={15}/> Iniciar demonstração</button>}
          <button className="button button--full" onClick={() => setShowChangelog(true)}><HelpCircle size={15}/> Ver o que há de novo</button>
        </div>
      </article>

      <article className="panel">
        <div className="panel__header"><div><span className="eyebrow">PERFIS</span><h2>Perfis de configuração</h2></div></div>
        <div className="settings-block">
          <div style={{ display: 'flex', gap: 6 }}>
            <input placeholder="Nome do perfil (ex: meu setup)" value={profileName} onChange={e => setProfileName(e.target.value)} style={{ flex: 1 }}/>
            <button className="button button--tiny" onClick={saveCurrentProfile}><Save size={12}/> Salvar</button>
          </div>
          {profiles.length === 0 && <div className="empty-compact"><span>Nenhum perfil salvo ainda.</span></div>}
          {profiles.map(p => <div className="favorite-row" key={p.name}>
            <span>{p.name} <small style={{ color: 'var(--muted)' }}>({p.savedAt})</small></span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="button button--tiny" onClick={() => applyStoredProfile(p.name)}>Aplicar</button>
              <button className="icon-button" onClick={() => removeProfile(p.name)}><Trash2 size={14}/></button>
            </div>
          </div>)}
        </div>
      </article>

      <article className="panel">
        <div className="panel__header"><div><span className="eyebrow">SAÚDE DO APP</span><h2>Armazenamento local</h2></div></div>
        <div className="settings-block">
          <div className="app-health__row"><span>Total ocupado</span><strong>{storageSizeKb()} KB</strong></div>
          <div className="app-health__bar"><i style={{ width: `${Math.min(100, Number(storageSizeKb()) / 5)}%` }}/></div>
          {opsphereKeys.map(key => <div className="app-health__row" key={key}>
            <span>{key.replace('opsphere-', '')}</span>
            <button onClick={() => clearStorageKey(key)}>Limpar</button>
          </div>)}
          <div className="app-health__row"><span>Erros de JS registrados</span><strong>{errors.length}</strong></div>
          {errors.length > 0 && <button className="button button--tiny" onClick={clearErrors}>Limpar log de erros</button>}
        </div>
      </article>

      <article className="panel">
        <div className="panel__header"><div><span className="eyebrow">USO PESSOAL</span><h2>Módulos mais acessados</h2></div></div>
        <div className="settings-block">
          {topModules.length === 0 && <div className="empty-compact"><span>Ainda sem dados de navegação nesta sessão.</span></div>}
          {topModules.map(([id, count]) => <div className="settings-row" key={id}>
            <span>{navigation.find(n => n.id === id)?.label ?? id}</span><strong>{count}x</strong>
          </div>)}
        </div>
      </article>

      <article className="panel">
        <div className="panel__header"><div><span className="eyebrow">PRODUTIVIDADE</span><h2>{t('settings.shortcuts')}</h2></div></div>
        <ShortcutEditor/>
        <div className="settings-block">
          <button className="button button--full" onClick={startTour}><Compass size={15}/> Rever tour guiado</button>
        </div>
      </article>

      <article className="panel">
        <div className="panel__header"><div><span className="eyebrow">BACKUP</span><h2>{t('settings.data')}</h2></div></div>
        <div className="settings-block">
          <button className="button button--full" onClick={() => exportBackup()}><Download size={15}/> {t('settings.export')}</button>
          <button className="button button--full" onClick={() => fileRef.current?.click()}><Upload size={15}/> {t('settings.import')}</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])}/>
          <button className="button button--full" onClick={handleReset}><RotateCcw size={15}/> {t('settings.reset')}</button>
          <button className="button button--full text-danger" onClick={handleClear}><Trash2 size={15}/> {t('settings.clear')}</button>
          <div className="settings-row">
            <span>{t('settings.seed')}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="number" style={{ width: 110 }} value={seedValue} onChange={e => setSeedValue(Number(e.target.value))}/>
              <button className="button button--tiny" onClick={applySeed}>{t('settings.seed.apply')}</button>
              <button className="button button--tiny" onClick={randomizeSeed}><Dices size={12}/></button>
            </div>
          </div>
          {status && <div className="notice-banner"><span>{status}</span></div>}
        </div>
      </article>

      <article className="panel">
        <div className="panel__header"><div><span className="eyebrow">{t('settings.access').toUpperCase()}</span><h2>{t('settings.access')}</h2></div><Shield size={17}/></div>
        <div className="settings-block">
          <div className="settings-row">
            <span>{t('settings.role')}</span>
            <div className="segmented">
              <button className={classNames(role === 'admin' && 'is-active')} onClick={() => setRole('admin')}>{t('settings.role.admin')}</button>
              <button className={classNames(role === 'viewer' && 'is-active')} onClick={() => setRole('viewer')}>{t('settings.role.viewer')}</button>
            </div>
          </div>
          {role === 'viewer' && <div className="locked-hint"><Shield size={13}/> Como visualizador, ações de edição/criação ficam bloqueadas nos módulos.</div>}
          <div className="settings-row">
            <span>{t('settings.currentUser')}</span>
            <select value={user.id} onChange={e => switchUser(e.target.value)}>
              {mockUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role === 'admin' ? 'admin' : 'viewer'})</option>)}
            </select>
          </div>
        </div>
      </article>

      <article className="panel">
        <div className="panel__header"><div><span className="eyebrow">{t('settings.favorites').toUpperCase()}</span><h2>{t('settings.favorites')}</h2></div></div>
        <div className="favorite-list">
          {favorites.length === 0 && <div className="empty-compact"><Star size={18}/><span>Nenhum favorito ainda. Use a estrela nos itens de cada módulo.</span></div>}
          {favorites.map(f => <div className="favorite-row" key={`${f.module}-${f.id}`}>
            <span>{f.label}</span>
            <button className="icon-button" onClick={() => toggleFavorite(f)}><Trash2 size={14}/></button>
          </div>)}
        </div>
      </article>

      <article className="panel panel--wide">
        <div className="panel__header"><div><span className="eyebrow">HISTÓRICO</span><h2>{t('settings.audit')}</h2></div><button className="link-button" onClick={clear}>Limpar histórico</button></div>
        <div className="audit-list">
          {entries.length === 0 && <div className="empty-compact"><span>Nenhuma atividade registrada nesta sessão.</span></div>}
          {entries.slice(0, 30).map(e => <div className="audit-row" key={e.id}><time>{e.time}</time><strong>{e.action}{e.actor ? ` · ${e.actor}` : ''}</strong><span>{e.detail}</span></div>)}
        </div>
      </article>
    </section>
    {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)}/>}
  </>
}
