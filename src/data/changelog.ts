export const APP_VERSION = '1.3.0'

export interface ChangelogEntry {
  version: string
  date: string
  items: string[]
}

export const changelog: ChangelogEntry[] = [
  {
    version: '1.3.0', date: '2026-07-10',
    items: [
      'Central de ajuda com FAQ pesquisável',
      'Modo alto-contraste, modo leitura e modo apresentação',
      'Console de depuração oculto (Ctrl+Shift+D)',
      'Estatísticas de uso pessoal e histórico de navegação recente',
      'Painel de saúde do app com limpeza seletiva de dados',
      'Perfis de configuração salvos e cor de destaque customizável',
    ],
  },
  {
    version: '1.2.0', date: '2026-07-10',
    items: [
      'Onboarding com tour guiado na primeira visita',
      'Sistema de permissões (admin/viewer) e multi-usuário simulado',
      'PWA instalável com cache offline',
      'Testes automatizados (Vitest + Playwright)',
      'Comparador entre módulos e busca global de entidades',
    ],
  },
  {
    version: '1.1.0', date: '2026-07-10',
    items: [
      'Tema claro/escuro, i18n PT/EN e command palette',
      'Notificações internas, favoritos, backup/restore e atalhos de teclado',
    ],
  },
  {
    version: '1.0.0', date: '2026-07-01',
    items: ['Lançamento inicial do OpsPhere com os 13 módulos principais.'],
  },
]
