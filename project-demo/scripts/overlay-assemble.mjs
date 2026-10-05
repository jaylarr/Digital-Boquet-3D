import path from 'node:path';
import {mkdir,readFile,writeFile,rename,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {demo,ffmpeg,probe,run} from './common.mjs';
import {verifyAlpha} from './overlay-alpha.mjs';
const out=path.join(demo,'capcut-overlay-v2');
const plan=JSON.parse(await readFile(path.join(out,'rendered-moments.json'),'utf8'));
const cut=JSON.parse(await readFile(path.join(out,'base-cut.json'),'utf8'));
await mkdir(path.join(out,'composed'),{recursive:true});
if(plan.moments.length!==15||cut.clips.length!==15)throw new Error('Refusing partial family');
let cursor=0;
const alphaChecks=[];
for(const m of plan.moments){
 const base=cut.clips.find(c=>c.id===m.id);if(!base||base.startFrame!==cursor||base.durationFrames!==m.durationFrames)throw new Error('Cut coordinates changed');
 cursor+=base.durationFrames;
 const file=path.join(out,base.path),alpha=path.join(out,m.overlay||'MISSING');
 const bp=await probe(file);if(Number(bp.streams.find(s=>s.codec_type==='video').nb_frames)!==m.durationFrames)throw new Error('Base frame count does not match locked cut '+m.id);
 if(createHash('sha256').update(await readFile(file)).digest('hex')!==base.sha256)throw new Error('Base clip changed after overlay placement');
 const p=await probe(alpha),v=p.streams.find(s=>s.codec_type==='video');
 if(v.width!==cut.width||v.height!==cut.height||Number(v.nb_frames)!==m.durationFrames||!v.pix_fmt.includes('a')||Math.abs(Number(p.format.duration)-m.durationFrames/30)>.04)throw new Error('Invalid overlay dimensions, alpha or duration '+m.id);
 alphaChecks.push(await verifyAlpha(alpha,m.durationFrames/60,m.id));
 const composed=path.join(out,'composed',m.id+'.mp4');
 if(process.argv.includes('--audio-only')){
  const p=await probe(composed);if(Number(p.streams.find(s=>s.codec_type==='video').nb_frames)!==m.durationFrames)throw new Error('Missing complete video composition '+m.id);
 }else await run(ffmpeg,['-y','-v','error','-i',file,'-i',alpha,'-filter_complex','[0:v][1:v]overlay=0:0:shortest=1:format=auto,format=yuv420p[v]','-map','[v]','-an','-t',String(m.durationFrames/30),'-r','30','-c:v','libx264','-preset','fast','-crf','18','-color_range','tv','-movflags','+faststart',composed]);
 console.log('Composited '+m.id);
}
if(cursor!==2700)throw new Error('Invalid total cut duration');
// Concat demuxer paths are quoted using its own syntax, not shell escaping.
const list=plan.moments.map(m=>`file '${path.join(out,'composed',m.id+'.mp4').replaceAll('\\','/').replaceAll("'","'\\''")}'`).join('\n');
await writeFile(path.join(out,'composed/concat.txt'),list+'\n');
const pending=path.join(out,'petalpop-overlay-ad.pending.mp4'),final=path.join(out,'petalpop-overlay-ad.mp4');
await run(ffmpeg,['-y','-v','error','-f','concat','-safe','0','-i',path.join(out,'composed/concat.txt'),'-i',path.join(out,'audio/final-mix.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','256k','-t','90','-movflags','+faststart',pending]);
const pendingProbe=await probe(pending);
if(Number(pendingProbe.streams.find(s=>s.codec_type==='video').nb_frames)!==2700)throw new Error('Incomplete assembled family; previous export preserved');
try{await copyFile(final,path.join(out,'archive','petalpop-v2-before-rebuild.mp4'));}catch(error){if(error.code!=='ENOENT')throw error;}
await rename(pending,final);
await writeFile(path.join(out,'placement-lock.json'),JSON.stringify({width:cut.width,height:cut.height,fps:cut.fps,durationFrames:cursor,baseCutSha256:createHash('sha256').update(await readFile(path.join(out,'base-cut.json'))).digest('hex'),momentIds:plan.moments.map(m=>m.id),completeFamily:true},null,2)+'\n');
await writeFile(path.join(out,'alpha-verification.json'),JSON.stringify({allOverlaysContainTransparency:true,checks:alphaChecks},null,2)+'\n');
console.log('Complete replacement ad exported.');
