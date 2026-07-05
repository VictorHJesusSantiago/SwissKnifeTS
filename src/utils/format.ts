export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)

export const classNames = (...names: Array<string | false | undefined>) => names.filter(Boolean).join(' ')
