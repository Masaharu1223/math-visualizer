import type { Mode } from './constants'

export interface PadKey {
  /** ボタンの表示 */
  label: string
  /** 入力欄に挿入する文字列 */
  text: string
  aria: string
}

const key = (label: string, text = label, aria = label): PadKey => ({ label, text, aria })

export const PAD_KEYS = {
  // 電卓風の4列配置(左から右、上から下)。⌫ と C は挿入ではないので Keypad 側で末尾に足す
  grid: [
    key('7'),
    key('8'),
    key('9'),
    key('÷', '/', '割る'),
    key('4'),
    key('5'),
    key('6'),
    key('×', '*', '掛ける'),
    key('1'),
    key('2'),
    key('3'),
    key('−', '-', '引く'),
    key('0'),
    key('.', '.', '小数点'),
    key('^', '^', 'べき乗'),
    key('+', '+', '足す'),
    key('(', '(', '開き括弧'),
    key(')', ')', '閉じ括弧'),
  ],
  functions: ['sin', 'cos', 'tan', 'exp', 'log', 'sqrt', 'abs'].map((f) => key(f, `${f}(`)),
  constants: [key('pi', 'pi', '円周率'), key('e', 'e', 'ネイピア数')],
}

const VARIABLES: Record<Mode, string[]> = {
  derivative: ['x'],
  integral: ['x'],
  surface: ['x', 'y'],
  parametric: ['t'],
}

export const variablesFor = (mode: Mode): string[] => VARIABLES[mode]

export interface EditResult {
  value: string
  caret: number
}

/** 選択範囲(なければカーソル位置)を text で置き換え、挿入文字の直後にカーソルを置く */
export function insertAtCaret(
  value: string,
  selStart: number,
  selEnd: number,
  text: string,
): EditResult {
  return {
    value: value.slice(0, selStart) + text + value.slice(selEnd),
    caret: selStart + text.length,
  }
}

/** 選択範囲があればそれを、なければカーソル直前の1文字を削除する */
export function backspaceAtCaret(value: string, selStart: number, selEnd: number): EditResult {
  const from = selStart === selEnd ? Math.max(0, selStart - 1) : selStart
  return { value: value.slice(0, from) + value.slice(selEnd), caret: from }
}
