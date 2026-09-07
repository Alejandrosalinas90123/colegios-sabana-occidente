const SchoolEngine = (() => {
  const diurnal = new Set(['MAÑANA','TARDE','COMPLETA','ÚNICA']);
  function normalize(weights) {
    if(weights.length!==5 || weights.some(w=>!Number.isFinite(w)||w<0)) return null;
    const total=weights.reduce((a,b)=>a+b,0);
    return total>0?weights.map(w=>w/total):null;
  }
  const dot=(v,w)=>v.reduce((s,x,i)=>s+x*w[i],0);
  function rank(list,key) {
    const ordered=[...list].sort((a,b)=>b[key]-a[key]||a.name.localeCompare(b.name,'es')||a.id-b.id);
    let rank=0,previous=null;
    return ordered.map((r,i)=>{
      if(previous===null || Math.abs(r[key]-previous)>1e-9) rank=i+1;
      previous=r[key]; return {...r,rank};
    });
  }
  function calculate(data,state,weights,reference=[20,20,20,20,20]) {
    const w=normalize(weights),rw=normalize(reference);
    if(!w||!rw) return {rows:[],error:'Asigna un peso mayor que cero a una materia.'};
    const years=[...state.years].sort(),yearSet=new Set(years),townSet=new Set(state.places ?? state.towns);
    if(!years.length||!townSet.size) return {rows:[],error:'Selecciona al menos un municipio y un año.'};
    const schools=new Map(data.schools.map(s=>[s.id,s]));
    const groups=new Map(); let sourceCount=0;
    for(const r of data.records) {
      if(!townSet.has(state.places ? schools.get(r.id).place : schools.get(r.id).town)||!yearSet.has(r.year)) continue;
      if(state.nature!=='all' && r.nature!==state.nature) continue;
      if(state.session==='diurnal' && !diurnal.has(r.session)) continue;
      if(!['all','diurnal'].includes(state.session) && r.session!==state.session) continue;
      const key=r.id+'|'+r.year;
      if(!groups.has(key)) groups.set(key,{id:r.id,year:r.year,n:0,sums:[0,0,0,0,0],sourceRows:[],sessions:new Set(),natures:new Set()});
      const g=groups.get(key);g.n+=r.n;g.sourceRows.push(r.sourceRow);g.sessions.add(r.session);g.natures.add(r.nature);
      r.scores.forEach((v,i)=>g.sums[i]+=v*r.n);sourceCount++;
    }
    const annual=new Map();
    for(const g of groups.values()) {
      if(g.n<=0) continue;
      if(!annual.has(g.id)) annual.set(g.id,{});
      const scores=g.sums.map(s=>s/g.n);
      annual.get(g.id)[g.year]={year:g.year,n:g.n,scores,score:dot(scores,w),total:scores.reduce((a,b)=>a+b,0),sourceRows:g.sourceRows,sessions:[...g.sessions],natures:[...g.natures]};
    }
    const rows=[];
    for(const [id,byYear] of annual) {
      const entries=Object.values(byYear),coverage=entries.length;
      if(state.complete && coverage!==years.length) continue;
      const minStudents=Math.min(...entries.map(r=>r.n));
      if(minStudents<state.minStudents) continue;
      const students=entries.reduce((s,r)=>s+r.n,0);
      const denominator=state.aggregation==='students'?students:coverage;
      const scores=[0,1,2,3,4].map(j=>entries.reduce((s,r)=>s+r.scores[j]*(state.aggregation==='students'?r.n:1),0)/denominator);
      const change=years.length>1 && byYear[years[0]] && byYear[years.at(-1)]?byYear[years.at(-1)].score-byYear[years[0]].score:null;
      rows.push({...schools.get(id),byYear,coverage,students,minStudents,scores,score:dot(scores,w),referenceScore:dot(scores,rw),total:scores.reduce((a,b)=>a+b,0),change});
    }
    const ref=new Map(rank(rows,'referenceScore').map(r=>[r.id,r.rank]));
    return {rows:rank(rows,'score').map(r=>({...r,referenceRank:ref.get(r.id),rankChange:ref.get(r.id)-r.rank})),years,weights:w,sourceCount,error:null};
  }
  return {calculate,normalize,dot};
})();
if(typeof module!=='undefined') module.exports=SchoolEngine;
