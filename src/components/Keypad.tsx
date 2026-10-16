import { PAD_KEYS } from '../keypad'
import type { PadKey } from '../keypad'

interface Props {
  variables: string[]
  onInsert: (text: string) => void
  onBackspace: () => void
  onClear: () => void
}

export function Keypad({ variables, onInsert, onBackspace, onClear }: Props) {
  // mousedown で preventDefault し、入力欄のフォーカスを奪わない(キーボード入力と併用できる)
  const button = (label: string, aria: string, onClick: () => void, className = 'pad-key') => (
    <button
      key={label}
      type="button"
      className={className}
      aria-label={aria}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  )
  const insertKey = (k: PadKey) => button(k.label, k.aria, () => onInsert(k.text))

  return (
    <div className="keypad">
      <div className="pad-grid">
        {PAD_KEYS.grid.map(insertKey)}
        {button('⌫', '1文字削除', onBackspace, 'pad-key pad-action')}
        {button('C', '入力欄を空にする', onClear, 'pad-key pad-action')}
      </div>
      <div className="pad-extras">
        <div className="pad-row">{PAD_KEYS.functions.map(insertKey)}</div>
        <div className="pad-row">
          {PAD_KEYS.constants.map(insertKey)}
          {variables.map((v) => button(v, `変数 ${v}`, () => onInsert(v)))}
        </div>
      </div>
    </div>
  )
}
