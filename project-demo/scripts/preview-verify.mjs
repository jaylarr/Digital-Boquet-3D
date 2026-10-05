import path from 'node:path';
import {chromium} from 'playwright';
import {demo,url,browserExecutable,json} from './common.mjs';
const browser=await chromium.launch({headless:true,executablePath:browserExecutable});
const errors=[];
try{
  const p=await browser.newPage({viewport:{width:1360,height:1000}});p.on('pageerror',e=>errors.push(e.message));
  await p.goto(new URL('project-demo/output/index.html',url).href);
  await p.waitForFunction(()=>document.querySelector('video').readyState>=2,null,{timeout:40000});
  const meta=await p.locator('video').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,error:v.error?.message??null}));
  if(meta.width!==1080||meta.height!==1920||Math.abs(meta.duration-90)>.2||meta.error)throw new Error('Preview metadata check failed: '+JSON.stringify(meta));
  await p.locator('video').evaluate(v=>{v.muted=true;});
  await p.getByRole('button',{name:/Flowers & quantities/}).click();
  await p.waitForFunction(()=>document.querySelector('video').currentTime>9.3,null,{timeout:20000});
  await p.locator('video').evaluate(v=>{v.pause();v.currentTime=12.5;});
  await p.waitForFunction(()=>!document.querySelector('video').seeking);
  await p.screenshot({path:path.join(demo,'output/qa/preview-desktop.png'),fullPage:true});
  await p.setViewportSize({width:390,height:844});
  await p.getByRole('button',{name:/Photo frame/}).click();
  await p.waitForFunction(()=>document.querySelector('video').currentTime>60.2,null,{timeout:20000});
  await p.locator('video').evaluate(v=>{v.pause();v.currentTime=64;});
  await p.waitForFunction(()=>!document.querySelector('video').seeking);
  const mobile=await p.evaluate(()=>({viewport:innerWidth,content:document.documentElement.scrollWidth,videoError:document.querySelector('video').error?.message??null}));
  if(mobile.content>mobile.viewport+1||mobile.videoError||errors.length)throw new Error('Preview layout/playback failed: '+JSON.stringify({mobile,errors}));
  await p.screenshot({path:path.join(demo,'output/qa/preview-mobile.png'),fullPage:true});
  await json('output/preview-report.json',{passed:true,metadata:meta,playbackAdvanced:true,chapterSeeks:[9,60],mobile,errors});
  console.log('Browser playback, chapter seeking and mobile preview passed.');
}finally{await browser.close();}
