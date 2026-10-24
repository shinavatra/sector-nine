import assert from'node:assert/strict'
import fs from'node:fs'
import path from'node:path'
const read=file=>fs.readFileSync(file,'utf8')
const theme=read('src/contexts/ThemeContext.tsx'),css=read('src/index.css'),configuration=read('src/pages/Configuration.tsx'),migration=read('src/server/048_retro_profile_customization.sql'),gitignore=read('.gitignore')
assert.match(theme,/attribute\.name\.startsWith\('data-theme'\)/)
assert.match(theme,/property\.startsWith\('--theme-'\)/)
assert.match(theme,/availableThemes\.includes\(requested\) \? requested : "default"/)
assert.match(css,/:root\[data-theme="l4d2"\][\s\S]*--theme-primary: #8fa765/)
assert.match(css,/:root\[data-theme="cod4"\][\s\S]*--theme-primary: #ab9153/)
assert.match(css,/\.app-header \{[\s\S]*position: sticky;[\s\S]*z-index: 40;/)
assert.doesNotMatch(configuration,/defaultOpen/)
assert.equal((configuration.match(/<SettingsGroup id=/g)||[]).length,5)
const frames=fs.readdirSync('public/profile-assets/retro/frames').filter(file=>/^frame-\d{2}\.png$/.test(file)),thumbs=fs.readdirSync('public/profile-assets/retro/frames/thumbs').filter(file=>/^frame-\d{2}\.png$/.test(file))
assert.equal(frames.length,50);assert.equal(thumbs.length,50)
for(const file of frames)assert.ok(fs.statSync(path.join('public/profile-assets/retro/frames',file)).size>0)
for(let index=1;index<=50;index++){const number=String(index).padStart(2,'0');assert.match(migration,new RegExp(`/profile-assets/retro/frames/frame-${number}\\.png`));assert.ok(fs.existsSync(`build/profile-assets/retro/frames/frame-${number}.png`))}
assert.doesNotMatch(gitignore,/(^|\n)public(\/|\\|$)/)
console.log('theme, accordion, header and 50-frame asset regression: PASS')
