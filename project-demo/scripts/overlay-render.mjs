import path from 'node:path';
import {mkdir,readFile,writeFile,copyFile,rename,access} from 'node:fs/promises';
import {bundle} from '@remotion/bundler';
import {selectComposition,renderMedia,renderStill} from '@remotion/renderer';
import {demo,browserExecutable,probe} from './common.mjs';
import {verifyAlpha} from './overlay-alpha.mjs';
const out=path.join(demo,'capcut-overlay-v2');
for(const d of ['overlays','review'])await mkdir(path.join(out,d),{recursive:true});
await mkdir(path.join(demo,'public/media/v2'),{recursive:true});
const plan=JSON.parse(await readFile(path.join(out,'candidate-moments.json'),'utf8'));
try{const prior=JSON.parse(await readFile(path.join(out,'rendered-moments.json'),'utf8'));for(const m of plan.moments){const old=prior.moments.find(x=>x.id===m.id);if(old?.overlay)m.overlay=old.overlay;}}catch{}
const ids=process.argv.find(x=>x.startsWith('--ids='))?.split('=')[1].split(',')||plan.moments.map(m=>m.id.slice(-2));
for(const id of ids)await copyFile(path.join(out,'base',`PP-${id}-base.mp4`),path.join(demo,'public/media/v2',`PP-${id}-base.mp4`));
console.log('Bundling individual overlay graphics…');
const serveUrl=await bundle({entryPoint:path.join(demo,'src/OverlayAd.tsx'),rootDir:demo,publicDir:path.join(demo,'public'),outDir:path.join(demo,'.cache/overlay-bundle')});
const options={serveUrl,id:'PetalPopOverlay',browserExecutable,chromiumOptions:{gl:'swangle'}};
const stage=path.join(demo,'.cache','overlay-family-'+Date.now());
if(!process.argv.includes('--stills-only')){
 await mkdir(stage,{recursive:true});
 for(const m of plan.moments)if(!ids.includes(m.id.slice(-2)))await copyFile(path.join(out,'overlays',m.id+'.mov'),path.join(stage,m.id+'.mov'));
}
for(const id of ids){
 const composition=await selectComposition({...options,inputProps:{id,mode:'composite',subtitles:true}});
 const moment=plan.moments.find(m=>m.id==='PP-'+id);
 for(const frame of [Math.round(composition.durationInFrames*.45),composition.durationInFrames-17]){
   await renderStill({...options,composition,inputProps:{id,mode:'composite',subtitles:true},frame,output:path.join(out,'review',`PP-${id}-${frame}.png`),imageFormat:'png'});
 }
 console.log(`Review stills ${id}`);
 if(process.argv.includes('--stills-only'))continue;
 let last=-1;
 const overlayComposition=await selectComposition({...options,inputProps:{id,mode:'overlay',subtitles:true}});
 await renderMedia({...options,composition:overlayComposition,inputProps:{id,mode:'overlay',subtitles:true},outputLocation:path.join(stage,`PP-${id}.mov`),codec:'prores',proResProfile:'4444',pixelFormat:'yuva444p10le',imageFormat:'png',concurrency:3,audioCodec:null,muted:true,onProgress:p=>{const n=Math.floor(p.progress*4)*25;if(n!==last){last=n;console.log(`Alpha graphic ${id} ${n}%`);}}});
 moment.overlay=`overlays/PP-${id}.mov`;
}
if(!process.argv.includes('--stills-only')){
 for(const m of plan.moments){
  const file=path.join(stage,m.id+'.mov');await access(file);
  const p=await probe(file),v=p.streams.find(s=>s.codec_type==='video');
  if(v.width!==1080||v.height!==1920||Number(v.nb_frames)!==m.durationFrames)throw new Error('Staged overlay format mismatch '+m.id);
  await verifyAlpha(file,m.durationFrames/60,m.id+'-staged');
 }
 const current=path.join(out,'overlays'),backup=path.join(demo,'.cache','overlays-before-'+Date.now());
 await rename(current,backup);
 try{await rename(stage,current);}catch(error){await rename(backup,current);throw error;}
 await writeFile(path.join(out,'rendered-moments.json'),JSON.stringify(plan,null,2)+'\n');
}
console.log('Overlay rendering complete.');
