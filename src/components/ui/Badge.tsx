import type { ReactNode } from 'react'
import { classNames } from '../../utils/format'

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={classNames('badge', `badge--${tone.toLowerCase().replace('í','i').replace('é','e')}`)}>{children}</span>
}
