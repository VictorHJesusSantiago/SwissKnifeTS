# Opsphere

Centro unificado de operações de engenharia construído com React, TypeScript, Vite e D3.js.

## Módulos

- Visão executiva da plataforma
- Métricas e execução de pipelines CI/CD
- Explorador de logs com busca, filtros e exportação
- Quadro de tickets com persistência local
- Simulador de topologia de rede com grafo interativo
- Explorador de Terraform State
- Saúde de clusters Kubernetes
- Portal self-service de namespaces
- Mapa de dependências entre microsserviços
- Gestão e remediação de vulnerabilidades
- Capacidade e alocação de equipes
- Runbooks interativos com checklist e histórico
- Gestão de ativos de TI

## Execução

```bash
npm install
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`.

## Validação

```bash
npm run build
npm run lint
```

## Arquitetura

As páginas são carregadas sob demanda e usam um design system compartilhado. Dados operacionais de demonstração ficam em `src/data`, tipos em `src/types`, componentes reutilizáveis em `src/components` e páginas de produto em `src/pages`.

As ações de tickets, ativos, namespaces e runbooks são persistidas no `localStorage`. Os grafos de rede e microsserviços usam simulação de forças do D3.js com zoom e nós arrastáveis.
