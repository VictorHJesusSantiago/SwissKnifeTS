import { AlertTriangle, ArrowLeftRight, Bookmark, Boxes, CheckSquare, Download, FileText, Laptop, Plus, Printer, Search, Smartphone, Square, Star, Wifi } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart } from '../components/charts/BarChart'
import { Badge } from '../components/ui/Badge'
import { ExportCsvButton } from '../components/ui/ExportCsvButton'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { PrintButton } from '../components/ui/PrintButton'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useNotifications } from '../context/NotificationContext'
import { useRole } from '../context/RoleContext'
import {
  addMonths, CRITICALITY_LEVELS, type Criticality, daysInStock, daysUntil, DEFAULT_CHECKLIST_ITEMS,
  DEPRECIATION_RATE_PER_YEAR, estimateMaintenanceCost, extraAssets, fmtDate, type OwnershipProcess,
  parseWarranty, STOCK_ALERT_DAYS_THRESHOLD, TODAY, WARRANTY_ASSUMED_YEARS,
} from '../data/assetsExtra'
import { assets as initial } from '../data/mockData'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useI18n } from '../i18n/I18nContext'
import type { TranslationKey } from '../i18n/translations'
import type { Asset } from '../types'
import { classNames, formatCurrency } from '../utils/format'
import '../styles/assets-extra.css'
import '../styles/assets-extra2.css'

interface LifecycleStage { label: string; date: Date; status: 'done' | 'current' | 'planned' }

// --- Tipos locais para as extensões desta página (itens 21-30) ---
interface OwnershipTransfer { from: string; to: string; date: string }
interface ChecklistItem { label: string; done: boolean }
interface AssetChecklist { process: OwnershipProcess; items: ChecklistItem[] }
interface Reservation { reservedFor: string; date: string }
interface InvoiceMeta { name: string; size: number; type: string }

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

function AssetCode({ id, size = 12, cell = 10 }: { id: string; size?: number; cell?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
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
  }, [id, size, cell])
  return <canvas ref={ref} className="asset-code-canvas" />
}

export default function AssetsPage() {
  const { t } = useI18n()
  const { logAction } = useAudit()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { canEdit } = useRole()
  const { addNotification } = useNotifications()
  const [assets, setAssets] = useLocalStorage<Asset[]>('opsphere-assets', [...initial, ...extraAssets])
  const [query, setQuery] = useState(''), [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'Notebook', owner: '', location: '' })
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null)

  // --- Item 21: filtro combinado owner + localização ---
  const [ownerFilter, setOwnerFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [criticalityFilter, setCriticalityFilter] = useState('')

  // --- Item 22: histórico de transferência de posse ---
  const [ownerHistory, setOwnerHistory] = useLocalStorage<Record<string, OwnershipTransfer[]>>('opsphere-assets-owner-history', {})
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferOwner, setTransferOwner] = useState('')

  // --- Item 23: etiquetas em lote ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [labelSheetOpen, setLabelSheetOpen] = useState(false)

  // --- Item 24: checklist de onboarding/offboarding ---
  const [checklists, setChecklists] = useLocalStorage<Record<string, AssetChecklist>>('opsphere-assets-checklists', {})

  // --- Item 26: criticidade ---
  const [criticality, setCriticality] = useLocalStorage<Record<string, Criticality>>('opsphere-assets-criticality', {})

  // --- Item 27: nota fiscal / comprovante ---
  const [invoices, setInvoices] = useLocalStorage<Record<string, InvoiceMeta>>('opsphere-assets-invoices', {})

  // --- Item 29: reserva de equipamento ---
  const [reservations, setReservations] = useLocalStorage<Record<string, Reservation>>('opsphere-assets-reservations', {})
  const [reserveOpen, setReserveOpen] = useState(false)
  const [reserveName, setReserveName] = useState('')

  // --- Item 28: gráfico de distribuição ---
  const [distributionMode, setDistributionMode] = useState<'type' | 'location'>('type')

  const owners = useMemo(() => Array.from(new Set(assets.map(a => a.owner))).sort(), [assets])
  const locations = useMemo(() => Array.from(new Set(assets.map(a => a.location))).sort(), [assets])

  const visible = useMemo(() => assets.filter(a =>
    `${a.name} ${a.id} ${a.owner}`.toLowerCase().includes(query.toLowerCase()) &&
    (ownerFilter === '' || a.owner === ownerFilter) &&
    (locationFilter === '' || a.location === locationFilter) &&
    (criticalityFilter === '' || (criticality[a.id] ?? 'Normal') === criticalityFilter)
  ), [assets, query, ownerFilter, locationFilter, criticalityFilter, criticality])

  const warrantyStatus = (asset: Asset) => {
    const date = parseWarranty(asset.warranty)
    if (!date) return null
    const days = daysUntil(date)
    if (days < 0) return { level: 'expired' as const, days }
    if (days <= 90) return { level: 'soon' as const, days }
    return null
  }
  const expiringAssets = useMemo(() => assets.map(a => ({ asset: a, status: warrantyStatus(a) })).filter(x => x.status), [assets])

  // --- Item 25: alertas de auditoria (sem owner ou parado em estoque há muito tempo) ---
  const auditAlerts = useMemo(() => assets.filter(a =>
    a.owner === '—' || a.owner.trim() === '' ||
    (a.status === 'Estoque' && daysInStock(a.id) > STOCK_ALERT_DAYS_THRESHOLD)
  ), [assets])

  const notifiedRef = useRef(false)
  useEffect(() => {
    if (notifiedRef.current) return
    notifiedRef.current = true
    if (auditAlerts.length > 0) {
      addNotification(t('assets.audit.alertTitle'), `${auditAlerts.length} ${t('assets.audit.alertMessage')}`, 'critical')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const toggleSelected = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const transferOwnership = (asset: Asset) => {
    if (!transferOwner.trim()) return
    const from = asset.owner
    const to = transferOwner.trim()
    setAssets(list => list.map(a => a.id === asset.id ? { ...a, owner: to } : a))
    const entry: OwnershipTransfer = { from, to, date: fmtDate(new Date()) }
    setOwnerHistory(map => ({ ...map, [asset.id]: [entry, ...(map[asset.id] ?? [])] }))
    logAction(t('assets.audit.ownerTransferred'), `${asset.name}: ${from} → ${to}`)
    setDetailAsset({ ...asset, owner: to })
    setTransferOwner('')
    setTransferOpen(false)
  }

  const reserveAsset = (asset: Asset) => {
    if (!reserveName.trim()) return
    const reservation: Reservation = { reservedFor: reserveName.trim(), date: fmtDate(new Date()) }
    setReservations(map => ({ ...map, [asset.id]: reservation }))
    logAction(t('assets.audit.reserved'), `${asset.name} ${t('assets.audit.reservedDetail')} ${reservation.reservedFor}`)
    setReserveName('')
    setReserveOpen(false)
  }

  const startChecklist = (asset: Asset, process: OwnershipProcess) => {
    const items = DEFAULT_CHECKLIST_ITEMS[process].map(label => ({ label, done: false }))
    setChecklists(map => ({ ...map, [asset.id]: { process, items } }))
    logAction(t('assets.audit.checklistStarted'), `${asset.name}: ${process === 'entrega' ? t('assets.checklist.delivery') : t('assets.checklist.return')}`)
  }

  const toggleChecklistItem = (asset: Asset, index: number) => {
    setChecklists(map => {
      const current = map[asset.id]
      if (!current) return map
      const items = current.items.map((it, i) => i === index ? { ...it, done: !it.done } : it)
      return { ...map, [asset.id]: { ...current, items } }
    })
    logAction(t('assets.audit.checklistItemToggled'), asset.name)
  }

  const attachInvoice = (asset: Asset, file: File) => {
    const meta: InvoiceMeta = { name: file.name, size: file.size, type: file.type || 'desconhecido' }
    setInvoices(map => ({ ...map, [asset.id]: meta }))
    logAction(t('assets.audit.invoiceAttached'), `${asset.name}: ${file.name}`)
  }

  const distributionByType = useMemo(() => {
    const counts = new Map<string, number>()
    assets.forEach(a => counts.set(a.type, (counts.get(a.type) ?? 0) + 1))
    const palette = ['#6ce5c4', '#8097ff', '#ffc400', '#ff7082', '#6fd7a3']
    return Array.from(counts.entries()).map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }))
  }, [assets])

  const distributionByLocation = useMemo(() => {
    const counts = new Map<string, number>()
    assets.forEach(a => counts.set(a.location, (counts.get(a.location) ?? 0) + 1))
    const palette = ['#8097ff', '#6ce5c4', '#ffc400', '#ff7082', '#6fd7a3']
    return Array.from(counts.entries()).map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }))
  }, [assets])

  // --- Item 30: TCO ---
  const tcoRows = useMemo(() => assets.map(a => {
    const maintenance = estimateMaintenanceCost(a.value)
    return { asset: a, maintenance, total: a.value + maintenance }
  }), [assets])
  const tcoCsvRows = useMemo(() => tcoRows.map(r => ({
    ID: r.asset.id, Nome: r.asset.name, Tipo: r.asset.type,
    'Valor de compra': r.asset.value, 'Manutencao estimada': r.maintenance, 'TCO total': r.total,
  })), [tcoRows])

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

    {/* Item 25: alertas de auditoria */}
    {auditAlerts.length > 0 && <section className="panel audit-alert-panel">
      <div className="panel__header" style={{ padding: 0, border: 'none' }}><div><span className="eyebrow">{t('assets.alerts.eyebrow')}</span><h2><AlertTriangle size={16} /> {t('assets.alerts.title')}</h2></div></div>
      <div className="audit-alert-panel__list">
        {auditAlerts.map(a => {
          const noOwner = a.owner === '—' || a.owner.trim() === ''
          return <div className="audit-alert-panel__item" key={a.id}>
            <span><strong>{a.name}</strong><small>{a.id} · {a.location}</small></span>
            <span className="audit-alert-panel__tag">{noOwner ? t('assets.alerts.noOwner') : `${t('assets.alerts.longInStock')} ${daysInStock(a.id)} ${t('assets.alerts.days')}`}</span>
          </div>
        })}
      </div>
    </section>}

    {/* Item 28: distribuição de ativos */}
    <section className="panel distribution-panel">
      <div className="panel__header" style={{ padding: 0, border: 'none' }}><div><span className="eyebrow">{t('assets.distribution.eyebrow')}</span><h2>{distributionMode === 'type' ? t('assets.distribution.byType') : t('assets.distribution.byLocation')}</h2></div></div>
      <div className="distribution-panel__toggle">
        <button className={classNames('button', 'button--small', distributionMode === 'type' && 'button--primary')} onClick={() => setDistributionMode('type')}>{t('assets.distribution.byType')}</button>
        <button className={classNames('button', 'button--small', distributionMode === 'location' && 'button--primary')} onClick={() => setDistributionMode('location')}>{t('assets.distribution.byLocation')}</button>
      </div>
      <div className="distribution-panel__body">
        <BarChart data={distributionMode === 'type' ? distributionByType : distributionByLocation} />
      </div>
    </section>

    {/* Item 30: relatório de TCO */}
    <section className="panel tco-panel">
      <div className="panel__header" style={{ padding: 0, border: 'none' }}>
        <div><span className="eyebrow">{t('assets.tco.eyebrow')}</span><h2>{t('assets.tco.title')}</h2></div>
        <ExportCsvButton filename="relatorio-tco-ativos.csv" rows={tcoCsvRows} label={t('assets.tco.export')} />
      </div>
      <div className="tco-table">
        <div className="tco-table__head"><span>{t('assets.table.asset')}</span><span>{t('assets.tco.purchase')}</span><span>{t('assets.tco.maintenance')}</span><span>{t('assets.tco.total')}</span></div>
        {tcoRows.map(r => <div className="tco-table__row" key={r.asset.id}>
          <span>{r.asset.name}</span><span>{formatCurrency(r.asset.value)}</span><span>{formatCurrency(r.maintenance)}</span><strong>{formatCurrency(r.total)}</strong>
        </div>)}
      </div>
    </section>

    <section className="panel table-panel">
      <div className="table-toolbar asset-filters-row">
        <label className="search-input"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('assets.searchPlaceholder')} /></label>
        <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
          <option value="">{t('assets.filter.ownerAll')}</option>
          {owners.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
          <option value="">{t('assets.filter.locationAll')}</option>
          {locations.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={criticalityFilter} onChange={e => setCriticalityFilter(e.target.value)}>
          <option value="">{t('assets.filter.criticalityAll')}</option>
          {CRITICALITY_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {selectedIds.size > 0 && <button className="button button--small" onClick={() => setLabelSheetOpen(true)}><Printer size={14} /> {t('assets.printLabels')} ({selectedIds.size})</button>}
      </div>
      <div className="asset-table data-table data-table--with-select">
        <div className="data-table__head">
          <span></span>
          <span>{t('assets.table.asset')}</span><span>{t('assets.table.owner')}</span><span>{t('assets.table.status')}</span>
          <span>{t('assets.table.location')}</span><span>{t('assets.table.value')}</span><span>{t('assets.table.criticality')}</span>
          <span>{t('assets.table.warranty')}</span><span>{t('assets.table.actions')}</span>
        </div>
        {visible.map(a => {
          const status = warrantyStatus(a)
          const reservation = reservations[a.id]
          const isAlert = a.owner === '—' || a.owner.trim() === '' || (a.status === 'Estoque' && daysInStock(a.id) > STOCK_ALERT_DAYS_THRESHOLD)
          const assetCriticality = criticality[a.id] ?? 'Normal'
          return <div className={classNames('data-table__row', isAlert && 'asset-row--alert')} key={a.id}>
            <span className="asset-row-check">
              <button className="icon-button" onClick={() => toggleSelected(a.id)} title={t('assets.table.select')}>
                {selectedIds.has(a.id) ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
            </span>
            <span><i className="asset-icon">{icon(a.type)}</i><span><strong>{a.name}</strong><small>{a.id} · {a.type}</small></span></span>
            <span>{a.owner}</span>
            <span>
              <Badge tone={a.status}>{a.status}</Badge>
              {a.status === 'Estoque' && reservation && <span className="badge-reserved"><Bookmark size={10} /> {t('assets.reserved.badge')} {reservation.reservedFor}</span>}
            </span>
            <span>{a.location}</span>
            <span>{formatCurrency(a.value)}</span>
            <span>
              <select value={assetCriticality} disabled={!canEdit} onChange={e => setCriticality(map => ({ ...map, [a.id]: e.target.value as Criticality }))}>
                {CRITICALITY_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </span>
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

    {/* Item 23: etiquetas em lote — sheet estilo A4, fora do .modal-backdrop para não ser ocultado na impressão */}
    {labelSheetOpen && <div className="label-sheet-overlay" onMouseDown={() => setLabelSheetOpen(false)}>
      <div className="label-sheet" onMouseDown={e => e.stopPropagation()}>
        <div className="label-sheet__header">
          <h2>{t('assets.printLabels.title')}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <PrintButton />
            <button className="button no-print" onClick={() => setLabelSheetOpen(false)}>{t('assets.close')}</button>
          </div>
        </div>
        {selectedIds.size === 0 ? <p>{t('assets.printLabels.empty')}</p> : <div className="label-sheet__grid">
          {assets.filter(a => selectedIds.has(a.id)).map(a => <div className="label-sheet__cell" key={a.id}>
            <AssetCode id={a.id} size={10} cell={8} />
            <strong>{a.name}</strong>
            <small>{a.id}</small>
          </div>)}
        </div>}
      </div>
    </div>}

    {detailAsset && (() => {
      const stages = deriveLifecycle(detailAsset, t)
      const current = currentEstimatedValue(detailAsset, stages[0].date)
      const depreciationPct = detailAsset.value ? Math.round((1 - current / detailAsset.value) * 100) : 0
      const history = ownerHistory[detailAsset.id] ?? []
      const checklist = checklists[detailAsset.id]
      const invoice = invoices[detailAsset.id]
      const maintenance = estimateMaintenanceCost(detailAsset.value)
      const isStockLong = detailAsset.status === 'Estoque' && daysInStock(detailAsset.id) > STOCK_ALERT_DAYS_THRESHOLD
      return <Modal title={`${t('assets.detailTitlePrefix')} ${detailAsset.name}`} onClose={() => { setDetailAsset(null); setTransferOpen(false); setReserveOpen(false) }}>
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
        <div className="depreciation-row"><span>{t('assets.tco.maintenance')}</span><strong>{formatCurrency(maintenance)}</strong></div>
        <div className="depreciation-row"><span>{t('assets.tco.total')}</span><strong>{formatCurrency(detailAsset.value + maintenance)}</strong></div>

        {/* Item 22: transferência / histórico de posse */}
        <div className="asset-detail-section">
          <span className="eyebrow">{t('assets.transfer.history')}</span>
          <div className="ownership-history">
            {history.length === 0 ? <small>{t('assets.transfer.historyEmpty')}</small> : history.map((h, i) => (
              <div className="ownership-history__item" key={i}><span>{h.from} → {h.to}</span><small>{h.date}</small></div>
            ))}
          </div>
          {!transferOpen ? (
            <button className="button button--small" style={{ marginTop: 8 }} disabled={!canEdit} onClick={() => { setTransferOpen(true); setTransferOwner('') }}><ArrowLeftRight size={14} /> {t('assets.transfer.action')}</button>
          ) : (
            <div className="inline-form">
              <input placeholder={t('assets.transfer.newOwner')} value={transferOwner} onChange={e => setTransferOwner(e.target.value)} />
              <button className="button button--small button--primary" onClick={() => transferOwnership(detailAsset)}>{t('assets.transfer.confirm')}</button>
              <button className="button button--small" onClick={() => setTransferOpen(false)}>{t('assets.cancel')}</button>
            </div>
          )}
        </div>

        {/* Item 29: reserva de equipamento */}
        {detailAsset.status === 'Estoque' && <div className="asset-detail-section">
          <span className="eyebrow">{t('assets.reserve.title')}</span>
          {reservations[detailAsset.id] ? <p><Bookmark size={14} /> {t('assets.reserved.badge')} <strong>{reservations[detailAsset.id].reservedFor}</strong> ({reservations[detailAsset.id].date})</p> : (
            !reserveOpen ? <button className="button button--small" disabled={!canEdit} onClick={() => { setReserveOpen(true); setReserveName('') }}>{t('assets.reserve.action')}</button> : (
              <div className="inline-form">
                <input placeholder={t('assets.reserve.name')} value={reserveName} onChange={e => setReserveName(e.target.value)} />
                <button className="button button--small button--primary" onClick={() => reserveAsset(detailAsset)}>{t('assets.reserve.confirm')}</button>
                <button className="button button--small" onClick={() => setReserveOpen(false)}>{t('assets.cancel')}</button>
              </div>
            )
          )}
        </div>}

        {/* Item 24: checklist de onboarding/offboarding */}
        <div className="asset-detail-section">
          <span className="eyebrow">{t('assets.checklist.eyebrow')}</span>
          <div className="inline-form">
            <label>{t('assets.checklist.process')}</label>
            <select disabled={!canEdit} value={checklist?.process ?? ''} onChange={e => {
              const value = e.target.value as OwnershipProcess | ''
              if (value === 'entrega' || value === 'devolucao') startChecklist(detailAsset, value)
              else setChecklists(map => { const next = { ...map }; delete next[detailAsset.id]; return next })
            }}>
              <option value="">{t('assets.checklist.none')}</option>
              <option value="entrega">{t('assets.checklist.delivery')}</option>
              <option value="devolucao">{t('assets.checklist.return')}</option>
            </select>
          </div>
          {checklist && <div className="checklist-list">
            {checklist.items.map((item, i) => (
              <div className={classNames('checklist-list__item', item.done && 'is-done')} key={i} onClick={() => canEdit && toggleChecklistItem(detailAsset, i)}>
                {item.done ? <CheckSquare size={14} /> : <Square size={14} />} {item.label}
              </div>
            ))}
          </div>}
        </div>

        {/* Item 25: destaque de alerta */}
        {(detailAsset.owner === '—' || detailAsset.owner.trim() === '' || isStockLong) && <div className="asset-detail-section">
          <span className="eyebrow">{t('assets.alerts.eyebrow')}</span>
          <p className="audit-alert-panel__tag" style={{ display: 'inline-block' }}>
            {detailAsset.owner === '—' || detailAsset.owner.trim() === '' ? t('assets.alerts.noOwner') : `${t('assets.alerts.longInStock')} ${daysInStock(detailAsset.id)} ${t('assets.alerts.days')}`}
          </p>
        </div>}

        {/* Item 27: anexo de nota fiscal / comprovante */}
        <div className="asset-detail-section">
          <span className="eyebrow">{t('assets.invoice.eyebrow')}</span>
          <div className="invoice-box">
            <label className="button button--small" style={{ cursor: canEdit ? 'pointer' : 'not-allowed' }}>
              <FileText size={14} /> {t('assets.invoice.upload')}
              <input type="file" style={{ display: 'none' }} disabled={!canEdit} onChange={e => { const file = e.target.files?.[0]; if (file) attachInvoice(detailAsset, file) }} />
            </label>
            {invoice ? <div className="invoice-box__meta"><strong>{invoice.name}</strong><small>{invoice.type} · {(invoice.size / 1024).toFixed(1)} KB</small></div> : <span>{t('assets.invoice.none')}</span>}
          </div>
        </div>
      </Modal>
    })()}
  </>
}
