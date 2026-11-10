import {pipeline,env} from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
env.allowLocalModels=false;
let t=null;
self.onmessage=async({data:{id,type,text,src,tgt}})=>{
  try{
    if(!t)t=await pipeline('translation','Xenova/nllb-200-distilled-600M',{progress_callback:p=>self.postMessage({type:'progress',p})});
    if(type==='load'){self.postMessage({id,type:'ready'});return}
    const o=await t(text,{src_lang:src,tgt_lang:tgt});
    self.postMessage({id,type:'done',text:o[0].translation_text});
  }catch(err){t=null;self.postMessage({id,type:'error',error:String(err&&err.message||err)})}
};
