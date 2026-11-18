// Syntax/transpile check for the widget's TSX. jimu-* packages only exist
// inside an Experience Builder install, so they are marked external here.
import { build } from 'esbuild'

const entryPoints = [
  'permit-filter/src/runtime/widget.tsx',
  'permit-filter/src/setting/setting.tsx'
]

await build({
  entryPoints,
  bundle: true,
  write: false,
  outdir: 'out', // required by esbuild for multiple entries; nothing is written
  logLevel: 'error',
  jsx: 'automatic',
  external: ['jimu-core', 'jimu-ui', 'jimu-ui/*', 'jimu-for-builder', 'jimu-arcgis', 'seamless-immutable', 'react']
})
console.log(`Transpiled ${entryPoints.length} TSX entry points without errors.`)
