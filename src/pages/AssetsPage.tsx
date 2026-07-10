import { AlertTriangle, Boxes, Download, Laptop, Plus, Search, Smartphone, Star, Wifi } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useRole } from '../context/RoleContext'
import { addMonths, DEPRECIATION_RATE_PER_YEAR, daysUntil, extraAssets, fmtDate, parseWarranty, TODAY, WARRANTY_ASSUMED_YEARS } from '../data/assetsExtra'
import { assets as initial } from '../data/mockData'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useI18n } from '../i18n/I18nContext'
import type { TranslationKey } from '../i18n/translations'
import type { Asset } from '../types'
import { formatCurrency } from '../utils/format'
import '../styles/assets-extra.css'

interface LifecycleStage { label: string; date: Date; status: 'done' | 'current' | 'planned' }

function deriveLifecycle(asset: Asset, t: (key: TranslationKey) => string): LifecycleStage[] {
  const warrantyDate = parseWarranty(asset.warranty) ?? addMonths(TODAY, 12)
  const purchaseDate = addMonths(warrantyDate, -12 * WARRANTY_ASSUMED_YEARS)
  const inUseDate = addMonths(purchaseDate, 1)
  const maintenanceDate = addMonths(purchaseDate, Math.round(12 * WARRANTY_ASSUMED_YEARS * 0.6))
  const stages: LifecycleStage[] = [
    { label: t('assets.lifecycle.purchase'), date: purchaseDate, status: 'done' },
    { label: t('assets.lifecycle.inUse'), date: inUseDate, status: inUseDate <= TODAY ? 'done' : 'planned' },
  ]
  if (asset.status === 'Manutenção') stages.push({ label: t('assets.lifecycle.maintenance'), date: maintenanceDate, status: 'current' })
  else stages.push({ label: t('assets.lifecycle.maintenanceExpected'), date: maintenanceDate, status: maintenanceDate <= TODAY ? 'done' : 'planned' })
  stages.push({ label: t('assets.lifecycle.disposal'), date: warrantyDate, status: warrantyDate <= TODAY ? 'current' : 'planned' })
  return stages
}

function currentEstimatedValue(asset: Asset, purchaseDate: Date) {
  const years = Math.max(0, (TODAY.getTime() - purchaseDate.getTime()) / (365 * 86400000))
  const factor = Math.max(0, 1 - DEPRECIATION_RATE_PER_YEAR * years)
  return Math.round(asset.value * factor)
}

function hashCode(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h >>> 0
}

function generateGrid(id: string, size: number) {
  let seed = hashCode(id) || 1
  const cells: boolean[] = []
  for (let i = 0; i < size * size; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    cells.push(seed % 100 < 46)
  }
  return cells
}

function AssetCode({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const size = 12, cell = 10
    canvas.width = size * cell
    canvas.height = size * cell
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const grid = generateGrid(id, size)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#0a1726'
    grid.forEach((on, i) => {
      if (!on) return
      const x = (i % size) * cell, y = Math.floor(i / size) * cell
      ctx.fillRect(x, y, cell, cell)
    })
    // marcadores de canto para lembrar um QR real
    ctx.fillRect(0, 0, cell * 2, cell * 2)
    ctx.fillRect((size - 2) * cell, 0, cell * 2, cell * 2)
    ctx.fillRect(0, (size - 2) * cell, cell * 2, cell * 2)
  }, [id])
  return <canvas ref={ref} className="asset-code-canvas" />
}

export default function AssetsPage() {
  const { t } = useI18n()
  const { logAction } = useAudit()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { canEdit } = useRole()
  const [assets, setAssets] = useLocalStorage<Asset[]>('opsphere-assets', [...initial, ...extraAssets])
  const [query, setQuery] = useState(''), [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'Notebook', owner: '', location: '' })
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null)

  const visible = useMemo(() => assets.filter(a => `${a.name} ${a.id} ${a.owner}`.toLowerCase().includes(query.toLowerCase())), [assets, query])

  const warrantyStatus = (asset: Asset) => {
    const date = parseWarranty(asset.warranty)
    if (!date) return null
    const days = daysUntil(date)
    if (days < 0) return { level: 'expired' as const, days }
    if (days <= 90) return { level: 'soon' as const, days }
    return null
  }
  const expiringAssets = useMemo(() => assets.map(a => ({ asset: a, status: warrantyStatus(a) })).filter(x => x.status), [assets])

  const create = () => {
    if (!form.name) return
    setAssets(v => [{ id: `AT-${1030 + v.length}`, name: form.name, type: form.type, owner: form.owner || '—', status: 'Ativo', location: form.location || 'São Paulo', value: 0, warranty: '—' }, ...v])
    logAction(t('assets.audit.registered'), `${form.name} ${t('assets.audit.addedToInventory')}`)
    setModal(false)
  }
  const icon = (type: string) => type === 'Notebook' ? <Laptop /> : type === 'Mobile' ? <Smartphone /> : type === 'Rede' ? <Wifi /> : <Boxes />

  const exportDepreciationReport = () => {
    const rows = assets.map(a => {
      const stages = deriveLifecycle(a, t)
      const purchaseDate = stages[0].date
      const current = currentEstimatedValue(a, purchaseDate)
      const depreciationPct = a.value ? Math.round((1 - current / a.value) * 100) : 0
      return { a, purchaseDate, current, depreciationPct }
    })
    const header = 'ID,Nome,Tipo,Valor de compra,Data de compra,Valor atual estimado,Depreciacao (%)\n'
    const body = rows.map(r => `${r.a.id},"${r.a.name}",${r.a.type},${r.a.value},${fmtDate(r.purchaseDate)},${r.current},${r.depreciationPct}`).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'relatorio-depreciacao-ativos.csv'
    link.click()
    URL.revokeObjectURL(url)
    logAction(t('assets.audit.reportExported'), t('assets.audit.depreciationReportExported'))
  }

  return <>
    <PageHeader eyebrow={t('assets.eyebrow')} title={t('assets.title')} description={t('assets.description')} actions={<div style={{ display: 'flex', gap: 8 }}><button className="button" onClick={exportDepreciationReport}><Download size={16} /> {t('assets.exportDepreciation')}</button><button className="button button--primary" disabled={!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={() => setModal(true)}><Plus size={16} /> {t('assets.registerAsset')}</button></div>} />

    <section className="asset-summary">
      <div><span>{t('assets.summary.totalValue')}</span><strong>{formatCurrency(assets.reduce((s, a) => s + a.value, 0))}</strong></div>
      <div><span>{t('assets.summary.inUse')}</span><strong>{assets.filter(a => a.status === 'Ativo').length}</strong></div>
      <div><span>{t('assets.summary.inMaintenance')}</span><strong>{assets.filter(a => a.status === 'Manutenção').length}</strong></div>
      <div><span>{t('assets.summary.warrantyExpiring')}</span><strong>{expiringAssets.length}</strong></div>
    </section>

    {expiringAssets.length > 0 && <section className="panel warranty-alert-panel">
      <div className="panel__header" style={{ padding: 0, border: 'none' }}><div><span className="eyebrow">{t('assets.warranty.alert')}</span><h2><AlertTriangle size={16} /> {t('assets.warranty.expiringOrExpired')}</h2></div></div>
      <div className="warranty-alert-panel__list">
        {expiringAssets.map(({ asset, status }) => <div className="warranty-alert-panel__item" key={asset.id}>
          <span><strong>{asset.name}</strong><small>{asset.id} · {asset.owner}</small></span>
          <span>{status!.level === 'expired' ? `${t('assets.warranty.expiredPrefix')} ${Math.abs(status!.days)} ${t('assets.warranty.expiredSuffix')}` : `${t('assets.warranty.dueInPrefix')} ${status!.days} ${t('assets.warranty.dueInSuffix')}`}</span>
        </div>)}
      </div>
    </section>}

    <section className="panel table-panel">
      <div className="table-toolbar"><label className="search-input"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('assets.searchPlaceholder')} /></label><select><option>Todos os tipos</option><option>Notebook</option><option>Rede</option><option>Mobile</option></select></div>
      <div className="asset-table data-table">
        <div className="data-table__head"><span>{t('assets.table.asset')}</span><span>{t('assets.table.owner')}</span><span>{t('assets.table.status')}</span><span>{t('assets.table.location')}</span><span>{t('assets.table.value')}</span><span>{t('assets.table.warranty')}</span><span>{t('assets.table.actions')}</span></div>
        {visible.map(a => {
          const status = warrantyStatus(a)
          return <div className="data-table__row" key={a.id}>
            <span><i className="asset-icon">{icon(a.type)}</i><span><strong>{a.name}</strong><small>{a.id} · {a.type}</small></span></span>
            <span>{a.owner}</span>
            <span><Badge tone={a.status}>{a.status}</Badge></span>
            <span>{a.location}</span>
            <span>{formatCurrency(a.value)}</span>
            <span>{a.warranty}{status && <span className="badge-warning-inline">{status.level === 'expired' ? t('assets.warranty.expiredTag') : `${status.days}d`}</span>}</span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="icon-button" title="Favoritar" onClick={() => toggleFavorite({ id: a.id, module: 'assets', label: a.name })}><Star fill={isFavorite('assets', a.id) ? 'currentColor' : 'none'} size={14} /></button>
              <button className="button button--small" onClick={() => setDetailAsset(a)}>{t('assets.details')}</button>
            </span>
          </div>
        })}
      </div>
    </section>

    {modal && <Modal title={t('assets.modal.registerTitle')} onClose={() => setModal(false)}><div className="form-grid"><label className="span-2">{t('assets.form.name')}<input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('assets.form.namePlaceholder')} /></label><label>{t('assets.form.type')}<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option>Notebook</option><option>Mobile</option><option>Rede</option><option>Segurança</option></select></label><label>{t('assets.form.owner')}<input value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} /></label><label className="span-2">{t('assets.form.location')}<input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></label><div className="form-actions span-2"><button className="button" onClick={() => setModal(false)}>{t('assets.cancel')}</button><button className="button button--primary" disabled={!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={create}>{t('assets.register')}</button></div></div></Modal>}

    {detailAsset && (() => {
      const stages = deriveLifecycle(detailAsset, t)
      const current = currentEstimatedValue(detailAsset, stages[0].date)
      const depreciationPct = detailAsset.value ? Math.round((1 - current / detailAsset.value) * 100) : 0
      return <Modal title={`${t('assets.detailTitlePrefix')} ${detailAsset.name}`} onClose={() => setDetailAsset(null)}>
        <div className="asset-detail-grid">
          <div><AssetCode id={detailAsset.id} /><div className="asset-code-label">{t('assets.codeLabel')}<br />{detailAsset.id}</div></div>
          <div>
            <span className="eyebrow">{t('assets.lifecycle.eyebrow')}</span>
            <div className="lifecycle-timeline">
              {stages.map((s, i) => <div className={`lifecycle-timeline__stage is-${s.status}`} key={i}><span className="lifecycle-timeline__dot" /><div><strong>{s.label}</strong><small>{fmtDate(s.date)}</small></div></div>)}
            </div>
          </div>
        </div>
        <span className="eyebrow">{t('assets.depreciation.eyebrow')}</span>
        <div className="depreciation-row"><span>{t('assets.depreciation.purchaseValue')}</span><strong>{formatCurrency(detailAsset.value)}</strong></div>
        <div className="depreciation-row"><span>{t('assets.depreciation.currentValue')}</span><strong>{formatCurrency(current)}</strong></div>
        <div className="depreciation-row"><span>{t('assets.depreciation.accumulated')}</span><strong>{depreciationPct}%</strong></div>
      </Modal>
    })()}
  </>
}
