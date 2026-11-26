// Genera src/vendor/leafletSource.js con el JS y CSS de Leaflet como texto,
// para empaquetarlo en la app (sin CDN). Ejecutar: node scripts/genLeaflet.js
const fs = require('fs');
const d = require.resolve('leaflet/dist/leaflet.js').replace(/leaflet\.js$/, '');
const js = fs.readFileSync(d + 'leaflet.js', 'utf8').replace(/\/\/# sourceMappingURL=.*$/m, '');
// Se quitan las reglas que referencian imágenes (usamos divIcon/circleMarker)
const css = fs.readFileSync(d + 'leaflet.css', 'utf8').replace(/url\([^)]*\)/g, 'none');
fs.writeFileSync('src/vendor/leafletSource.js',
  '// GENERADO por scripts/genLeaflet.js (Leaflet ' + require('leaflet/package.json').version + ', BSD-2). No editar.\n' +
  'export const LEAFLET_JS = ' + JSON.stringify(js) + ';\nexport const LEAFLET_CSS = ' + JSON.stringify(css) + ';\n');
