// Scope to the existing PCO/CSU screens only. No event handlers or values changed.
const scope='data-qrpass-operational-quantity';
const style=document.createElement('style');
style.textContent='['+scope+'="input"]{border:0!important;border-radius:0!important;box-shadow:none!important;outline:none!important;background-image:none!important}['+scope+'="arrows"]{border:1px solid #cbd5e1!important;border-radius:8px!important;background:#f8fafc!important;box-shadow:none!important;overflow:hidden!important}['+scope+'="up"],['+scope+'="down"]{border:0!important;border-radius:0!important;box-shadow:none!important}['+scope+'="up"]{border-bottom:1px solid #dce3ee!important}';
document.head.appendChild(style);
function apply(){
 const role=[...document.querySelectorAll('#root span,#root a,#root p,#root div')].some(e=>e.childElementCount===0 && /^(PCO Staff|Security Personnel \(CSU\))$/.test(e.textContent.trim()) && e.getClientRects().length);
 const marked=new Set();
 if(role) for(const input of document.querySelectorAll('#root input:not([type=hidden])')){
  if(input.disabled||input.readOnly)continue;
  const label=[input.getAttribute('aria-label'),input.name,...Array.from(input.labels||[],x=>x.textContent)].filter(Boolean).join(' ');
  if(!/\bquantity\b/i.test(label))continue;
  let box=input.parentElement;
  for(let i=0;box&&i<3;i++,box=box.parentElement){
   const buttons=[...box.querySelectorAll('button')];
   const up=buttons.find(b=>/increase quantity/i.test((b.getAttribute('aria-label')||'')+' '+b.title));
   const down=buttons.find(b=>/decrease quantity/i.test((b.getAttribute('aria-label')||'')+' '+b.title));
   if(!up||!down||up.parentElement!==down.parentElement||up.parentElement===box)continue;
   for(const [el,v] of [[input,'input'],[up.parentElement,'arrows'],[up,'up'],[down,'down']]){marked.add(el);if(el.getAttribute(scope)!==v)el.setAttribute(scope,v);}
   break;
  }
 }
 for(const el of document.querySelectorAll('['+scope+']'))if(!marked.has(el))el.removeAttribute(scope);
 if(role&&marked.size&&!window.__qrpassOperationalQtyMatched){window.__qrpassOperationalQtyMatched=true;console.info('QRPass: PCO/CSU quantity controls matched and styled.');}
}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply();});}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});schedule();
