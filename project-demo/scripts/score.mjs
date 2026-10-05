// Original composition and sound design, synthesized without recordings or samples.
export function score(seconds,sr){
const music=new Float32Array(Math.round(seconds*sr)),sfx=new Float32Array(music.length);let seed=34191;
const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
const hz=n=>440*2**((n-69)/12);const tau=Math.PI*2;
const add=(buf,start,duration,fn)=>{const at=Math.round(start*sr),length=Math.min(Math.round(duration*sr),buf.length-at);for(let i=0;i<length;i++)if(at+i>=0)buf[at+i]+=fn(i/sr,i);};
const pluck=(midi,gain=.043)=>t=>gain*Math.min(1,t*200)*Math.exp(-t*5.2)*(Math.sin(tau*hz(midi)*t)+.27*Math.sin(tau*hz(midi)*2*t)*Math.exp(-t*9)+.12*Math.sin(tau*hz(midi)*3*t)*Math.exp(-t*12));
const chords=[[48,52,55,59],[45,48,52,55],[41,45,48,52],[43,47,50,55]];
const bridge=t=>t>=51&&t<69;const energy=t=>t<5?.45:bridge(t)?.56:t>=84?1.15:1;
// Four-note signature: C E G A; then melodic response and octave variation.
const phrases=[[72,76,79,81,79,76,74,76],[76,79,84,83,81,79,76,72],[72,77,81,84,81,79,77,76],[74,79,83,86,84,83,79,76]];
for(let beat=0;beat*.5<seconds;beat++){
const t=beat*.5,bar=Math.floor(beat/4),chord=chords[Math.floor(bar/2)%4],e=energy(t);
if(t>=5&&!bridge(t))add(music,t,.27,u=>.15*e*Math.exp(-u*19)*Math.sin(tau*(52*u+100*(1-Math.exp(-u*36))/36)));
if(t>=5&&beat%2===1){for(const shift of [0,.011,.025])add(music,t+shift,.15,u=>.023*(bridge(t)?.2:1)*Math.exp(-u*31)*noise());}
if(t>=9)for(const shift of [0,.25])add(music,t+shift,.045,u=>.009*(bridge(t)?.3:1)*Math.exp(-u*110)*(noise()-.4*Math.sin(tau*6400*u)));
if(t>=5){const bass=chord[0]-(beat%4===3?0:12);for(const shift of [0,beat%4===2?.375:.25])add(music,t+shift,.23,u=>.088*e*Math.min(1,u*200)*Math.exp(-u*10)*(Math.sin(tau*hz(bass)*u)+.21*Math.sin(tau*hz(bass)*2*u)));}
const phrase=phrases[Math.floor(bar/4)%4],note=phrase[beat%8];const skip=beat%8===5||beat%8===7;
if(!skip){const gain=(bridge(t)?.024:.04)*e;add(music,t,.85,pluck(note,gain));add(music,t+.25,.65,pluck(note,gain*.18));}
if(t>=16&&t<51||t>=69&&t<84){const n=chord[(beat+1)%4]+24;add(music,t+.25,.38,pluck(n,.013));}
if(beat%16===15&&!bridge(t))for(let k=0;k<4;k++)add(music,t+k*.1,.07,u=>.015*Math.exp(-u*50)*noise());
}
// Slowly breathing pad, changing every four seconds, with gentle stereo-like detuning in mono.
for(let bar=0;bar*2<seconds;bar++){const t=bar*2,chord=chords[Math.floor(bar/2)%4];for(const midi of chord)add(music,t,2.3,u=>.0075*Math.min(1,u/.3)*Math.min(1,(2.3-u)/.5)*(Math.sin(tau*hz(midi)*u)+.32*Math.sin(tau*(hz(midi)+.35)*u)));}
const whoosh=t=>add(sfx,t,.42,u=>.026*Math.sin(Math.PI*u/.42)**2*(Math.sin(tau*(380*u+1100*u*u))*.6+noise()*.16));
[5,9,16,21,27,33,41,45,51,60,69,72,79,84,87].forEach(whoosh);
[10.5,11.5,12.5,17.5,19,22,24,25.5,46,47,53,58,62,66,74,76].forEach(t=>add(sfx,t,.085,u=>.023*Math.exp(-u*65)*Math.sin(tau*950*u)));
// Tap notes become part of the signature, rather than unrelated click noises.
[[11.5,72],[12.5,76],[13.5,79],[69,84],[69.125,88],[69.25,91],[76,76],[76.16,79],[87,72],[87.2,76],[87.4,79]].forEach(([t,n])=>add(sfx,t,.7,pluck(n,.05)));
add(sfx,69,.18,u=>.09*Math.exp(-u*27)*(noise()*.25+Math.sin(tau*100*u)));
// Paper / ink accents for the envelope and note.
for(const t of [51.8,53,58.2,80.8])add(sfx,t,.45,u=>.013*Math.sin(Math.PI*u/.45)**2*noise());
// Resolve the final chord with a natural tail.
[60,64,67,72].forEach(n=>add(music,87,3,u=>.019*Math.min(1,u*70)*Math.exp(-u*.75)*Math.sin(tau*hz(n)*u)));
for(let i=0;i<music.length;i++){const t=i/sr;music[i]*=Math.min(1,t/.16,(seconds-t)/1.05);sfx[i]*=Math.min(1,(seconds-t)/.6);}
return {music,sfx};}
