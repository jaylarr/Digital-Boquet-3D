import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {demo,previous,folders,storyboard,run,ffmpeg,json,probe} from './common.mjs';
import {score} from './score.mjs';
await folders();
const {KokoroTTS}=await import(pathToFileURL(path.join(previous,'node_modules/kokoro-js/dist/kokoro.js')).href);
const {env}=await import(pathToFileURL(path.join(previous,'node_modules/@huggingface/transformers/dist/transformers.node.mjs')).href);
env.cacheDir=path.join(previous,'.cache/tts-model');env.allowRemoteModels=false;
const sr=24000,duration=90,narration=new Float32Array(sr*duration),cues=[],segments=[];
function wav(pcm){const b=Buffer.alloc(44+pcm.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(pcm.length*2,40);for(let i=0;i<pcm.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,pcm[i]))*32767),44+i*2);return b;}
let tts;const scenes=await storyboard();
for(const scene of scenes){
const spoken=scene.voice.replaceAll('PetalPop 3D','Petal Pop three D').replaceAll('Thank-yous','Thank yous');const hash=createHash('sha256').update(spoken+'af_heart1.04').digest('hex').slice(0,20),file=path.join(demo,'.cache',`voice-${hash}.wav`);
try{await readFile(file);}catch{if(!tts){console.log('Loading cached Kokoro voice…');tts=await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX',{dtype:'q8',device:'cpu'});}const a=await tts.generate(spoken,{voice:'af_heart',speed:1.04});await a.save(file);}
const meta=await probe(file);const original=Number(meta.format.duration);const available=scene.seconds-.4;const tempo=Math.max(1,original/available);if(tempo>1.35)throw new Error(`Voice slot ${scene.id} exceeds natural pacing: ${tempo}`);
const pcmFile=path.join(demo,'.cache',`voice-${scene.id}.f32`);await run(ffmpeg,['-y','-v','error','-i',file,'-af',`atempo=${tempo}`,'-ar',String(sr),'-ac','1','-f','f32le',pcmFile]);const b=await readFile(pcmFile),length=b.length/4;const start=scene.start+.2;for(let i=0;i<length;i++)narration[Math.round(start*sr)+i]+=b.readFloatLE(i*4);
// Sentence-level captions, timed within measured speech; split long sentences for phone legibility.
const parts=scene.voice.match(/[^.!?]+[.!?]?/g).map(t=>t.trim()).filter(Boolean).flatMap(t=>t.length>74?splitText(t):[t]);const words=parts.map(t=>t.split(/\s+/).length),total=words.reduce((a,b)=>a+b,0);let cursor=start;for(let i=0;i<parts.length;i++){const end=cursor+length/sr*words[i]/total;cues.push({start:cursor,end,text:parts[i],scene:scene.id});cursor=end;}
segments.push({id:scene.id,start,duration:length/sr,sourceSeconds:original,tempo});console.log(`Narration ${scene.id}: ${(length/sr).toFixed(2)}s`);
}
function splitText(t){const w=t.split(' '),at=Math.ceil(w.length/2);return [w.slice(0,at).join(' '),w.slice(at).join(' ')];}
const a=path.join(demo,'public/assets');await writeFile(path.join(a,'narration-raw.wav'),wav(narration));const composed=score(duration,sr);await writeFile(path.join(a,'original-score.wav'),wav(composed.music));await writeFile(path.join(a,'sound-effects.wav'),wav(composed.sfx));
await run(ffmpeg,['-y','-v','error','-i',path.join(a,'narration-raw.wav'),'-af','loudnorm=I=-16:TP=-2:LRA=7','-ar','48000','-c:a','pcm_s16le',path.join(a,'narration.wav')]);
await run(ffmpeg,['-y','-v','error','-i',path.join(a,'narration.wav'),'-i',path.join(a,'original-score.wav'),'-i',path.join(a,'sound-effects.wav'),'-filter_complex','[0:a]asplit=2[v][side];[1:a]loudnorm=I=-23:TP=-4:LRA=9[m];[m][side]sidechaincompress=threshold=0.018:ratio=3:attack=8:release=250[duck];[v][duck][2:a]amix=inputs=3:normalize=0,alimiter=limit=0.94,loudnorm=I=-18:TP=-1.5:LRA=7[mix]','-map','[mix]','-t','90','-ar','48000','-c:a','pcm_s16le',path.join(a,'soundtrack.wav')]);
await json('public/assets/captions.json',{durationSeconds:90,cues});await json('src/scenes.json',scenes);
const time=t=>{const ms=Math.round(t*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
await writeFile(path.join(demo,'output/petalpop-marketing-ad.srt'),cues.map((c,i)=>`${i+1}\n${time(c.start)} --> ${time(c.end)}\n${c.text}\n`).join('\n'));
await json('output/audio-report.json',{durationSeconds:90,voice:'af_heart',engine:'Local Kokoro 82M q8 generic synthetic voice',music:'Original synthesized 120 BPM electropop; C-major motif, bass, marimba-like plucks, pads, claps, shaker, scene variations and final cadence',sampledSongs:false,duckedUnderNarration:true,segments,captionTiming:'Measured scene speech durations with sentence timing apportioned by word counts'});
console.log('Original score, narration, sound design and subtitle files complete.');
