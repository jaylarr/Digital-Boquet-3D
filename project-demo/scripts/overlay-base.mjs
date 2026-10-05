import path from 'node:path';
import {mkdir,readFile,writeFile,copyFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {demo,ffmpeg,run,probe} from './common.mjs';
const out=path.join(demo,'capcut-overlay-v2');
let locked=false;try{await access(path.join(out,'placement-lock.json'));locked=true;}catch{}
if(locked&&!process.argv.includes('--reopen-cut'))throw new Error('Base cut is frozen. Explicitly reopen the cut and re-render all overlays before rebuilding.');
await mkdir(path.join(out,'base'),{recursive:true});
await mkdir(path.join(demo,'public/media/v2'),{recursive:true});
const plan=JSON.parse(await readFile(path.join(out,'candidate-moments.json'),'utf8'));
const selected=process.argv.find(x=>x.startsWith('--ids='))?.split('=')[1].split(',');
// Each crop is expressed on the actual 1440x1040 capture, never the rejected V1 export.
const view={x:53,y:221,w:707,h:450,top:180};
const controls={x:816,y:355,w:552,h:440,top:930};
const hero={x:225,y:0,w:550,h:612,top:325};
const crops={
 '02':[view,controls,{x:390,y:180,w:660,h:720,top:310,from:0,to:3.3}],
 '03':[view,{x:818,y:430,w:552,h:350,top:1010}],
 '04':[view,{x:816,y:315,w:552,h:450,top:945}],
 '05':[view,controls],
 '06':[view,{x:816,y:335,w:552,h:430,top:965}],
 '07':[view,{x:816,y:340,w:552,h:420,top:980}],
 '08':[view,{x:806,y:210,w:356,h:51,top:1120},{x:500,y:833,w:250,h:65,top:1440}],
 '09':[view,{x:816,y:435,w:552,h:425,top:970}],
 '10':[view,controls,{x:370,y:60,w:700,h:920,top:225,from:2.56385,to:7.64551}],
 '11':[view,controls,{x:445,y:155,w:550,h:750,top:225,from:.9,to:7.1}],
 '13':[{...controls,top:700},{x:445,y:155,w:550,h:750,top:225,from:3,to:7}],
 '14':[{x:300,y:70,w:850,h:1000,top:260}],
};
const records=[];
for(const m of plan.moments){
 const id=m.id.slice(-2);if(selected&&!selected.includes(id))continue;
 const source=path.resolve(out,m.source),dur=m.durationFrames/30;
 const layers=['01','12','15'].includes(id)?[hero]:(crops[id]||[view,controls]);
 const filters=[`color=c=0xFAF7F2:s=1080x1920:r=30:d=${dur}[bg]`];
 let sourceLabel='0:v';
 if(id==='15'){
   // Actual preset variations from the same capture session, followed by the main gift.
   filters.push('[0:v]trim=duration=3,setpts=PTS-STARTPTS[h]',
     '[1:v]trim=duration=1,setpts=PTS-STARTPTS[b]',
     '[2:v]trim=duration=1,setpts=PTS-STARTPTS[a]',
     '[3:v]trim=duration=1,setpts=PTS-STARTPTS[t]',
     '[b][a][t][h]concat=n=4:v=1:a=0[occasions]');
   sourceLabel='occasions';
 }
 if(id==='10'){
   filters.push('[0:v]split=2[n0][n1]','[n0]trim=end=3.8,setpts=PTS-STARTPTS[k0]','[n1]trim=start=4.5,setpts=PTS-STARTPTS[k1]','[k0][k1]concat=n=2:v=1:a=0,tpad=stop_mode=clone:stop_duration=0.7[edited]');
   sourceLabel='edited';
 }
 filters.push(`[${sourceLabel}]split=${layers.length}${layers.map((_,i)=>`[s${i}]`).join('')}`);
 let prior='bg';
 layers.forEach((r,i)=>{
   filters.push(`[s${i}]crop=${r.w}:${r.h}:${r.x}:${r.y},scale=1080:-2:flags=lanczos,setsar=1${r.from!==undefined?`,pad=1080:1920:0:${r.top}:color=0xFAF7F2`:''}[l${i}]`);
   const enable=r.from!==undefined?`:enable='between(t,${r.from},${r.to})'`:'';
   filters.push(`[${prior}][l${i}]overlay=0:${r.from!==undefined?0:r.top}:shortest=1${enable}[v${i}]`);prior=`v${i}`;
 });
 filters.push(`[${prior}]fps=30,tpad=stop_mode=clone:stop_duration=0.25[final]`);
 const file=path.join(out,'base',`PP-${id}-base.mp4`);
 const inputs=['-i',source];if(id==='15')for(const variant of ['birthday','anniversary','thanks'])inputs.push('-i',path.join(demo,'public/media',variant+'.mp4'));
 await run(ffmpeg,['-y','-v','error',...inputs,'-filter_complex',filters.join(';'),'-map','[final]','-t',String(dur),'-frames:v',String(m.durationFrames),'-r','30','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',file]);
 await copyFile(file,path.join(demo,'public/media/v2',`PP-${id}-base.mp4`));
 const p=await probe(file);
 if(Number(p.streams.find(s=>s.codec_type==='video').nb_frames)!==m.durationFrames)throw new Error('Base frame count mismatch '+m.id);
 records.push({id:m.id,startFrame:m.startFrame,durationFrames:m.durationFrames,path:`base/PP-${id}-base.mp4`,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),source:m.source,layers,encodedDuration:Number(p.format.duration)});
 console.log(`Clean cut ${id}`);
}
if(selected){
 let existing;try{existing=JSON.parse(await readFile(path.join(out,'base-cut.json'),'utf8'));}catch{}
 if(existing){existing.clips=existing.clips.map(c=>records.find(r=>r.id===c.id)||c);await writeFile(path.join(out,'base-cut.json'),JSON.stringify(existing,null,2)+'\n');}
 else await writeFile(path.join(out,'base-sample-manifest.json'),JSON.stringify({fps:30,width:1080,height:1920,durationFrames:2700,clips:records},null,2)+'\n');
}else await writeFile(path.join(out,'base-cut.json'),JSON.stringify({fps:30,width:1080,height:1920,durationFrames:2700,clips:records},null,2)+'\n');
console.log('Base cut complete.');
