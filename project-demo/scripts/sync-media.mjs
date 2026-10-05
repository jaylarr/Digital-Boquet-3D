import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {demo,sourceFence,run,ffmpeg,json} from './common.mjs';
const captures=[];
const through=Number(process.argv.find(a=>a.startsWith('--through='))?.slice(10)||14);
for(let n=2;n<=through;n++){
  const id=String(n).padStart(2,'0'),r=JSON.parse(await readFile(path.join(demo,'.cache',`capture-${id}.json`),'utf8'));
  const source=path.join(demo,r.rawSource),sync=await sourceFence(source);
  r.trimStart=sync.start;r.sourceSeconds=sync.end-sync.start;r.speed=Math.max(1,r.sourceSeconds/r.outputSeconds);r.synchronization='Recorded chromatic start marker and end marker or final recorded frame; frame-accurate decoded trim';r.endMarkerDetected=sync.endMarkerDetected;
  await run(ffmpeg,['-y','-v','error','-i',source,'-vf',`trim=start=${sync.start}:end=${sync.end},setpts=(PTS-STARTPTS)/${r.speed},fps=30,tpad=stop_mode=clone:stop_duration=1`,'-t',String(r.outputSeconds),'-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p',path.join(demo,'public/media',`${id}.mp4`)]);
  await json(`.cache/capture-${id}.json`,r);captures.push(r);console.log(`Frame synchronization ${id}: ${r.sourceSeconds.toFixed(2)}s`);
}
await json('output/frame-synchronization-report.json',{captures,method:'Pixel chroma survives native dialog backdrop dimming',decodedTrim:true});
try{const report=JSON.parse(await readFile(path.join(demo,'output/recording-report.json'),'utf8'));if(through===14){report.captures=captures;await json('output/recording-report.json',report);}}catch{}
