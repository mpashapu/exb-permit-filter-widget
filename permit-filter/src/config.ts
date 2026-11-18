import type { ImmutableObject } from 'seamless-immutable'

export interface Config {
  /** String field with the category to filter on, e.g. permit type. Required. */
  categoryField: string
  /** Optional date field for a from/to range, e.g. issue date. */
  dateField: string
  /** Optional numeric field for a min/max range, e.g. estimated value. */
  valueField: string
  /**
   * Optional comma-separated list of category values. When empty, values
   * (with counts) are loaded from the layer.
   */
  categoryValues: string
}

export type IMConfig = ImmutableObject<Config>
