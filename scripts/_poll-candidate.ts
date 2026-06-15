import { chromium } from '@playwright/test';
const APP='http://localhost:3000', SHELL='.leo-app-shell', C='canvas[data-camera-position]';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:800}});
  await p.goto(APP,{waitUntil:'domcontentloaded'}); await p.waitForSelector(SHELL,{timeout:30000});
  await p.waitForSelector(C,{timeout:30000});
  await p.waitForFunction(()=>Number(document.querySelector('canvas[data-camera-position]')?.getAttribute('data-rendered-ue-count')??'0')>0,undefined,{timeout:90000});
  // fast forward
  const fast=p.locator('[data-testid="timeline-speed-20x"]').first(); if(await fast.count()) await fast.click();
  let maxC=0, hits=0, samples=0; const toasts:Record<string,number>={};
  for(let i=0;i<70;i++){
    const d=await p.$eval(C,el=>({c:(el as HTMLElement).dataset.sinrLiveCellPendingCandidateConeRenderedCount, tk:(el as HTMLElement).dataset.handoverToastKind})).catch(()=>({c:undefined,tk:undefined}));
    const c=Number(d.c??'0'); samples++; if(c>0){hits++; if(c>maxC)maxC=c;}
    if(d.tk) toasts[d.tk]=(toasts[d.tk]||0)+1;
    await sleep(450);
  }
  console.log(JSON.stringify({samples,candidateHits:hits,maxCandidate:maxC,toastKinds:toasts}));
  await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
