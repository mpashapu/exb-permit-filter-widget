# Permit Filter: ArcGIS Experience Builder Custom Widget

![CI](https://github.com/mpashapu/exb-permit-filter-widget/actions/workflows/ci.yml/badge.svg)

A custom widget for **ArcGIS Experience Builder** (Developer Edition 1.21)
that lets users filter a feature layer by:

- **Category**: checkboxes with live counts loaded from the layer (e.g. permit type)
- **Date range**: from/to, inclusive (e.g. issue date)
- **Value range**: min/max (e.g. estimated construction value)

It's built for building permits, but works with any feature layer that has a
text field, and optionally a date and a numeric field: code enforcement
cases, inspections, 311 requests, and so on.

<!-- Add a screenshot after testing in your Experience Builder install: docs/screenshot.png -->

## How it works

The filter is applied through the Experience Builder **data source**
(`updateQueryParams`), not by editing a map layer directly. Every widget
bound to the same data source responds: the map, tables, lists and charts all
show the filtered records. After each change the widget shows how many
features match.

```
Settings: pick layer + fields ──► config.json / useDataSources
                                         │
Runtime: user picks filters ──► buildWhereClause()  (pure, unit tested)
                                         │
                       ds.updateQueryParams({ where })  ──► map, table, chart…
                       ds.queryCount({ where })         ──► "124 features match"
```

Details:

- **Category values come from the layer** through one group-by statistics
  query, sorted by count. Builders can type a fixed list in settings instead
  (useful for services that don't support statistics).
- **Standardized SQL**: `TYPE IN ('BLDG', 'ELEC')`, `ISSUDATE >= DATE
  '2026-01-01'`. The end date is applied as `< next day`, so permits issued
  late on the last day are still included when the field stores a time.
- **Safe SQL**: values are quoted with single quotes doubled, and configured
  field names must be plain identifiers.
- **Validation** catches impossible dates, reversed ranges and non-numeric
  input before anything is sent.
- **Stale responses are ignored**: if a user applies twice quickly, only the
  latest count is shown.
- **No invisible filters**: the widget removes its filter when it closes.
- **Accessible**: grouped controls use `fieldset`/`legend`, validation errors
  use `role="alert"`, and result counts are announced through an
  `aria-live` region.

## Install

1. Copy the `permit-filter` folder into your Experience Builder Developer
   Edition at `client/your-extensions/widgets/`.
2. Restart the client (`npm start` in `client/`).
3. In the builder, add **Permit Filter** to a page with a Map widget.
4. In the widget settings:
   - **Data**: choose the feature layer (the same one the map shows)
   - **Fields**: category field (required); date and numeric fields (optional)
   - **Category values**: optional fixed list; leave blank to load from the layer

Built against the Developer Edition 1.21 conventions (React 19, which ExB
adopted in 1.19): function components, `hooks.useTranslation`,
`DataSourceComponent`, and `jimu-ui` controls.

## Project layout

```
permit-filter/                 ← copy this folder into ExB
├── manifest.json
├── config.json                Default settings
├── src/
│   ├── config.ts              Settings schema
│   ├── runtime/
│   │   ├── widget.tsx         UI, data source wiring, counts
│   │   ├── filter-utils.ts    Where-clause building and validation (no framework imports)
│   │   └── translations/
│   └── setting/
│       ├── setting.tsx        Data source and field selectors
│       └── translations/
└── tests/
    └── filter-utils.test.ts   24 tests
```

The SQL and validation logic sits in `filter-utils.ts` with no Experience
Builder imports, so it can be tested on its own. The widget file only
handles UI and data source calls.

## Tests

```bash
npm install
npm run ci      # type-check + TSX transpile check + unit tests
```

The tests use plain `describe`/`it`/`expect`, so they also run under the
Experience Builder client's own Jest setup (`npm test` in `client/`).

CI covers the framework-independent logic. The widget and settings TSX are
syntax-checked here and type-checked by the Experience Builder client, which
provides the `jimu-*` packages.

## License

[MIT](LICENSE) © 2026 Malla Reddy Pashapu
