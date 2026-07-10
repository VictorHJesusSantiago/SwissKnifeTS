import { useRef, useState } from 'react'
import { Compass, Dices, Download, RotateCcw, Shield, Star, Trash2, Upload } from 'lucide-react'
import { useTour } from '../context/TourContext'
import { PageHeader } from '../components/ui/PageHeader'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n/I18nContext'
import { useFavorites } from '../context/FavoritesContext'
import { useAudit } from '../context/AuditContext'
import { useNotifications } from '../context/NotificationContext'
import { useRole } from '../context/RoleContext'
import { useCurrentUser, mockUsers } from '../context/CurrentUserContext'
import { exportBackup, importBackup, clearAllData } from '../utils/backup'
import { ShortcutEditor } from '../components/settings/ShortcutEditor'
import { classNames } from '../utils/format'
import { getSeed, setSeed, randomSeed } from '../utils/seed'

export default function SettingsPage() {
  const { theme, toggleTheme, density, setDensity } = useTheme()
  const { lang, setLang, t } = useI18n()
  const { favorites, toggleFavorite } = useFavorites()
  const { entries, clear } = useAudit()
  const { addNotification } = useNotifications()
  const { role, setRole } = useRole()
  const { user, switchUser } = useCurrentUser()
  const { start: startTour } = useTour()
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [seedValue, setSeedValue] = useState(() => getSeed())

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
  </>
}
