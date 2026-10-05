import path from 'node:path';
import {readFile,unlink} from 'node:fs/promises';
import {demo,ffmpeg,run} from './common.mjs';

// A codec's alpha-capable pixel format does not prove that pixels are transparent.
export async function verifyAlpha(file,seconds,id){
 const sample=path.join(demo,'.cache',`alpha-${id}.bin`);
 await run(ffmpeg,['-y','-v','error','-ss',String(seconds),'-i',file,'-vf','alphaextract,format=gray','-frames:v','1','-f','rawvideo',sample]);
 const bytes=await readFile(sample);let min=255,max=0,clear=0;
 for(const value of bytes){min=Math.min(min,value);max=Math.max(max,value);if(value===0)clear++;}
 await unlink(sample);
 const result={id,min,max,transparentFraction:clear/bytes.length,sampledAtSeconds:seconds};
 if(min!==0||max!==255||result.transparentFraction<.5)throw new Error('Overlay lacks expected transparent pixels: '+JSON.stringify(result));
 return result;
}

if(process.argv.includes('--sample')){
 const file=path.resolve(process.argv[process.argv.indexOf('--sample')+1]);
 console.log(JSON.stringify(await verifyAlpha(file,2,'spot-check')));
}
