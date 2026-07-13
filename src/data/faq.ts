export interface FaqEntry {
  module: string
  question: string
  answer: string
}

export const faqEntries: FaqEntry[] = [
  { module: 'Geral', question: 'Onde os meus dados ficam salvos?', answer: 'Tudo é salvo localmente no localStorage do seu navegador — não há servidor nem nuvem envolvidos.' },
  { module: 'Geral', question: 'Como faço backup dos meus dados?', answer: 'Vá em Configurações → Backup e clique em "Exportar backup" para baixar um arquivo JSON com tudo.' },
  { module: 'Geral', question: 'Como mudo o idioma do app?', answer: 'Em Configurações → Idioma, escolha entre Português e Inglês.' },
  { module: 'Geral', question: 'Como abro a busca global?', answer: 'Pressione Ctrl+K (ou ⌘K no Mac) em qualquer tela.' },
  { module: 'Geral', question: 'Como funciona o modo visualizador?', answer: 'Em Configurações → Acesso, mude o papel para "Visualizador" para bloquear ações de criação/edição em todos os módulos.' },
  { module: 'Pipelines', question: 'O que acontece quando clico em "Re-run"?', answer: 'A execução é simulada localmente: o status muda para "executando" e depois "sucesso" após alguns segundos.' },
  { module: 'Tickets', question: 'Os anexos são enviados para algum lugar?', answer: 'Não. Os anexos ficam apenas na memória da sessão/local, sem upload para servidor algum.' },
  { module: 'Terraform', question: 'O "Reverter" desfaz de verdade a infraestrutura?', answer: 'Não, é uma simulação visual para fins de demonstração — nenhuma infraestrutura real é alterada.' },
  { module: 'Vulnerabilidades', question: 'Os dados de CVE são reais?', answer: 'Não, são dados fictícios de demonstração usados para ilustrar o fluxo de gestão de vulnerabilidades.' },
  { module: 'Kubernetes', question: 'O terminal kubectl é real?', answer: 'É um terminal simulado: só reconhece um conjunto fixo de comandos de exemplo e retorna respostas mockadas.' },
]
