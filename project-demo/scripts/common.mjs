import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
export const demo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const root=path.dirname(demo);
export const previous='C:/Users/user/Desktop/PROGRAMMING/DevDock/project-demo';
export const ffmpeg='C:/Users/user/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
export const ffprobe=path.join(path.dirname(ffmpeg),'ffprobe.exe');
export const browserExecutable='C:/Users/user/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
export const url='http://127.0.0.1:5206/';
export const delay=ms=>new Promise(r=>setTimeout(r,ms));
export async function folders(){for(const p of ['public/media','public/assets','recordings/raw','output/qa','.cache','src'])await mkdir(path.join(demo,p),{recursive:true});}
export async function run(exe,args,options={}){return new Promise((resolve,reject)=>{const p=spawn(exe,args,{cwd:demo,windowsHide:true,...options});let stdout='',stderr='';p.stdout?.on('data',d=>stdout+=d);p.stderr?.on('data',d=>stderr+=d);p.on('error',reject);p.on('exit',c=>c===0?resolve({stdout,stderr}):reject(new Error(`${path.basename(exe)} exited ${c}: ${stderr.slice(-3500)}`)));});}
export async function probe(file){return JSON.parse((await run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',file])).stdout);}
export async function sourceFence(file){const out=path.join(demo,'.cache',path.basename(file)+'-fence-rgb.bin');await run(ffmpeg,['-y','-v','error','-i',file,'-vf','fps=30,crop=2:2:2:2,scale=1:1,format=rgb24','-f','rawvideo',out]);const b=await readFile(out);let armed=false,start=-1,end=-1;for(let i=0;i<b.length/3;i++){const r=b[i*3],g=b[i*3+1],blue=b[i*3+2];if(r<40&&g<40&&blue<40)armed=true;if(armed&&start<0&&r>220&&g>220&&blue>220)start=i;if(start>=0&&i>start&&r-g>25&&r-blue>12){end=i;break;}}if(start<0)throw new Error('Missing recorded start marker');const endMarkerDetected=end>start;if(!endMarkerDetected)end=Math.floor(b.length/3)-1;return {start:start/30,end:end/30,endMarkerDetected};}
export async function json(file,data){await writeFile(path.join(demo,file),JSON.stringify(data,null,2)+'\n');}
export async function storyboard(){const text=await readFile(path.join(root,'docs/marketing-ad-script.md'),'utf8');const table=text.split('## Timed shooting script')[1].split('## Motion and sound direction')[0];return [...table.matchAll(/^\| \*\*(\d{2}:\d{2})–(\d{2}:\d{2})\*\* \| (.*?) \| “(.*?)” \| (.*?) \|$/gm)].map((m,i)=>{const seconds=t=>Number(t.slice(0,2))*60+Number(t.slice(3));return {id:String(i+1).padStart(2,'0'),start:seconds(m[1]),end:seconds(m[2]),seconds:seconds(m[2])-seconds(m[1]),action:m[3],voice:m[4],copy:m[5]};});}
