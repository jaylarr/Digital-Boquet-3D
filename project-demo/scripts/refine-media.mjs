import path from 'node:path';
import {readFile,copyFile} from 'node:fs/promises';
import {demo,run,ffmpeg,json,probe} from './common.mjs';
const timing={};
async function pixels(file,x,y,offset=0,duration){
  const out=path.join(demo,'.cache',`luma-${path.basename(file)}-${x}-${y}.bin`);
  const trim=`trim=start=${offset}${duration?`:end=${offset+duration}`:''},setpts=PTS-STARTPTS,`;
  await run(ffmpeg,['-y','-v','error','-i',file,'-vf',trim+`fps=30,crop=2:2:${x}:${y},scale=1:1,format=gray`,'-f','rawvideo',out]);return readFile(out);
}
async function modalTimes(file,offset=0,duration,withSheet=false){
  const b=await pixels(file,4,500,offset,duration);let begin=-1,end=-1;
  for(let i=0;i<b.length;i++){if(begin<0&&b[i]<225)begin=i;if(begin>=0&&i>begin+45&&b[i]>242){end=i;break;}}
  let sheet=-1;if(withSheet&&begin>=0){const s=await pixels(file,720,240,offset,duration);for(let i=begin+15;i<s.length-2;i++){if(s[i]>232&&s[i+1]>232&&s[i+2]>232){sheet=i;break;}}}
  return {begin:begin>=0?begin/30:null,end:end>=0?end/30:null,sheet:sheet>=0?sheet/30:null};
}
async function edit(r,pieces){
  const filters=pieces.map((p,i)=>`[0:v]trim=start=${p.start}:end=${p.end},setpts=(PTS-STARTPTS)/${p.speed},fps=30[v${i}]`).join(';')+';'+pieces.map((_,i)=>`[v${i}]`).join('')+`concat=n=${pieces.length}:v=1:a=0,tpad=stop_mode=clone:stop_duration=1[out]`;
  await run(ffmpeg,['-y','-v','error','-i',path.join(demo,r.rawSource),'-filter_complex',filters,'-map','[out]','-t',String(r.outputSeconds),'-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p',path.join(demo,'public/media',`${r.id}.mp4`)]);
}
for(const id of ['10','14']){
  const r=JSON.parse(await readFile(path.join(demo,'.cache',`capture-${id}.json`),'utf8'));
  // Screencast frames can arrive after the DOM marker repaint. Include the
  // recorded tail so the note sheet and Save & seal result cannot be cut off.
  const originalBoundary=r.sourceSeconds;
  r.sourceSeconds=Number((await probe(path.join(demo,r.rawSource))).format.duration)-r.trimStart-.04;
  const detected=await modalTimes(path.join(demo,r.rawSource),r.trimStart,r.sourceSeconds,true);
  if(detected.begin===null||detected.sheet===null)throw new Error(`Missing complete native envelope reveal in ${id}`);
  const begin=detected.begin,finish=detected.sheet,nativeSource=finish-begin,nativeTarget=2.2;
  // Software-rendered capture can stretch CSS time. Retain the complete reveal,
  // restoring the UI's 1.65s flight plus .45s sheet appearance with a short hold.
  const nativeRate=nativeSource/nativeTarget;
  const otherRate=(r.sourceSeconds-nativeSource)/(r.outputSeconds-nativeTarget);
  const preTarget=id==='14'?2:begin/otherRate;
  const postTarget=id==='14'?.8:r.outputSeconds-nativeTarget-preTarget;
  const preRate=begin/preTarget,postRate=(r.sourceSeconds-finish)/postTarget,s=r.trimStart;
  await edit(r,[{start:s,end:s+begin,speed:preRate},{start:s+begin,end:s+finish,speed:nativeRate},{start:s+finish,end:s+r.sourceSeconds,speed:postRate}].filter(p=>p.end-p.start>.01));
  timing[id]={nativeAnimationComplete:true,sourceRevealSeconds:nativeSource,editedRevealSeconds:nativeTarget,intendedCSSAnimationSeconds:2.1,recordingTimingAdjusted:true,recordedTailIncludedSeconds:r.sourceSeconds-originalBoundary,openAt:preTarget,afterRevealAt:preTarget+nativeTarget,closeAt:detected.end===null?r.outputSeconds:preTarget+nativeTarget+(detected.end-finish)/postRate};
  console.log(`Complete ${id} envelope reveal: ${nativeSource.toFixed(2)}s source → ${nativeTarget}s designed motion.`);
}
const photo=JSON.parse(await readFile(path.join(demo,'.cache/capture-11.json'),'utf8'));
const pm=await modalTimes(path.join(demo,'public/media/11.mp4'));
timing['11']={uploadAt:(photo.marks.find(m=>m.label==='upload')?.time||1)/photo.speed,openAt:pm.begin??.7,closeAt:pm.end??6.5};
const share=JSON.parse(await readFile(path.join(demo,'.cache/capture-13.json'),'utf8'));
share.sourceSeconds=Number((await probe(path.join(demo,share.rawSource))).format.duration)-share.trimStart-.04;
const sm=await modalTimes(path.join(demo,share.rawSource),share.trimStart,share.sourceSeconds);
if(sm.begin===null)throw new Error('Missing real sharing dialog');
await edit(share,[{start:share.trimStart,end:share.trimStart+sm.begin,speed:sm.begin/3},{start:share.trimStart+sm.begin,end:share.trimStart+share.sourceSeconds,speed:(share.sourceSeconds-sm.begin)/3}]);
timing['13']={openAt:3,copiedStateHoldSeconds:1,completeActionSequence:true};
await json('src/footage-timing.json',timing);await json('output/native-motion-report.json',timing);
await copyFile(path.join(demo,'public/assets/memory-photo.png'),path.join(demo,'output/demo-memory-photo.png'));
