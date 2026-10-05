import path from 'node:path';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {bundle} from '@remotion/bundler';
import {selectComposition,renderMedia,renderStill} from '@remotion/renderer';
import {demo,browserExecutable,folders,json} from './common.mjs';
await folders();
const mapping={};for(const f of await readdir(path.join(demo,'public/assets/catalog'))){for(const [key,id]of [['Rose','flowers-rose-'],['Tulip','flowers-tulip-'],['Peony','flowers-peony-'],['Cuddle Teddy','teddy-bear'],['Heart Balloon','heart-balloon'],['Memory Frame','standing-frame'],['Landscape Frame','landscape-frame'],['Golden Frame','golden-frame'],['Snapshot Frame','snapshot-frame']])if(f.startsWith(id))mapping[key]=f;}
await json('src/assets.json',mapping);
console.log('Bundling the PetalPop motion composition…');
const serveUrl=await bundle({entryPoint:path.join(demo,'src/index.tsx'),rootDir:demo,publicDir:path.join(demo,'public'),outDir:path.join(demo,'.cache/bundle')});
await writeFile(path.join(demo,'.cache/serve-url.txt'),serveUrl);
const composition=await selectComposition({serveUrl,id:'PetalPopAd',browserExecutable,chromiumOptions:{gl:'swangle'}});
const samples=[72,195,375,555,720,900,1110,1290,1440,1645,1910,2100,2295,2475,2655];
for(const frame of samples){await renderStill({serveUrl,composition,frame,output:path.join(demo,'output/qa',`frame-${frame}.png`),browserExecutable,chromiumOptions:{gl:'swangle'},imageFormat:'png'});console.log(`Reviewed-frame output ${frame}`);}
if(process.argv.includes('--stills-only'))process.exit(0);
let percent=-1;const started=Date.now();
await renderMedia({serveUrl,composition,outputLocation:path.join(demo,'output/petalpop-marketing-ad.mp4'),codec:'h264',browserExecutable,chromiumOptions:{gl:'swangle'},pixelFormat:'yuv420p',crf:18,imageFormat:'jpeg',jpegQuality:94,concurrency:2,audioCodec:'aac',audioBitrate:'256k',offthreadVideoCacheSizeInBytes:512*1024*1024,onProgress:p=>{const n=Math.floor(p.progress*20)*5;if(n!==percent){percent=n;console.log(`Render ${n}%`);}}});
await json('output/render-report.json',{width:1080,height:1920,fps:30,durationSeconds:90,codec:'H.264/AAC',secondsToRender:(Date.now()-started)/1000,composition:'PetalPopAd',source:'Approved 90-second script',music:'Original 120 BPM electropop',publication:false});
console.log('Rendered output/petalpop-marketing-ad.mp4');
