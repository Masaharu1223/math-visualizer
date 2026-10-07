import { describe, expect, it } from 'vitest'
import { addExpr, removeExpr, updateExpr } from './functionList'
import { MAX_FUNCTIONS } from './constants'

describe('addExpr', () => {
  it('末尾に追加する', () => {
    expect(addExpr(['sin(x)'], 'x^2')).toEqual(['sin(x)', 'x^2'])
  })

  it('上限に達していれば追加しない', () => {
    const full = Array.from({ length: MAX_FUNCTIONS }, (_, i) => `x^${i}`)
    expect(addExpr(full, 'x')).toBe(full)
  })

  it('元の配列を変更しない', () => {
    const list = ['sin(x)']
    addExpr(list, 'x^2')
    expect(list).toEqual(['sin(x)'])
  })
})

describe('removeExpr', () => {
  it('指定した行を削除する', () => {
    expect(removeExpr(['a', 'b', 'c'], 1)).toEqual(['a', 'c'])
  })

  it('1行しかなければ削除しない', () => {
    const one = ['a']
    expect(removeExpr(one, 0)).toBe(one)
  })

  it('範囲外の添字は何もしない', () => {
    const list = ['a', 'b']
    expect(removeExpr(list, 5)).toBe(list)
  })
})

describe('updateExpr', () => {
  it('指定した行だけ置き換える', () => {
    expect(updateExpr(['a', 'b'], 1, 'z')).toEqual(['a', 'z'])
  })

  it('元の配列を変更しない', () => {
    const list = ['a', 'b']
    const next = updateExpr(list, 0, 'z')
    expect(list).toEqual(['a', 'b'])
    expect(next).not.toBe(list)
  })
})
