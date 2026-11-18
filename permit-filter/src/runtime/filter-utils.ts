/**
 * Pure filter logic with no Experience Builder or ArcGIS imports, so it can be
 * unit tested anywhere (Jest in the ExB client, Vitest in this repo's CI).
 */

export interface FilterFields {
  categoryField: string
  dateField?: string
  valueField?: string
}

export interface FilterState {
  categories: string[]
  /** yyyy-mm-dd, inclusive */
  dateFrom?: string
  /** yyyy-mm-dd, inclusive */
  dateTo?: string
  minValue?: number
  maxValue?: number
}

export interface CategoryOption {
  value: string
  count: number | null
}

export type FilterError = 'invalidDate' | 'dateOrder' | 'valueOrder' | 'invalidNumber'

export const EMPTY_FILTER: FilterState = Object.freeze({ categories: [] }) as FilterState

const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Field names come from widget config, not users, but they still end up in
 * SQL. Reject anything that isn't a plain identifier.
 */
export function assertFieldName (name: string): string {
  if (!FIELD_NAME.test(name)) {
    throw new Error(`Invalid field name: ${name}`)
  }
  return name
}

/** SQL string literal with single quotes doubled. */
export function quoteString (value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

export function isIsoDate (value: string | undefined): value is string {
  const match = value ? ISO_DATE.exec(value) : null
  if (!match) return false
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

export function addDays (isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

function isFiniteNumber (value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function validateFilter (state: FilterState): FilterError[] {
  const errors: FilterError[] = []
  const { dateFrom, dateTo, minValue, maxValue } = state

  if ((dateFrom && !isIsoDate(dateFrom)) || (dateTo && !isIsoDate(dateTo))) {
    errors.push('invalidDate')
  } else if (dateFrom && dateTo && dateFrom > dateTo) {
    errors.push('dateOrder') // ISO dates compare correctly as strings
  }

  if ((minValue !== undefined && !isFiniteNumber(minValue)) || (maxValue !== undefined && !isFiniteNumber(maxValue))) {
    errors.push('invalidNumber')
  } else if (isFiniteNumber(minValue) && isFiniteNumber(maxValue) && minValue > maxValue) {
    errors.push('valueOrder')
  }

  return errors
}

/**
 * Builds a standardized-SQL where clause (works with ArcGIS Online, ArcGIS
 * Enterprise and hosted feature layers). Returns '1=1' when nothing is set.
 *
 * Dates use DATE 'yyyy-mm-dd' literals. The end date is applied as
 * "< next day" so records later on the end date are included even when the
 * field stores a time.
 */
export function buildWhereClause (fields: FilterFields, state: FilterState): string {
  const clauses: string[] = []

  const categories = uniqueNonEmpty(state.categories)
  if (categories.length > 0) {
    const field = assertFieldName(fields.categoryField)
    clauses.push(`${field} IN (${categories.map(quoteString).join(', ')})`)
  }

  if (fields.dateField) {
    const field = assertFieldName(fields.dateField)
    if (isIsoDate(state.dateFrom)) {
      clauses.push(`${field} >= DATE '${state.dateFrom}'`)
    }
    if (isIsoDate(state.dateTo)) {
      clauses.push(`${field} < DATE '${addDays(state.dateTo, 1)}'`)
    }
  }

  if (fields.valueField) {
    const field = assertFieldName(fields.valueField)
    if (isFiniteNumber(state.minValue)) {
      clauses.push(`${field} >= ${state.minValue}`)
    }
    if (isFiniteNumber(state.maxValue)) {
      clauses.push(`${field} <= ${state.maxValue}`)
    }
  }

  return clauses.length > 0 ? clauses.join(' AND ') : '1=1'
}

export function countActiveFilters (fields: FilterFields, state: FilterState): number {
  let count = uniqueNonEmpty(state.categories).length > 0 ? 1 : 0
  if (fields.dateField && (isIsoDate(state.dateFrom) || isIsoDate(state.dateTo))) count++
  if (fields.valueField && (isFiniteNumber(state.minValue) || isFiniteNumber(state.maxValue))) count++
  return count
}

/** Parses the optional comma-separated list from widget settings. */
export function parseCategoryList (text: string | undefined): string[] {
  return uniqueNonEmpty((text ?? '').split(','))
}

/**
 * Turns rows from a group-by statistics query into sorted options:
 * most common first, then alphabetical. Field-name case can differ
 * between services, so lookups are case-insensitive.
 */
export function toCategoryOptions (
  rows: Array<Record<string, unknown>>,
  field: string,
  countField: string
): CategoryOption[] {
  const options = new Map<string, number | null>()
  for (const row of rows) {
    const raw = getCaseInsensitive(row, field)
    if (raw === null || raw === undefined) continue
    const value = String(raw).trim()
    if (!value) continue
    const count = Number(getCaseInsensitive(row, countField))
    const previous = options.get(value) ?? 0
    options.set(value, Number.isFinite(count) ? (previous ?? 0) + count : null)
  }
  return [...options.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (b.count ?? -1) - (a.count ?? -1) || a.value.localeCompare(b.value))
}

/** Parses a number input: empty text is undefined, invalid text is NaN (reported by validateFilter). */
export function parseNumberInput (text: string): number | undefined {
  if (text.trim() === '') return undefined
  const value = Number(text)
  return Number.isFinite(value) ? value : Number.NaN
}

function uniqueNonEmpty (values: string[]): string[] {
  return [...new Set(values.map(v => v.trim()).filter(v => v.length > 0))]
}

function getCaseInsensitive (row: Record<string, unknown>, key: string): unknown {
  if (key in row) return row[key]
  const lower = key.toLowerCase()
  const match = Object.keys(row).find(k => k.toLowerCase() === lower)
  return match === undefined ? undefined : row[match]
}
