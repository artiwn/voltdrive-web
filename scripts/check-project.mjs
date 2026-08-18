import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd();
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const files=walk(root).filter(f=>!f.includes(`${path.sep}.git${path.sep}`));
for(const file of files.filter(f=>f.endsWith('.js'))){execFileSync(process.execPath,['--check',file],{stdio:'inherit'});}
const missing=[];
for(const file of files.filter(f=>f.endsWith('.html'))){const html=fs.readFileSync(file,'utf8');for(const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)){const ref=match[1];if(/^(?:https?:|mailto:|tel:|javascript:)/.test(ref))continue;const clean=ref.split('?')[0];const target=path.resolve(path.dirname(file),clean);if(!fs.existsSync(target))missing.push(`${path.relative(root,file)} -> ${ref}`);}}
if(missing.length){console.error('Missing local references:\n'+missing.join('\n'));process.exit(1)}
console.log(`Project check passed: ${files.filter(f=>f.endsWith('.html')).length} HTML pages and ${files.filter(f=>f.endsWith('.js')).length} JavaScript files.`);
