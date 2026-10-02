// Read all four JSON files and output them as INLINE_LANGS
const fs = require('fs');
const path = require('path');
const base = process.argv[2];
const langs = ['en', 'tr', 'de', 'ru'];
const result = {};
for (const l of langs) {
  const raw = fs.readFileSync(path.join(base, 'lang', l + '.json'), 'utf8');
  result[l] = JSON.parse(raw);
}
const lines = [];
lines.push('const INLINE_LANGS = {');
for (let i = 0; i < langs.length; i++) {
  const l = langs[i];
  const comma = i < langs.length - 1 ? ',' : '';
  lines.push('  "' + l + '": ' + JSON.stringify(result[l]) + comma);
}
lines.push('};');
fs.writeFileSync(path.join(base, 'inline_langs_new.js'), lines.join('\n'), 'utf8');
console.log('Done');
