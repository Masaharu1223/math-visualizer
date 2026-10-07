import { MAX_FUNCTIONS } from './constants'

/** 末尾に式を追加する。上限(MAX_FUNCTIONS)に達していれば同じ配列を返す */
export function addExpr(list: string[], expr: string): string[] {
  return list.length >= MAX_FUNCTIONS ? list : [...list, expr]
}

/** index の行を削除する。残り1行以下・範囲外なら同じ配列を返す */
export function removeExpr(list: string[], index: number): string[] {
  if (list.length <= 1 || index < 0 || index >= list.length) return list
  return list.filter((_, i) => i !== index)
}

export function updateExpr(list: string[], index: number, expr: string): string[] {
  return list.map((e, i) => (i === index ? expr : e))
}
