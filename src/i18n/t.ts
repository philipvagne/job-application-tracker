import en from './en.json'
import sv from './sv.json'
import type { Language } from '../domain'

export type Dict = typeof en

type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>
}[keyof T & string]

/** Every dotted key of the language files, e.g. "banner.notSaved.title". */
export type TextKey = Paths<Dict>

export type Params = Readonly<Record<string, string | number>>

// A missing or extra key in sv.json is a compile error here.
export const dictionaries: Record<Language, Dict> = { en, sv }

/** The text at a dotted path, or undefined if there is none. */
export function lookup(dict: Dict, path: string): string | undefined {
  let node: unknown = dict
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null || !Object.hasOwn(node, part)) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : undefined
}

/** Replaces {name} with params.name. A placeholder without a param is left as written. */
export function interpolate(text: string, params?: Params): string {
  if (params === undefined) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : whole,
  )
}

/** Looks up a key and fills in its placeholders. An unknown key shows the key itself. */
export function t(dict: Dict, key: TextKey, params?: Params): string {
  return interpolate(lookup(dict, key) ?? key, params)
}
