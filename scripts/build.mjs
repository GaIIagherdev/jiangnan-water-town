import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=path.join(root,'src'),destination=path.join(root,'dist');
async function bundle(sourceDir,destinationDir){
 const result=await build({entryPoints:[path.join(sourceDir,'main.js')],bundle:true,minify:true,format:'iife',target:['es2020'],write:false,legalComments:'inline',alias:{'three/addons':path.join(source,'vendor/addons'),'three':path.join(source,'vendor/three.module.js')}});
 const javascript=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'),css=await fs.readFile(path.join(sourceDir,'style.css'),'utf8');
 let html=await fs.readFile(path.join(sourceDir,'index.html'),'utf8');
 html=html.replace('<link rel="stylesheet" href="style.css">',()=>`<style>${css}</style>`).replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="main.js"></script>',()=>`<script>${javascript}</script>`);
 await fs.mkdir(destinationDir,{recursive:true});await fs.writeFile(path.join(destinationDir,'index.html'),html);
 console.log(`Built ${path.relative(root,destinationDir)}/index.html (${Math.round(Buffer.byteLength(html)/1024)} KiB)`);
}
await bundle(source,destination);
await bundle(path.join(source,'game'),path.join(destination,'play'));
await fs.writeFile(path.join(destination,'.nojekyll'),'');
await fs.copyFile(path.join(source,'vendor/LICENSE-three.txt'),path.join(destination,'LICENSE-three.txt'));
