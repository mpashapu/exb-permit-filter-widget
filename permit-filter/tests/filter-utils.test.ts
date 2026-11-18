// Plain describe/it/expect: runs under the Experience Builder client's Jest
// (npm test in /client) and under Vitest in this repository's CI.
import {
  EMPTY_FILTER,
  addDays,
  assertFieldName,
  buildWhereClause,
  countActiveFilters,
  isIsoDate,
  parseCategoryList,
  parseNumberInput,
  quoteString,
  toCategoryOptions,
  validateFilter,
  type FilterFields
} from '../src/runtime/filter-utils'

const ALL_FIELDS: FilterFields = { categoryField: 'TYPE', dateField: 'ISSUDATE', valueField: 'ESTVALUE' }

describe('buildWhereClause', () => {
  it('returns 1=1 when nothing is selected', () => {
    expect(buildWhereClause(ALL_FIELDS, EMPTY_FILTER)).toBe('1=1')
  })

  it('builds an IN list for categories, trimmed and de-duplicated', () => {
    const where = buildWhereClause(ALL_FIELDS, { categories: ['BLDG', ' ELEC ', 'BLDG', ''] })
    expect(where).toBe("TYPE IN ('BLDG', 'ELEC')")
  })

  it('escapes single quotes in values', () => {
    expect(buildWhereClause(ALL_FIELDS, { categories: ["O'BRIEN"] })).toBe("TYPE IN ('O''BRIEN')")
  })

  it('makes the end date inclusive by using < next day', () => {
    const where = buildWhereClause(ALL_FIELDS, { categories: [], dateFrom: '2026-01-01', dateTo: '2026-01-31' })
    expect(where).toBe("ISSUDATE >= DATE '2026-01-01' AND ISSUDATE < DATE '2026-02-01'")
  })

  it('handles a year boundary and leap day', () => {
    expect(buildWhereClause(ALL_FIELDS, { categories: [], dateTo: '2025-12-31' })).toBe("ISSUDATE < DATE '2026-01-01'")
    expect(buildWhereClause(ALL_FIELDS, { categories: [], dateTo: '2028-02-28' })).toBe("ISSUDATE < DATE '2028-02-29'")
  })

  it('adds numeric bounds, including zero', () => {
    const where = buildWhereClause(ALL_FIELDS, { categories: [], minValue: 0, maxValue: 50000.5 })
    expect(where).toBe('ESTVALUE >= 0 AND ESTVALUE <= 50000.5')
  })

  it('combines every filter with AND', () => {
    const where = buildWhereClause(ALL_FIELDS, {
      categories: ['PLUM'], dateFrom: '2026-03-01', minValue: 1000
    })
    expect(where).toBe("TYPE IN ('PLUM') AND ISSUDATE >= DATE '2026-03-01' AND ESTVALUE >= 1000")
  })

  it('ignores date and value filters when those fields are not configured', () => {
    const where = buildWhereClause({ categoryField: 'TYPE' }, { categories: [], dateFrom: '2026-01-01', minValue: 5 })
    expect(where).toBe('1=1')
  })

  it('ignores invalid dates and NaN', () => {
    const where = buildWhereClause(ALL_FIELDS, { categories: [], dateFrom: '2026-02-30', minValue: Number.NaN })
    expect(where).toBe('1=1')
  })

  it('rejects field names that are not plain identifiers', () => {
    expect(() => buildWhereClause({ categoryField: 'TYPE; DROP TABLE x' }, { categories: ['A'] })).toThrow('Invalid field name')
  })
})

describe('validateFilter', () => {
  it('accepts an empty filter', () => {
    expect(validateFilter(EMPTY_FILTER)).toEqual([])
  })

  it('flags reversed dates and values', () => {
    expect(validateFilter({ categories: [], dateFrom: '2026-05-01', dateTo: '2026-04-01', minValue: 10, maxValue: 5 }))
      .toEqual(['dateOrder', 'valueOrder'])
  })

  it('flags impossible dates and non-numbers', () => {
    expect(validateFilter({ categories: [], dateFrom: '2026-13-01', maxValue: Number.NaN }))
      .toEqual(['invalidDate', 'invalidNumber'])
  })

  it('allows a single-day range and equal min/max', () => {
    expect(validateFilter({ categories: [], dateFrom: '2026-05-01', dateTo: '2026-05-01', minValue: 5, maxValue: 5 }))
      .toEqual([])
  })
})

describe('helpers', () => {
  it('isIsoDate checks real calendar dates', () => {
    expect(isIsoDate('2024-02-29')).toBe(true)
    expect(isIsoDate('2025-02-29')).toBe(false)
    expect(isIsoDate('2026-1-5')).toBe(false)
    expect(isIsoDate(undefined)).toBe(false)
  })

  it('addDays crosses month ends in UTC', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01')
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02') // DST change day in the U.S.
  })

  it('quoteString doubles quotes', () => {
    expect(quoteString("it's")).toBe("'it''s'")
  })

  it('assertFieldName allows identifiers only', () => {
    expect(assertFieldName('EST_VALUE2')).toBe('EST_VALUE2')
    expect(() => assertFieldName('1ABC')).toThrow()
    expect(() => assertFieldName("TYPE'")).toThrow()
  })

  it('parseCategoryList splits, trims and de-duplicates', () => {
    expect(parseCategoryList(' BLDG, ELEC,,BLDG ')).toEqual(['BLDG', 'ELEC'])
    expect(parseCategoryList(undefined)).toEqual([])
  })

  it('parseNumberInput separates empty from invalid', () => {
    expect(parseNumberInput('')).toBeUndefined()
    expect(parseNumberInput('2500')).toBe(2500)
    expect(parseNumberInput('abc')).toBeNaN()
  })

  it('countActiveFilters counts filter groups, not values', () => {
    expect(countActiveFilters(ALL_FIELDS, { categories: ['A', 'B'], dateFrom: '2026-01-01', dateTo: '2026-02-01' })).toBe(2)
    expect(countActiveFilters({ categoryField: 'TYPE' }, { categories: [], minValue: 5 })).toBe(0)
  })
})

describe('toCategoryOptions', () => {
  it('sorts by count, then name, and skips empty values', () => {
    const rows = [
      { TYPE: 'PLUM', value_count: 12 },
      { TYPE: 'BLDG', value_count: 40 },
      { TYPE: null, value_count: 3 },
      { TYPE: '  ', value_count: 1 },
      { TYPE: 'ELEC', value_count: 12 }
    ]
    expect(toCategoryOptions(rows, 'TYPE', 'value_count')).toEqual([
      { value: 'BLDG', count: 40 },
      { value: 'ELEC', count: 12 },
      { value: 'PLUM', count: 12 }
    ])
  })

  it('matches field names case-insensitively', () => {
    expect(toCategoryOptions([{ type: 'FIRE', VALUE_COUNT: 2 }], 'TYPE', 'value_count'))
      .toEqual([{ value: 'FIRE', count: 2 }])
  })

  it('keeps values without counts when statistics are unavailable', () => {
    expect(toCategoryOptions([{ TYPE: 'MECH' }], 'TYPE', 'value_count'))
      .toEqual([{ value: 'MECH', count: null }])
  })
})
