import { chromium } from '@playwright/test';
const URL = process.env.APP_URL ?? 'http://localhost:4173';
const TARGET = Number(process.env.UE_TARGET ?? '100');
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1680,height:1050} });
const errs:string[]=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
const t0=Date.now();
await p.goto(URL,{waitUntil:'domcontentloaded'});
await p.waitForSelector('.leo-app-shell',{timeout:30000});
await p.waitForSelector('canvas[data-camera-position]',{timeout:40000});
const ueCount=()=>Number(document.querySelector('canvas[data-camera-position]')?.getAttribute('data-rendered-ue-count')??'0');
// L3 first-paint metric: scene usable with the FIRST UE on screen (terrain + sats
// + primary UE). With progressive UE this fires ≈ app-shell time (count ramps from 1).
await p.waitForFunction(ueCount,undefined,{timeout:60000});
const firstPaintMs=Date.now()-t0;
// L3 full-population metric: every UE present (rendered===TARGET). The UE-count-
// scaling SINR warm lands here, now OFF the first-paint critical path.
let fullPopMs=-1;
try{ await p.waitForFunction((t)=>Number(document.querySelector('canvas[data-camera-position]')?.getAttribute('data-rendered-ue-count')??'0')>=t,TARGET,{timeout:60000}); fullPopMs=Date.now()-t0; }catch{}
// index populated? director inter/intra enabled flips when the deferred index lands
let idxMs=-1;
try{ await p.waitForFunction(()=>{const d=document.querySelector('[data-testid="director-controls"]');return d?.getAttribute('data-director-inter-enabled')==='1'||d?.getAttribute('data-director-intra-enabled')==='1';},undefined,{timeout:40000}); idxMs=Date.now()-t0; }catch{}
const ue=await p.$eval('canvas[data-camera-position]',el=>(el as HTMLElement).dataset.renderedUeCount);
await p.screenshot({path:'output/cinematic/prod-after-render.png'});
console.log(JSON.stringify({firstPaintMs,fullPopMs,renderedUe:ue,indexPopulatedMs:idxMs,pageErrors:errs.slice(0,3)}));
await b.close();
