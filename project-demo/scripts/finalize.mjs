import path from 'node:path';
import {copyFile,rename,readFile} from 'node:fs/promises';
import {demo,ffmpeg,probe,run,json} from './common.mjs';
const output=path.join(demo,'output/petalpop-marketing-ad.mp4'),meta=await probe(output),video=meta.streams.find(s=>s.codec_type==='video');
if(video.pix_fmt==='yuv420p'&&video.color_range!=='pc'){console.log('Delivery color range is already compatible.');process.exit(0);}
const master=path.join(demo,'.cache/full-range-master.mp4'),normalized=path.join(demo,'.cache/petalpop-normalized.mp4');
await copyFile(output,master);
await run(ffmpeg,['-y','-v','error','-i',master,'-map','0:v:0','-map','0:a:0','-vf','scale=in_range=full:out_range=tv','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-color_range','tv','-c:a','copy','-movflags','+faststart',normalized]);
await rename(normalized,output);
const report=JSON.parse(await readFile(path.join(demo,'output/render-report.json'),'utf8'));report.deliveryPixelFormat='yuv420p';report.colorRange='limited / TV';report.normalizedFrom=video.pix_fmt;report.webOptimized=true;await json('output/render-report.json',report);
console.log('Final delivery color range normalized; fast-start MP4 ready.');
