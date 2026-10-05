import http from 'node:http';
import path from 'node:path';
import {stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {demo} from './common.mjs';
const root=path.join(demo,'capcut-overlay-v2');
const mime={'.html':'text/html; charset=utf-8','.mp4':'video/mp4','.png':'image/png','.json':'application/json','.md':'text/plain; charset=utf-8','.srt':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8'};
http.createServer(async(req,res)=>{try{
 const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,route==='/'?'index.html':route.slice(1));
 if(!file.toLowerCase().startsWith(root.toLowerCase()+path.sep))throw Error('Path outside preview');
 const info=await stat(file);if(!info.isFile())throw Error('Not a file');
 let start=0,end=info.size-1;const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
 if(range){start=Number(range[1]);if(range[2])end=Math.min(end,Number(range[2]));}
 if(start>end||end>=info.size){res.writeHead(416);res.end();return;}
 const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Content-Length':end-start+1,'Cache-Control':'no-store'};
 if(range)headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
 res.writeHead(range?206:200,headers);if(req.method==='HEAD'){res.end();return;}
 const stream=createReadStream(file,{start,end});
 res.on('close',()=>stream.destroy());stream.pipe(res);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(5208,'127.0.0.1',()=>console.log('PetalPop V2 preview: http://127.0.0.1:5208/'));
