import { describe, expect, it } from 'vitest'
import { PAD_KEYS, backspaceAtCaret, insertAtCaret, variablesFor } from './keypad'

describe('insertAtCaret', () => {
  it('カーソル位置に挿入し、挿入文字の直後にカーソルを置く', () => {
    expect(insertAtCaret('sin(x)', 4, 4, '2')).toEqual({ value: 'sin(2x)', caret: 5 })
  })

  it('先頭に挿入できる', () => {
    expect(insertAtCaret('x', 0, 0, '2')).toEqual({ value: '2x', caret: 1 })
  })

  it('末尾に挿入できる', () => {
    expect(insertAtCaret('x', 1, 1, '^')).toEqual({ value: 'x^', caret: 2 })
  })

  it('選択範囲は挿入文字で置き換える', () => {
    expect(insertAtCaret('x + y', 0, 5, 'sin(')).toEqual({ value: 'sin(', caret: 4 })
  })

  it('空文字に挿入できる', () => {
    expect(insertAtCaret('', 0, 0, 'x')).toEqual({ value: 'x', caret: 1 })
  })

  it('関数ボタンは括弧付きの文字列をそのまま挿入する', () => {
    expect(insertAtCaret('1+', 2, 2, 'sqrt(')).toEqual({ value: '1+sqrt(', caret: 7 })
  })
})

describe('backspaceAtCaret', () => {
  it('カーソル直前の1文字を削除する', () => {
    expect(backspaceAtCaret('x^2', 3, 3)).toEqual({ value: 'x^', caret: 2 })
  })

  it('途中のカーソル位置でも直前の1文字を削除する', () => {
    expect(backspaceAtCaret('x^2', 2, 2)).toEqual({ value: 'x2', caret: 1 })
  })

  it('選択範囲があればそれを削除する', () => {
    expect(backspaceAtCaret('sin(x)', 0, 4)).toEqual({ value: 'x)', caret: 0 })
  })

  it('先頭では何も削除しない', () => {
    expect(backspaceAtCaret('x', 0, 0)).toEqual({ value: 'x', caret: 0 })
  })

  it('空文字では何もしない', () => {
    expect(backspaceAtCaret('', 0, 0)).toEqual({ value: '', caret: 0 })
  })
})

describe('variablesFor', () => {
  it('モードごとに変数ボタンを切り替える', () => {
    expect(variablesFor('derivative')).toEqual(['x'])
    expect(variablesFor('integral')).toEqual(['x'])
    expect(variablesFor('surface')).toEqual(['x', 'y'])
    expect(variablesFor('parametric')).toEqual(['t'])
  })
})

describe('PAD_KEYS', () => {
  it('表示は + − × ÷、挿入は + - * / になる', () => {
    const ops = PAD_KEYS.grid.filter((k) => ['+', '−', '×', '÷'].includes(k.label))
    expect(Object.fromEntries(ops.map((k) => [k.label, k.text]))).toEqual({
      '+': '+',
      '−': '-',
      '×': '*',
      '÷': '/',
    })
  })

  it('関数ボタンは開き括弧付きで挿入する', () => {
    expect(PAD_KEYS.functions.map((k) => k.text)).toEqual([
      'sin(',
      'cos(',
      'tan(',
      'exp(',
      'log(',
      'sqrt(',
      'abs(',
    ])
  })

  it('定数は pi と e', () => {
    expect(PAD_KEYS.constants.map((k) => k.text)).toEqual(['pi', 'e'])
  })
})
