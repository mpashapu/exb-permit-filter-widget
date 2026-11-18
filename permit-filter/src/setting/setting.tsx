import {
  React,
  jsx,
  hooks,
  Immutable,
  DataSourceTypes,
  JimuFieldType,
  type IMFieldSchema,
  type UseDataSource
} from 'jimu-core'
import type { AllWidgetSettingProps } from 'jimu-for-builder'
import { DataSourceSelector, FieldSelector } from 'jimu-ui/advanced/data-source-selector'
import { SettingRow, SettingSection } from 'jimu-ui/advanced/setting-components'
import { Button, TextInput } from 'jimu-ui'
import type { IMConfig } from '../config'
import defaultMessages from './translations/default'

type FieldKey = 'categoryField' | 'dateField' | 'valueField'

const SUPPORTED_TYPES = Immutable([DataSourceTypes.FeatureLayer])
const FIELD_TYPES = {
  categoryField: Immutable([JimuFieldType.String]),
  dateField: Immutable([JimuFieldType.Date]),
  valueField: Immutable([JimuFieldType.Number])
}

export default function Setting (props: AllWidgetSettingProps<IMConfig>) {
  const { id, config, useDataSources, onSettingChange } = props
  const translate = hooks.useTranslation(defaultMessages)
  const hasDataSource = useDataSources?.length > 0

  const onDataSourceChange = (next: UseDataSource[]) => {
    // A different layer has different fields, so clear the field choices
    onSettingChange({
      id,
      useDataSources: next,
      config: config.set('categoryField', '').set('dateField', '').set('valueField', '')
    })
  }

  const setField = (key: FieldKey, name: string) => {
    const nextConfig = config.set(key, name)
    // Persist used fields so the data source loads them
    const usedFields = [nextConfig.categoryField, nextConfig.dateField, nextConfig.valueField].filter(Boolean)
    onSettingChange({
      id,
      config: nextConfig,
      useDataSources: [{ ...useDataSources[0], fields: usedFields }]
    })
  }

  const onCategoryValuesChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    onSettingChange({ id, config: config.set('categoryValues', evt.target.value) })
  }

  const fieldRow = (key: FieldKey, labelId: string, optional: boolean) => (
    <SettingRow flow='wrap' label={translate(labelId)}>
      <FieldSelector
        useDataSources={useDataSources}
        types={FIELD_TYPES[key]}
        selectedFields={Immutable(config[key] ? [config[key]] : [])}
        onChange={(fields: IMFieldSchema[]) => { setField(key, fields?.[0]?.name ?? '') }}
        isMultiple={false}
        isSearchInputHidden={false}
        isDataSourceDropDownHidden
        useDropdown
      />
      {optional && config[key] && (
        <Button type='tertiary' size='sm' className='mt-1' onClick={() => { setField(key, '') }}>
          {translate('removeField')}
        </Button>
      )}
    </SettingRow>
  )

  return (
    <div className='widget-setting-permit-filter'>
      <SettingSection title={translate('dataSource')}>
        <SettingRow>
          <DataSourceSelector
            types={SUPPORTED_TYPES}
            useDataSourcesEnabled
            mustUseDataSource
            useDataSources={useDataSources}
            onChange={onDataSourceChange}
            widgetId={id}
            hideDataView
          />
        </SettingRow>
      </SettingSection>

      {hasDataSource && (
        <SettingSection title={translate('fields')}>
          {fieldRow('categoryField', 'categoryField', false)}
          {fieldRow('dateField', 'dateField', true)}
          {fieldRow('valueField', 'valueField', true)}
        </SettingSection>
      )}

      {hasDataSource && (
        <SettingSection title={translate('categoryValues')}>
          <SettingRow flow='wrap' label={translate('categoryValuesHelp')}>
            <TextInput
              className='w-100'
              placeholder='BLDG, ELEC, MECH, PLUM'
              value={config.categoryValues ?? ''}
              onChange={onCategoryValuesChange}
            />
          </SettingRow>
        </SettingSection>
      )}
    </div>
  )
}
