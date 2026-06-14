import { loadProfile } from '../src/profiles/index';
import { buildSinrLiveCellHandoverEventIndex } from '../src/scene/sinrLiveCellHandoverEventIndex';
const profile = loadProfile('hobs-2024-candidate-rich');
const idx = buildSinrLiveCellHandoverEventIndex({
  profile, epochUtcMs: Date.UTC(2026,0,1), simStepSec: 2, ueCount: 100,
});
const evs = (idx as any).events ?? [];
const times = evs.map((e:any)=>e.sourceTimeSec).sort((a:number,b:number)=>a-b);
const total = evs.length;
const inter = evs.filter((e:any)=>e.kind==='inter').length;
const intra = evs.filter((e:any)=>e.kind==='intra').length;
const first180 = times.filter((t:number)=>t<=180).length;
const window = times.length ? times[times.length-1] : 0;
// max gap in [0,300]
const early = times.filter((t:number)=>t<=300);
let maxGap=0,prev=0;
for(const t of early){maxGap=Math.max(maxGap,t-prev);prev=t;}
console.log(`total=${total} inter=${inter} intra=${intra} window=${window}s`);
console.log(`first180s_events=${first180}`);
console.log(`first8_event_times=${times.slice(0,8).map((t:number)=>t.toFixed(0)).join(',')}`);
console.log(`maxGap_in_first300s=${maxGap.toFixed(1)}s`);
