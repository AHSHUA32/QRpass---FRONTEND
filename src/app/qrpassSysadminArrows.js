// QRPASS_SYSADMIN_SMOOTH_ARROWS_V2
const selector='[data-qrpass-role="sysadmin"] select:not([multiple],[aria-hidden="true"]):is(:not([size]),[size="0"],[size="1"])';
const arrows=new Map();
let frame=0;
function remove(el,a){a.node.remove();el.removeAttribute('data-qrpass-arrow-v2');if(a.old)el.style.setProperty('background-image',a.old,a.priority);else el.style.removeProperty('background-image');arrows.delete(el);}
function update(){frame=0;const active=new Set(document.querySelectorAll(selector));
for(const [el,a] of arrows)if(!active.has(el))remove(el,a);
for(const el of active){let a=arrows.get(el);if(!a){const node=document.createElement('span');node.className='qrpass-sysadmin-arrow-v2';node.setAttribute('aria-hidden','true');node.innerHTML='<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';a={node,old:el.style.getPropertyValue('background-image'),priority:el.style.getPropertyPriority('background-image')};arrows.set(el,a);document.body.appendChild(node);el.setAttribute('data-qrpass-arrow-v2','true');}
if(el.style.getPropertyValue('background-image')!=='none'||el.style.getPropertyPriority('background-image')!=='important')el.style.setProperty('background-image','none','important');
const r=el.getBoundingClientRect(),x=r.right-19,y=r.top+r.height/2;const hit=document.elementFromPoint(x,y);const visible=r.width>0&&r.height>0&&hit&&(hit===el||el.contains(hit));a.node.style.visibility=visible?'visible':'hidden';a.node.style.left=(x-8)+'px';a.node.style.top=(y-8)+'px';a.node.dataset.open=String(el.getAttribute('aria-expanded')==='true');a.node.style.opacity=el.disabled?'.55':'1';}}
function schedule(){if(!frame)frame=requestAnimationFrame(update);}
const observer=new MutationObserver(rs=>{if(rs.some(r=>!(r.target instanceof Element&&r.target.closest('.qrpass-sysadmin-arrow-v2'))&&!(r.type==='childList'&&[...r.addedNodes,...r.removedNodes].every(n=>n instanceof Element&&n.matches('.qrpass-sysadmin-arrow-v2')))))schedule();});
function start(){observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-expanded','data-state','class','style','hidden','disabled','data-qrpass-role']});schedule();}
const events=['resize','scroll','pointerdown','focusin','focusout','change','keydown'];for(const e of events)window.addEventListener(e,schedule,true);
if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
if(import.meta.hot)import.meta.hot.dispose(()=>{observer.disconnect();cancelAnimationFrame(frame);for(const e of events)window.removeEventListener(e,schedule,true);for(const [el,a] of arrows)remove(el,a);});
