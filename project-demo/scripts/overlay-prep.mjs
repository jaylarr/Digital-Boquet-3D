import path from 'node:path';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {demo,ffmpeg,run,probe} from './common.mjs';

const output=path.join(demo,'capcut-overlay-v2');
await mkdir(path.join(output,'reference-frames'),{recursive:true});
await mkdir(path.join(output,'archive'),{recursive:true});
const old=path.join(demo,'output/petalpop-marketing-ad.mp4');
try {await readFile(path.join(output,'archive/petalpop-v1.mp4'));}
catch {await copyFile(old,path.join(output,'archive/petalpop-v1.mp4'));}
const scenes=JSON.parse(await readFile(path.join(demo,'src/scenes.json'),'utf8'));
const timing=JSON.parse(await readFile(path.join(demo,'src/footage-timing.json'),'utf8'));
const briefs={
 '01':['A gift with a reason','Birthday reminder transforms into a bouquet reveal. Use a short petal trail; keep the photo and note uncovered.'],
 '02':['Start with a preset','Short leader and tap pulse on the selected Sweetheart preset, then clear the graphic.'],
 '03':['Flowers and quantity','Track the actual selected flower and plus button. Roll the quantity only on observed taps; no decorative catalog covering the real catalog.'],
 '04':['Greenery and depth','A drawn depth bracket connects lower front and higher back after the layout changes.'],
 '05':['Wrap, ribbon, color','Three distinct paper, ribbon and color accents, placed outside active tap targets.'],
 '06':['Adjust all flowers','One measurement graphic at a time: height arrow, size ring, spread bracket. Keep the slider and bouquet visible together.'],
 '07':['Adjust one flower','Call out the real selected rose, then map height, size, horizontal position and depth to separate directional graphics.'],
 '08':['Explore arrangements','A reversible curved arrow lands with Undo and reverses with Redo; no repeating instructions already visible on the button.'],
 '09':['Place a companion','An outlined placement ring and rotation arc follows the teddy. Clear them once the object settles.'],
 '10':['Write and seal a letter','An ink flourish at the letter entrance, a brief handwriting cue at editing, and a wax-seal accent after Save & seal. Never cover the native reveal.'],
 '11':['Frame a memory','A corner crop guide and portrait-to-landscape diagram, each synchronized to the real action and clear of the photo.'],
 '12':['A small celebration','Keep this to three seconds. Let the native burst carry the scene, with a single short editorial spark accent.'],
 '13':['Personalize and share','A small name-to-gift connection, then a checkmark after the copied state. Show the actual exported card as a separate item.'],
 '14':['The gift opens','Tap ripple, then withdraw. Leave the recipient view and complete native letter animation unobstructed.'],
 '15':['When to use it','Three occasion labels follow the matching bouquets, then a clear end card with a restrained animated flower mark.']
};
const moments=[];
for(const scene of scenes){
 const source=scene.id==='01'||scene.id==='15'?'hero':scene.id==='12'?'confetti':scene.id;
 const file=path.join(demo,'public/media',source+'.mp4');
 const metadata=await probe(file);
 const seconds=Number(metadata.format.duration);
 const points=[Math.min(seconds-.05,.6),Math.min(seconds-.05,seconds*.55),Math.max(0,seconds-.35)];
 for(let i=0;i<points.length;i++)await run(ffmpeg,['-y','-v','error','-i',file,'-vf',`select=gte(t\\,${points[i]}),scale=960:-2`,'-frames:v','1',path.join(output,'reference-frames',`${scene.id}-${i+1}.png`)]);
 const video=metadata.streams.find(s=>s.codec_type==='video');
 const [title,brief]=briefs[scene.id];
 moments.push({id:`PP-${scene.id}`,startFrame:scene.start*30,durationFrames:scene.seconds*30,title,brief,narration:scene.voice,source:path.relative(output,file).replaceAll('\\','/'),sourceSha256:createHash('sha256').update(await readFile(file)).digest('hex'),sourceWidth:video.width,sourceHeight:video.height,sourceDurationSeconds:seconds,nativeTiming:timing[scene.id]||null,referenceFrames:points.map((t,i)=>({sourceSeconds:t,path:`reference-frames/${scene.id}-${i+1}.png`})),status:'candidate'});
 console.log(`Prepared ${scene.id}: ${title}`);
}
const result={version:2,project:'PetalPop 3D',fps:30,durationFrames:2700,requestedCanvas:{width:1080,height:1920},sourceCut:'Existing independently captured app clips, before the rejected V1 card composition',timelineAuthority:'Frame-based cut manifest; never wall-clock capture timings',reviewStatus:'Production adaptation under user rebuild request; no new per-moment keep/drop approval recorded',discovery:{method:'Single editorial pass from the existing feature script and real footage',independentAgentPasses:0,blueprintTwoIndependentPassesImplemented:false},trackOwnership:{base:'Read only after the cut is frozen',overlay:'PP-OVERLAYS',sound:['PP-SFX-IN','PP-SFX-OUT','PP-TAP-SFX'],music:'PP-MUSIC',narration:'PP-NARRATION'},moments};
await writeFile(path.join(output,'candidate-moments.json'),JSON.stringify(result,null,2)+'\n');
console.log('Original export archived and candidate moments prepared.');
