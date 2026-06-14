import { chromium } from '@playwright/test';
const URL = process.env.APP_URL ?? 'http://localhost:4173';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1680,height:1050} });
const errs:string[]=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
const t0=Date.now();
await p.goto(URL,{waitUntil:'domcontentloaded'});
const samples:{t:number;shell:boolean;canvas:boolean;ue:number;loading:string|null;loaded:string|null;target:string|null}[]=[];
for(let i=0;i<60;i++){
  const s=await p.evaluate(()=>{
    const shell=!!document.querySelector('.leo-app-shell');
    const cv=document.querySelector('canvas[data-camera-position]');
    const agg=document.querySelector('[data-testid="sinr-serving-aggregate"]');
    return {
      shell,
      canvas:!!cv,
      ue:Number(cv?.getAttribute('data-rendered-ue-count')??'0'),
      loading:agg?.getAttribute('data-loading')??null,
      loaded:agg?.getAttribute('data-load-loaded')??null,
      target:agg?.getAttribute('data-load-target')??null,
    };
  }).catch(()=>({shell:false,canvas:false,ue:0,loading:null,loaded:null,target:null}));
  samples.push({t:Date.now()-t0,...s});
  if(s.ue>=100) { /* keep a couple more samples then stop */ if(samples.filter(x=>x.ue>=100).length>=2) break; }
  await new Promise(r=>setTimeout(r,250));
}
// print compact: only rows where something changed
let prev='';
for(const s of samples){
  const key=`${s.shell}|${s.canvas}|${s.ue}|${s.loading}|${s.loaded}/${s.target}`;
  if(key!==prev){ console.log(`${String(s.t).padStart(6)}ms shell=${s.shell?1:0} canvas=${s.canvas?1:0} ue=${String(s.ue).padStart(3)} loading=${s.loading} loaded=${s.loaded}/${s.target}`); prev=key; }
}
console.log('pageErrors:',JSON.stringify(errs.slice(0,3)));
await b.close();
