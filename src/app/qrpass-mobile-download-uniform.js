/* QRPASS_MOBILE_DOWNLOAD_UNIFORM_V1 */
const attr='data-qrpass-mobile-download-uniform';
const wrap='data-qrpass-mobile-download-wrap';
const media=window.matchMedia('(max-width: 767px)');
const style=document.createElement('style');
style.textContent="@media (max-width:767px){\n[data-qrpass-mobile-download-wrap]{width:100%!important;max-width:100%!important;min-width:0!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:8px!important;box-sizing:border-box!important;}\n[data-qrpass-mobile-download-uniform]{box-sizing:border-box!important;width:100%!important;max-width:100%!important;min-width:0!important;flex:0 0 auto!important;height:48px!important;min-height:48px!important;max-height:48px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;padding:0 10px!important;margin:0!important;border-radius:12px!important;white-space:nowrap!important;font-size:14px!important;}\n[data-qrpass-mobile-download-uniform] svg{flex-shrink:0!important;width:16px!important;height:16px!important;}\n}";
document.head.appendChild(style);
const label=b=>(b.textContent||'').replace(/\s+/g,' ').trim();
const match=b=>/^(?:download|export)\s+(?:pdf|excel|xlsx|csv|(?:selected\s+)?(?:records|reports)(?:\s+as\s+(?:pdf|excel|csv))?)$/i.test(label(b));
let frame=0;
function apply(){
 const targets=new Set();const wrappers=new Set();
 if(media.matches){
  for(const b of document.querySelectorAll('button,a[download],a[role="button"]')){
   if(!match(b)||!b.getClientRects().length)continue;
   targets.add(b);
   let p=b.parentElement;
   // Only stretch wrappers exclusively containing download controls (or nested wrappers of them).
   for(let i=0;p&&i<4;i++,p=p.parentElement){
    if(p.matches('main,section,body,html,[role="dialog"]'))break;
    const controls=[...p.querySelectorAll('button,a,input,select,textarea')];
    if(!controls.length||controls.some(c=>!match(c)))break;
    const text=(p.textContent||'').replace(/\s+/g,' ').trim();
    const combined=controls.map(label).join(' ').replace(/\s+/g,' ').trim();
    if(text.replace(/\s/g,'')!==combined.replace(/\s/g,''))break;
    wrappers.add(p);
   }
  }
 }
 for(const el of document.querySelectorAll('['+attr+']'))if(!targets.has(el))el.removeAttribute(attr);
 for(const el of document.querySelectorAll('['+wrap+']'))if(!wrappers.has(el))el.removeAttribute(wrap);
 for(const el of targets)el.setAttribute(attr,'');
 for(const el of wrappers)el.setAttribute(wrap,'');
}
function schedule(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;apply();});}
const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true,characterData:true});
media.addEventListener('change',schedule);window.addEventListener('resize',schedule);schedule();
if(import.meta.hot)import.meta.hot.dispose(()=>{observer.disconnect();cancelAnimationFrame(frame);media.removeEventListener('change',schedule);window.removeEventListener('resize',schedule);style.remove();document.querySelectorAll('['+attr+'],['+wrap+']').forEach(el=>{el.removeAttribute(attr);el.removeAttribute(wrap);});});
