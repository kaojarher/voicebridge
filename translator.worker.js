import {pipeline,env} from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
env.allowLocalModels=false;
const post=m=>self.postMessage(m),prog=p=>post({type:'progress',p});

/* ---- 完整模式：NLLB-200（記憶體需求高） ---- */
let nllb=null;

/* ---- 輕量模式：Opus-MT 雙語小模型，以英文中轉 ---- */
const PAIRS={'zh>en':'Xenova/opus-mt-zh-en','en>zh':'Xenova/opus-mt-en-zh','ja>en':'Xenova/opus-mt-jap-en','en>ja':'Xenova/opus-mt-en-jap',
 'ko>en':'Xenova/opus-mt-ko-en','de>en':'Xenova/opus-mt-de-en','en>de':'Xenova/opus-mt-en-de','es>en':'Xenova/opus-mt-es-en','en>es':'Xenova/opus-mt-en-es',
 'fr>en':'Xenova/opus-mt-fr-en','en>fr':'Xenova/opus-mt-en-fr','ru>en':'Xenova/opus-mt-ru-en','en>ru':'Xenova/opus-mt-en-ru'};
const mt=new Map(),conv={};
const route=(s,t)=>s===t?[]:s==='en'?['en>'+t]:t==='en'?[s+'>en']:[s+'>en','en>'+t];
async function getMt(k){
  if(!PAIRS[k])throw new Error('輕量模式沒有「'+k.replace('>',' → ')+'」的模型，請改用線上引擎或完整離線模型');
  if(mt.has(k)){const m=mt.get(k);mt.delete(k);mt.set(k,m);return m}
  while(mt.size>=4)mt.delete(mt.keys().next().value);
  try{const p=await pipeline('translation',PAIRS[k],{progress_callback:prog});mt.set(k,p);return p}
  catch(e){throw new Error('載入 '+PAIRS[k]+' 失敗：'+(e&&e.message||e))}
}
async function oc(from,to){
  const key=from+to;
  if(!conv[key]){const m=await import('https://cdn.jsdelivr.net/npm/opencc-js@1.0.5/dist/esm/full.js');const O=m.default||m;conv[key]=O.Converter({from,to})}
  return conv[key];
}
async function light({text,src,tgt,srcTw,tgtTw}){
  let s=text;
  if(src==='zh'&&srcTw)s=(await oc('tw','cn'))(s);
  for(const k of route(src,tgt)){
    const p=await getMt(k);
    const o=await p(k==='en>zh'?'>>cmn_Hans<< '+s:s,{max_new_tokens:200});
    s=o[0].translation_text;
  }
  if(tgt==='zh'&&tgtTw)s=(await oc('cn','twp'))(s);
  return s;
}

self.onmessage=async({data:d})=>{
  const {id,type}=d;
  try{
    if(type==='tr2'){post({id,type:'done',text:await light(d)});return}
    if(type==='prep'){for(const j of d.jobs)for(const k of route(j.src,j.tgt))await getMt(k);post({id,type:'ready'});return}
    if(!nllb)nllb=await pipeline('translation','Xenova/nllb-200-distilled-600M',{progress_callback:prog});
    if(type==='load'){post({id,type:'ready'});return}
    const o=await nllb(d.text,{src_lang:d.src,tgt_lang:d.tgt,max_new_tokens:200});
    post({id,type:'done',text:o[0].translation_text});
  }catch(err){nllb=null;post({id,type:'error',error:String(err&&err.message||err)})}
};
