import { useMemo } from 'react'
import katex from 'katex'

interface FormulaProps {
  tex: string
  color?: string
  className?: string
}

export function Formula({ tex, color, className }: FormulaProps) {
  const html = useMemo(
    () => katex.renderToString(tex, { throwOnError: false, displayMode: false }),
    [tex],
  )
  return (
    <span
      className={className ? `formula ${className}` : 'formula'}
      style={color ? { color } : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
