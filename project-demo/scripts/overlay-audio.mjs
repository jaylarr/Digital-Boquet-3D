import path from 'node:path';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {demo,run,ffmpeg,probe} from './common.mjs';
const out=path.join(demo,'capcut-overlay-v2'),sr=24000,seconds=90,N=sr*seconds;
await mkdir(path.join(out,'audio'),{recursive:true});
const music=new Float32Array(N*2),allSfx=new Float32Array(N*2);
let randomState=78139;
const noise=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/2147483648-1;};
const hz=n=>440*2**((n-69)/12),T=2*Math.PI;
function add(buf,start,dur,fn,pan=0){const at=Math.round(start*sr),len=Math.min(Math.round(dur*sr),buf.length/2-at);for(let i=0;i<len;i++){const t=i/sr,v=fn(t),pos=(at+i)*2;if(pos<0)continue;buf[pos]+=v*Math.sqrt((1-pan)/2);buf[pos+1]+=v*Math.sqrt((1+pan)/2);}}
function wav(pcm){const b=Buffer.alloc(44+pcm.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(pcm.length*2,40);for(let i=0;i<pcm.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,pcm[i]))*32767),44+i*2);return b;}
const beat=60/132,chords=[[51,55,58,62],[48,51,55,58],[44,48,51,55],[46,50,53,58]],phrases=[[75,79,82,86,84,82,79,77],[79,82,86,87,86,82,79,75],[80,84,87,89,87,84,82,79],[77,82,86,89,86,84,82,79]];
const pluck=(note,gain,decay=6)=>t=>gain*Math.min(1,t*160)*Math.exp(-t*decay)*(Math.sin(T*hz(note)*t)+.25*Math.sin(T*hz(note)*2.01*t)+.08*Math.sin(T*hz(note)*3*t));
for(let b=0;b*beat<87;b++){
 const t=b*beat,bar=Math.floor(b/4),chord=chords[Math.floor(bar/2)%4],bridge=t>=51&&t<69,e=t<5?.4:bridge?.45:1;
 if(t>=4&&!bridge)add(music,t,.24,u=>.2*Math.exp(-u*20)*Math.sin(T*(50*u+100*(1-Math.exp(-u*28))/28)));
 if(b%4===1||b%4===3){if(!bridge){for(const offset of [0,.013,.029])add(music,t+offset,.14,u=>.016*Math.exp(-u*26)*noise(),.15);add(music,t,.13,u=>.015*Math.exp(-u*23)*Math.sin(T*185*u));}}
 if(t>=9&&!bridge)for(const [offset,gain]of [[0,.008],[beat*.5,.011]])add(music,t+offset,.05,u=>gain*Math.exp(-u*95)*noise(),b%2?.6:-.6);
 if(t>=5){const bass=chord[0]-12+(b%8===7?7:0);for(const offset of [0,b%4===2?beat*.75:beat*.5])add(music,t+offset,.28,u=>.095*e*Math.min(1,u*100)*Math.exp(-u*9)*(Math.sin(T*hz(bass)*u)+.15*Math.sin(T*hz(bass)*2*u)));}
 if(b%4===0)for(const [i,n]of chord.entries()){add(music,t,2.1,pluck(n+12,.018,1.5),(i-1.5)*.25);add(music,t+.17,1.6,pluck(n+12,.005,2.4),(1.5-i)*.25);}
 const n=phrases[Math.floor(bar/4)%4][b%8];
 if(![3,7].includes(b%8)){add(music,t,.7,pluck(n,.035*e),-.2);add(music,t+beat*.75,.7,pluck(n,.01*e),.5);}
 if(t>=16&&t<51||t>=69){const n=chord[(b+1)%4]+24;add(music,t+beat*.5,.35,pluck(n,.012),b%2?.7:-.7);}
 if(b%16===15&&!bridge)for(let k=0;k<3;k++)add(music,t+k*beat/3,.065,u=>.01*Math.exp(-u*50)*noise(),k%2?.35:-.35);
}
for(const [i,n]of [51,55,58,62,75].entries())add(music,87,3,pluck(n,.032,1.05),(i-2)*.22);
for(let i=0;i<N;i++){const t=i/sr,g=Math.min(1,t/.14,(90-t)/1.0);music[i*2]*=g;music[i*2+1]*=g;}
const plan=JSON.parse(await readFile(path.join(out,'candidate-moments.json'),'utf8'));
const typeById={'01':'chime','02':'slide','03':'tap','04':'leaf','05':'ribbon','06':'air','07':'air','08':'reverse','09':'bounce','10':'paper','11':'camera','12':'confetti','13':'chime','14':'paper','15':'chime'};
function cue(type,exit=false){const dur=exit?.3:.48,buf=new Float32Array(Math.round(sr*dur)*2),g=exit?.6:1;
 if(['slide','ribbon','air','reverse','leaf'].includes(type))add(buf,0,dur,u=>g*.033*Math.sin(Math.PI*u/dur)**2*(noise()*.28+Math.sin(T*(240*u+680*u*u))*.55),type==='reverse'?-.4:.35);
 else if(type==='paper')add(buf,0,dur,u=>g*.023*Math.sin(Math.PI*u/dur)**2*noise(),-.15);
 else if(type==='confetti'){add(buf,0,.14,u=>.075*Math.exp(-u*30)*(Math.sin(T*92*u)+noise()*.17));[84,88,91].forEach((n,i)=>add(buf,i*.08,.22,pluck(n,.022),i*.5-.5));}
 else if(type==='camera'){add(buf,0,.07,u=>.042*Math.exp(-u*45)*noise());add(buf,.07,.23,pluck(86,.025));}
 else if(type==='bounce'){add(buf,0,.3,u=>g*.041*Math.exp(-u*15)*Math.sin(T*(160*u+100*(1-Math.exp(-u*20))/20)));}
 else if(type==='tap')add(buf,0,.18,pluck(exit?79:82,.045,15));
 else [75,79,82].forEach((n,i)=>add(buf,i*.055,.26,pluck(n,g*.03,9),i*.4-.4));
 return {buf,dur};
}
const placements=[];
for(const m of plan.moments){const id=m.id.slice(-2),type=typeById[id];for(const direction of ['in','out']){const c=cue(type,direction==='out'),start=direction==='in'?m.startFrame/30:(m.startFrame+m.durationFrames)/30-c.dur;const name=`${m.id}-${direction}.wav`;await writeFile(path.join(out,'audio',name),wav(c.buf));for(let i=0;i<c.buf.length;i++){const pos=Math.round(start*sr)*2+i;if(pos<allSfx.length)allSfx[pos]+=c.buf[i];}placements.push({moment:m.id,direction,type,path:'audio/'+name,startFrame:Math.round(start*30),durationSeconds:c.dur});}}
for(const [i,t]of [368/30,13.2].entries()){const c=cue('tap'),name=`PP-03-tap-${i+1}.wav`;await writeFile(path.join(out,'audio',name),wav(c.buf));for(let i=0;i<c.buf.length;i++)allSfx[Math.round(t*sr)*2+i]+=c.buf[i];placements.push({moment:'PP-03',direction:'tap',type:'tap',path:'audio/'+name,startFrame:Math.round(t*30),durationSeconds:c.dur});}
await writeFile(path.join(out,'audio/music-original.wav'),wav(music));
await writeFile(path.join(out,'audio/overlay-sound-design.wav'),wav(allSfx));
await copyFile(path.join(demo,'public/assets/narration.wav'),path.join(out,'audio/narration.wav'));
// Normalize first, so the lookahead delay cannot truncate a live sidechain's tail.
await run(ffmpeg,['-y','-v','error','-i',path.join(out,'audio/music-original.wav'),'-af','loudnorm=I=-23:TP=-4:LRA=8','-t','90','-ar','48000','-c:a','pcm_s16le',path.join(out,'audio/music-normalized.wav')]);
await run(ffmpeg,['-y','-v','error','-i',path.join(out,'audio/narration.wav'),'-i',path.join(out,'audio/music-normalized.wav'),'-filter_complex','[1:a][0:a]sidechaincompress=threshold=0.018:ratio=3:attack=8:release=230[duck]','-map','[duck]','-t','90','-ar','48000','-c:a','pcm_s16le',path.join(out,'audio/music-for-editor.wav')]);
if(Math.abs(Number((await probe(path.join(out,'audio/music-for-editor.wav'))).format.duration)-90)>.001)throw new Error('Ducked music tail is incomplete');
await run(ffmpeg,['-y','-v','error','-i',path.join(out,'audio/narration.wav'),'-i',path.join(out,'audio/music-for-editor.wav'),'-i',path.join(out,'audio/overlay-sound-design.wav'),'-filter_complex','[0:a][1:a][2:a]amix=inputs=3:normalize=0[mix]','-map','[mix]','-t','90','-ar','48000','-c:a','pcm_s16le',path.join(out,'audio/raw-sum.wav')]);
const measured=await run(ffmpeg,['-v','info','-i',path.join(out,'audio/raw-sum.wav'),'-af','ebur128=peak=true','-f','null','-']);
const integrated=[...measured.stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)?.[1],peak=[...measured.stderr.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].at(-1)?.[1];
if(!integrated||!peak)throw new Error('Missing soundtrack loudness measurement');
const gainDb=Math.min(-18-Number(integrated),-1.2-Number(peak)),editorVolume=10**(gainDb/20);
await run(ffmpeg,['-y','-v','error','-i',path.join(out,'audio/raw-sum.wav'),'-af',`volume=${editorVolume}`,'-c:a','pcm_s16le',path.join(out,'audio/final-mix.wav')]);
await writeFile(path.join(out,'sound-placements.json'),JSON.stringify({originalMusic:'132 BPM synthesized electropop with electric-piano chords, syncopated bass, bright plucks, stereo percussion, letter/photo bridge and final cadence; no sampled songs',voice:'Existing local generic synthetic narration',editorVolume,gainDb,measuredRaw:{integratedLufs:Number(integrated),truePeakDb:Number(peak)},placements},null,2)+'\n');
console.log('New score, motion-specific in/out cues and final mix ready.');
