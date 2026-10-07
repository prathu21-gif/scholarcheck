import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
const analyzer=await readFile('worker/analyzer.js','utf8');const html=await readFile('worker/page.html','utf8');
await writeFile('dist/server/index.js',analyzer+'\nconst page='+JSON.stringify(html)+';\n'+await readFile('worker/handler.js','utf8'));
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');console.log('Built Worker');
