import {
  React,
  jsx,
  hooks,
  type AllWidgetProps,
  DataSourceComponent,
  type DataSource,
  type FeatureLayerDataSource,
  type FeatureLayerQueryParams,
  type SqlQueryParams
} from 'jimu-core'
import { Button, Checkbox, Label, TextInput, WidgetPlaceholder } from 'jimu-ui'
import type { IMConfig } from '../config'
import {
  EMPTY_FILTER,
  buildWhereClause,
  countActiveFilters,
  parseCategoryList,
  parseNumberInput,
  toCategoryOptions,
  validateFilter,
  type CategoryOption,
  type FilterFields,
  type FilterState
} from './filter-utils'
import defaultMessages from './translations/default'

const { useEffect, useMemo, useRef, useState } = React
const COUNT_FIELD = 'value_count'
const MAX_CATEGORIES = 200

type CountStatus = 'idle' | 'counting' | 'error'

async function loadCategoryOptions (ds: FeatureLayerDataSource, field: string): Promise<CategoryOption[]> {
  // One group-by statistics query returns each value with its record count
  const result = await ds.query({
    where: '1=1',
    outFields: [field],
    groupByFieldsForStatistics: [field],
    outStatistics: [{ statisticType: 'count', onStatisticField: field, outStatisticFieldName: COUNT_FIELD }],
    returnGeometry: false
  } as FeatureLayerQueryParams)
  const rows = (result?.records ?? []).map(record => record.getData())
  return toCategoryOptions(rows, field, COUNT_FIELD).slice(0, MAX_CATEGORIES)
}

export default function Widget (props: AllWidgetProps<IMConfig>) {
  const { id, config, useDataSources } = props
  const translate = hooks.useTranslation(defaultMessages)

  const [ds, setDs] = useState<FeatureLayerDataSource>(null)
  const [dsFailed, setDsFailed] = useState(false)
  const [options, setOptions] = useState<CategoryOption[]>([])
  const [optionsFailed, setOptionsFailed] = useState(false)
  const [draft, setDraft] = useState<FilterState>(EMPTY_FILTER)
  const [appliedCount, setAppliedCount] = useState(0)
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [countStatus, setCountStatus] = useState<CountStatus>('idle')
  const requestId = useRef(0)

  const fields: FilterFields = useMemo(() => ({
    categoryField: config.categoryField,
    dateField: config.dateField || undefined,
    valueField: config.valueField || undefined
  }), [config.categoryField, config.dateField, config.valueField])

  const errors = validateFilter(draft)

  // Reset when the layer or field configuration changes
  useEffect(() => {
    setDraft(EMPTY_FILTER)
    setAppliedCount(0)
    setMatchCount(null)
    setOptionsFailed(false)
    if (!ds || !config.categoryField) {
      setOptions([])
      return
    }

    const configured = parseCategoryList(config.categoryValues)
    if (configured.length > 0) {
      setOptions(configured.map(value => ({ value, count: null })))
      return
    }

    let cancelled = false
    loadCategoryOptions(ds, config.categoryField)
      .then(loaded => { if (!cancelled) setOptions(loaded) })
      .catch(() => {
        if (!cancelled) {
          setOptions([])
          setOptionsFailed(true)
        }
      })
    return () => { cancelled = true }
  }, [ds, config.categoryField, config.categoryValues])

  // Don't leave an invisible filter on the layer after the widget goes away
  useEffect(() => {
    return () => {
      ds?.updateQueryParams({ where: '1=1' } as SqlQueryParams, id)
    }
  }, [ds, id])

  const apply = async (state: FilterState) => {
    if (!ds || validateFilter(state).length > 0) return
    const where = buildWhereClause(fields, state)

    // Every widget and map layer using this data source sees the filter
    ds.updateQueryParams({ where } as SqlQueryParams, id)
    setAppliedCount(countActiveFilters(fields, state))

    const thisRequest = ++requestId.current
    setCountStatus('counting')
    try {
      const result = await ds.queryCount({ where } as SqlQueryParams)
      if (thisRequest !== requestId.current) return // a newer request superseded this one
      setMatchCount(result?.count ?? null)
      setCountStatus('idle')
    } catch {
      if (thisRequest !== requestId.current) return
      setMatchCount(null)
      setCountStatus('error')
    }
  }

  const clear = () => {
    setDraft(EMPTY_FILTER)
    void apply(EMPTY_FILTER)
  }

  const toggleCategory = (value: string, checked: boolean) => {
    setDraft(current => ({
      ...current,
      categories: checked
        ? [...current.categories, value]
        : current.categories.filter(c => c !== value)
    }))
  }

  if (!useDataSources?.length || !config.categoryField) {
    return <WidgetPlaceholder widgetId={id} message={translate('configure')} />
  }

  const statusText = countStatus === 'counting'
    ? translate('counting')
    : countStatus === 'error'
      ? translate('countFailed')
      : matchCount !== null
        ? translate('matches', { count: matchCount, filters: appliedCount })
        : ''

  return (
    <div className='widget-permit-filter jimu-widget p-3' style={{ overflowY: 'auto', height: '100%' }}>
      <DataSourceComponent
        useDataSource={useDataSources[0]}
        widgetId={id}
        onDataSourceCreated={(created: DataSource) => { setDs(created as FeatureLayerDataSource) }}
        onCreateDataSourceFailed={() => { setDsFailed(true) }}
      />

      {dsFailed && <p role='alert'>{translate('dataSourceFailed')}</p>}

      <fieldset className='mb-3'>
        <legend className='h6'>{translate('categories')}</legend>
        {optionsFailed && <p>{translate('optionsFailed')}</p>}
        {!optionsFailed && options.length === 0 && ds && <p>{translate('loading')}</p>}
        {options.map(option => (
          <Label key={option.value} className='d-flex align-items-center mb-1' style={{ cursor: 'pointer' }}>
            <Checkbox
              checked={draft.categories.includes(option.value)}
              onChange={(evt) => { toggleCategory(option.value, evt.target.checked) }}
            />
            <span className='ml-2'>
              {option.value}
              {option.count !== null && <span className='text-muted'> ({option.count.toLocaleString()})</span>}
            </span>
          </Label>
        ))}
      </fieldset>

      {fields.dateField && (
        <fieldset className='mb-3'>
          <legend className='h6'>{translate('dateRange')}</legend>
          <Label className='d-block mb-1'>
            {translate('from')}
            <TextInput
              type='date'
              value={draft.dateFrom ?? ''}
              onChange={(evt) => { setDraft({ ...draft, dateFrom: evt.target.value || undefined }) }}
            />
          </Label>
          <Label className='d-block'>
            {translate('to')}
            <TextInput
              type='date'
              value={draft.dateTo ?? ''}
              onChange={(evt) => { setDraft({ ...draft, dateTo: evt.target.value || undefined }) }}
            />
          </Label>
        </fieldset>
      )}

      {fields.valueField && (
        <fieldset className='mb-3'>
          <legend className='h6'>{translate('valueRange')}</legend>
          <Label className='d-block mb-1'>
            {translate('min')}
            <TextInput
              type='number'
              inputMode='decimal'
              value={draft.minValue === undefined || Number.isNaN(draft.minValue) ? '' : String(draft.minValue)}
              onChange={(evt) => { setDraft({ ...draft, minValue: parseNumberInput(evt.target.value) }) }}
            />
          </Label>
          <Label className='d-block'>
            {translate('max')}
            <TextInput
              type='number'
              inputMode='decimal'
              value={draft.maxValue === undefined || Number.isNaN(draft.maxValue) ? '' : String(draft.maxValue)}
              onChange={(evt) => { setDraft({ ...draft, maxValue: parseNumberInput(evt.target.value) }) }}
            />
          </Label>
        </fieldset>
      )}

      {errors.length > 0 && (
        <ul role='alert' className='text-danger pl-3'>
          {errors.map(error => <li key={error}>{translate(error)}</li>)}
        </ul>
      )}

      <div className='d-flex mb-2'>
        <Button type='primary' disabled={!ds || errors.length > 0} onClick={() => { void apply(draft) }}>
          {translate('apply')}
        </Button>
        <Button className='ml-2' disabled={!ds} onClick={clear}>
          {translate('clear')}
        </Button>
      </div>

      {/* Announced to screen readers when the result count changes */}
      <p aria-live='polite' className='mb-0'>{statusText}</p>
    </div>
  )
}
