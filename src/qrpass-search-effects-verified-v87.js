/* QRPASS_SEARCH_EFFECTS_VERIFIED_V87
 * The single controller for search input hover, focus and typing states.
 * Does not modify React values, key events, focus navigation or search logic.
 * The v86 script is NOT imported alongside this script.
 */
(() => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (window.__qrpassSearchV87?.loaded) return;
  const SELECTOR = 'input[type="search"],input[aria-label*="search" i],input[placeholder*="search" i]';
  const tracked = new WeakMap();
  const disabledTypes = new Set(['hidden','checkbox','radio','file','password','number']);
  const isSearch = el => el instanceof HTMLInputElement &&
    !disabledTypes.has(el.type) && el.matches(SELECTOR);
  const isDark = () => document.documentElement.classList.contains('dark') ||
    document.body?.classList.contains('dark');
  function propsFor(el,hovered) {
    const focused = document.activeElement === el;
    const state = focused ? 'focus' : hovered ? 'hover' : 'idle';
    if (isDark()) return {
      state, bg:state==='hover'?'#25456e':'#19345f',
      border:state==='focus'?'#83a6ed':state==='hover'?'#7291bd':'#526c92',
      shadow:state==='focus'?'0 0 0 3px rgba(131,166,237,.18)':'none',
      ink:'#eef4ff'
    };
    return {
      state, bg:state==='hover'?'#eef2ff':'#ffffff',
      border:state==='focus'?'#5278e7':state==='hover'?'#a8bde4':'#cbd5e1',
      shadow:state==='focus'?'0 0 0 3px rgba(82,120,231,.17)':'none',
      ink:'#17336d'
    };
  }
  function put(el,key,val) {
    if(el.style.getPropertyValue(key)!==val||el.style.getPropertyPriority(key)!=='important') {
      el.style.setProperty(key,val,'important');
    }
  }
  function paint(el) {
    if(!isSearch(el)||!el.isConnected) return;
    const meta=tracked.get(el);
    if(!meta) return;
    // :hover is browser truth; pointerenter/leave handles quick transitions.
    const hovered=el.matches(':hover') || meta.hovered;
    const p=propsFor(el,hovered);
    if(el.getAttribute('data-qrpass-search-v87')!==p.state)
      el.setAttribute('data-qrpass-search-v87',p.state);
    put(el,'background',p.bg);
    put(el,'background-color',p.bg);
    put(el,'border-color',p.border);
    put(el,'box-shadow',p.shadow);
    put(el,'outline','none');
    put(el,'color',p.ink);
    put(el,'transition',window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'none' : 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease');
  }
  function settle(el) {
    paint(el);
    requestAnimationFrame(()=>{
      paint(el);
      // Catch other React/global mouse listeners executed after the event.
      requestAnimationFrame(()=>paint(el));
    });
  }
  function attach(el) {
    if(!isSearch(el)||tracked.has(el)) return;
    const meta={hovered:el.matches(':hover')};
    tracked.set(el,meta);
    for(const ev of ['pointerenter','mouseenter']) el.addEventListener(ev,()=>{meta.hovered=true;settle(el);});
    for(const ev of ['pointerleave','mouseleave']) el.addEventListener(ev,()=>{meta.hovered=false;settle(el);});
    for(const ev of ['pointerdown','click','focus','blur','focusin','focusout','input','keyup'])
      el.addEventListener(ev,()=>settle(el));
    // A legacy component may write inline white/blue backgrounds asynchronously.
    // Observe only style, not our own state attribute, and correct on change.
    new MutationObserver(()=>paint(el)).observe(el,{attributes:true,attributeFilter:['style']});
    paint(el);
  }
  function scan() {document.querySelectorAll(SELECTOR).forEach(attach);}
  let pending=false;
  function queue() {if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;scan();});}
  function boot() {
    scan();
    new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});
    new MutationObserver(()=>document.querySelectorAll(SELECTOR).forEach(paint))
      .observe(document.documentElement,{attributes:true,attributeFilter:['class']});
    // Also account for the dark class sometimes being toggled on <body>.
    new MutationObserver(()=>document.querySelectorAll(SELECTOR).forEach(paint))
      .observe(document.body,{attributes:true,attributeFilter:['class']});
    document.addEventListener('visibilitychange',()=>document.querySelectorAll(SELECTOR).forEach(paint));
    window.addEventListener('focus',()=>document.querySelectorAll(SELECTOR).forEach(paint));
    window.__qrpassSearchV87={loaded:true, count:()=>document.querySelectorAll('[data-qrpass-search-v87]').length,
      inspect:()=>[...document.querySelectorAll('[data-qrpass-search-v87]')].map(el=>({
        label:el.getAttribute('aria-label')||el.getAttribute('placeholder'),
        state:el.getAttribute('data-qrpass-search-v87'),
        background:getComputedStyle(el).backgroundColor,
        border:getComputedStyle(el).borderColor,
        shadow:getComputedStyle(el).boxShadow
      }))};
    console.info('[QRPass v87] Search effects active. Fields:',window.__qrpassSearchV87.count());
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
