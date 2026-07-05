import {
  Activity, Boxes, Bug, Cable, ClipboardCheck, Gauge, GitBranch,
  LayoutDashboard, ListTree, Network, ScrollText, ServerCog, TicketCheck,
} from 'lucide-react'
import type { ModuleId } from '../types'

export const navigation: { id: ModuleId; label: string; section: string; icon: typeof Activity }[] = [
  { id:'overview', label:'Visão geral', section:'Início', icon:LayoutDashboard },
  { id:'pipelines', label:'Pipelines CI/CD', section:'Engenharia', icon:GitBranch },
  { id:'logs', label:'Explorador de logs', section:'Engenharia', icon:ScrollText },
  { id:'tickets', label:'Tickets', section:'Engenharia', icon:TicketCheck },
  { id:'network', label:'Topologia de rede', section:'Infraestrutura', icon:Network },
  { id:'terraform', label:'Terraform state', section:'Infraestrutura', icon:ListTree },
  { id:'kubernetes', label:'Saúde Kubernetes', section:'Infraestrutura', icon:Gauge },
  { id:'namespaces', label:'Self-service K8s', section:'Infraestrutura', icon:ServerCog },
  { id:'services', label:'Microsserviços', section:'Segurança & Gestão', icon:Cable },
  { id:'vulnerabilities', label:'Vulnerabilidades', section:'Segurança & Gestão', icon:Bug },
  { id:'capacity', label:'Capacidade da equipe', section:'Segurança & Gestão', icon:Activity },
  { id:'runbooks', label:'Runbooks', section:'Segurança & Gestão', icon:ClipboardCheck },
  { id:'assets', label:'Ativos de TI', section:'Segurança & Gestão', icon:Boxes },
]
