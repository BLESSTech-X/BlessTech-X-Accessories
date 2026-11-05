/* PhoneYa2 Command Centre Extreme UX layer — additive, no new APIs or database. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const state = { paletteOpen: false, focusMode: false, lastRefresh: null };
  const actions = [
    {title:'Open Customer Desk', detail:'Search customer contacts and review order history', group:'Operations', keys:'customers contacts phone email order history', run:() => document.getElementById('tab-customers')?.click()},
    {title:'Open Seasonal Studio', detail:'Manage seasons, banners, popups and campaign timing', group:'Marketing', keys:'seasonal campaigns christmas valentines easter banners popups', run:() => document.getElementById('tab-seasonal-studio')?.click()},
    {title:'Open Order Desk', detail:'Review orders and fulfilment', group:'Operations', keys:'orders', href:'/admin/orders.html'},
    {title:'Open Product CMS', detail:'Manage products and publish changes', group:'Catalogue', keys:'products cms catalogue', href:'/admin/'},
    {title:'Open Google Analytics', detail:'Visitors, acquisition and conversions', group:'Growth', keys:'traffic visitors analytics', href:'https://analytics.google.com/analytics/web/', external:true},
    {title:'Open Search Console', detail:'Search visibility and indexing', group:'Growth', keys:'seo search indexing', href:'https://search.google.com/search-console/', external:true},
    {title:'Open Microsoft Clarity', detail:'Heatmaps and visitor behaviour', group:'Growth', keys:'recordings heatmaps clicks', href:'https://clarity.microsoft.com/', external:true},
    {title:'Open Affiliate / Agent Desk', detail:'Partner links and sales activity', group:'Network', keys:'affiliate agents commission partners', href:'/agents/py2-360.html'},
    {title:'Open Advertising Admin', detail:'Manage advertisers and campaigns', group:'Monetisation', keys:'ads advertisers campaigns', href:'/ads-admin/'},
    {title:'Open AdSense', detail:'Publisher status and monetisation', group:'Monetisation', keys:'google adsense earnings', href:'https://adsense.google.com/', external:true},
    {title:'Open Communications Centre', detail:'Review email activity and failures', group:'Operations', keys:'email communications delivery', href:'/admin/communications.html'},
    {title:'Open Email Campaigns', detail:'Create and review campaign drafts', group:'Marketing', keys:'newsletter email marketing', href:'/admin/campaigns.html'},
    {title:'Refresh all available data', detail:'Refresh overview, analytics and health checks', group:'System', keys:'reload update sync refresh', run:refreshAll},
    {title:'Read complete business briefing', detail:'Show the current evidence-based briefing', group:'Intelligence', keys:'voice briefing summary report', run:briefing},
    {title:'Copy current briefing', detail:'Copy the briefing text to clipboard', group:'Intelligence', keys:'clipboard copy notes', run:copyBriefing},
    {title:'Export visible KPI snapshot', detail:'Download current dashboard indicators as CSV', group:'Reports', keys:'csv export download report', run:exportSnapshot},
    {title:'Print / save dashboard as PDF', detail:'Open a clean print layout', group:'Reports', keys:'print pdf save', run:() => window.print()},
    {title:'Toggle focus mode', detail:'Reduce visual clutter while working', group:'Workspace', keys:'focus minimal hide', run:toggleFocus}
  ];
  function safeClick(id) { const el = document.getElementById(id); if (el && !el.disabled) { el.click(); return true; } return false; }
  function refreshAll() {
    const targets = ['refresh','ga4-refresh','health-refresh'];
    let triggered = 0;
    targets.forEach((id, index) => setTimeout(() => { if (safeClick(id)) triggered++; }, index * 220));
    toast('Refreshing available business data…', 'info');
    setTimeout(() => { state.lastRefresh = new Date(); updateRefreshStamp(); toast('Refresh requests sent. Check each panel for its own result.', 'success'); }, 900);
  }
  function briefing() {
    const answer = $('#assistant-answer');
    const full = $('#full-voice-briefing');
    if (full) full.click();
    else if (answer) answer.textContent = 'The complete briefing is not available until the Command Centre has finished loading.';
    closePalette();
    $('#assistant-answer')?.scrollIntoView({behavior:'smooth', block:'center'});
  }
  async function copyBriefing() {
    const text = ($('#assistant-answer')?.textContent || '').trim();
    if (!text) { toast('Generate the business briefing first, then copy it.', 'warn'); return; }
    try { await navigator.clipboard.writeText(text); toast('Briefing copied to clipboard.', 'success'); }
    catch { const area = document.createElement('textarea'); area.value = text; area.style.position='fixed'; area.style.opacity='0'; document.body.append(area); area.select(); const ok = document.execCommand('copy'); area.remove(); toast(ok ? 'Briefing copied.' : 'Clipboard access was blocked by the browser.', ok ? 'success' : 'warn'); }
    closePalette();
  }
  function exportSnapshot() {
    const rows = [['Metric','Current value','Context']];
    const pairs = [
      ['Total orders','stat-orders','Recorded order count'],
      ['Recorded order value','stat-sales','Not cash collected or profit'],
      ['Pending orders','stat-pending','Needs follow-up'],
      ['Delivered orders','stat-delivered','Marked delivered'],
      ['Catalogue items','stat-products','Parsed product index'],
      ['Order value last 30 days','stat-sales-30','Non-cancelled order value'],
      ['Orders last 30 days','stat-orders-30','Rolling 30-day window'],
      ['Unique customers','stat-customers','Based on order contact details'],
      ['Cancellation rate','stat-cancel-rate','Cancelled / all orders'],
      ['Low-stock products','stat-low-stock','Three or fewer units'],
      ['GA4 active users','ga4-users','Current GA4 reporting period'],
      ['GA4 sessions','ga4-sessions','Current GA4 reporting period'],
      ['GA4 page views','ga4-views','Current GA4 reporting period'],
      ['GA4 events','ga4-events','Current GA4 reporting period']
    ];
    for (const [label,id,context] of pairs) rows.push([label, ($('#'+id)?.textContent || 'Not loaded').trim(), context]);
    rows.push(['Exported at',new Date().toISOString(),'PhoneYa2 Command Centre']);
    const csv = rows.map(row => row.map(value => '"' + String(value).replace(/"/g,'""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'}));
    const a = document.createElement('a'); a.href=url; a.download='phoneya2-command-centre-snapshot-'+new Date().toISOString().slice(0,10)+'.csv'; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast('KPI snapshot downloaded. Unavailable figures are labelled, not guessed.', 'success'); closePalette();
  }
  function toggleFocus() {
    state.focusMode = !state.focusMode;
    document.body.classList.toggle('cc-focus-mode', state.focusMode);
    toast(state.focusMode ? 'Focus mode on. Press Ctrl/⌘ + K to switch it off.' : 'Focus mode off.', 'info');
    closePalette();
  }
  function toast(message, type='info') {
    let stack = $('#cc-toast-stack');
    if (!stack) { stack = document.createElement('div'); stack.id='cc-toast-stack'; stack.setAttribute('aria-live','polite'); stack.setAttribute('aria-atomic','false'); document.body.append(stack); }
    const item = document.createElement('div'); item.className='cc-toast cc-toast-'+type; item.textContent=message; stack.append(item);
    setTimeout(() => { item.classList.add('cc-toast-out'); setTimeout(()=>item.remove(),240); }, 3600);
  }
  function createPalette() {
    if ($('#cc-command-palette')) return;
    const launch = document.createElement('button');
    launch.type='button'; launch.id='cc-command-launcher'; launch.className='cc-command-launcher';
    launch.setAttribute('aria-haspopup','dialog'); launch.setAttribute('aria-controls','cc-command-palette');
    launch.innerHTML='<span class="cc-launcher-icon">⌘</span><span class="cc-launcher-label">Command menu</span><kbd>Ctrl K</kbd>';
    launch.addEventListener('click', openPalette); document.body.append(launch);
    const dialog = document.createElement('div'); dialog.id='cc-command-palette'; dialog.className='cc-palette-backdrop'; dialog.hidden=true;
    dialog.innerHTML='<section class="cc-palette" role="dialog" aria-modal="true" aria-labelledby="cc-palette-title"><div class="cc-palette-top"><div><div class="cc-palette-eyebrow">PHONEYA2 OPERATIONS</div><h2 id="cc-palette-title">What do you want to do?</h2></div><button type="button" class="cc-palette-close" aria-label="Close command menu">×</button></div><label class="cc-palette-search-label" for="cc-palette-search">Search tools and actions</label><input id="cc-palette-search" class="cc-palette-search" type="search" placeholder="Try “orders”, “traffic”, “export”…" autocomplete="off"><div class="cc-palette-hint"><span>↑ ↓ to navigate</span><span>Enter to run</span><span>Esc to close</span></div><div id="cc-palette-results" class="cc-palette-results" role="listbox" aria-label="Available commands"></div><div class="cc-palette-footer"><span>Evidence first · no invented metrics</span><span>PHONEYA2 / COMMAND CENTRE</span></div></section>';
    dialog.addEventListener('click', e=>{ if(e.target===dialog) closePalette(); });
    $('.cc-palette-close',dialog).addEventListener('click',closePalette);
    $('#cc-palette-search',dialog).addEventListener('input',renderResults);
    $('#cc-palette-search',dialog).addEventListener('keydown',handlePaletteKeys);
    document.body.append(dialog);
    renderResults();
  }
  let selectedIndex=0, filteredActions=[];
  function openPalette() {
    if ($('#dashboard')?.classList.contains('hidden')) return;
    if (!$('#cc-command-palette')) createPalette();
    const dialog=$('#cc-command-palette'); dialog.hidden=false; state.paletteOpen=true; selectedIndex=0;
    $('#cc-palette-search').value=''; renderResults(); document.body.classList.add('cc-palette-open');
    requestAnimationFrame(()=>$('#cc-palette-search').focus());
  }
  function closePalette() {
    const dialog=$('#cc-command-palette'); if(dialog) dialog.hidden=true;
    state.paletteOpen=false; document.body.classList.remove('cc-palette-open'); $('#cc-command-launcher')?.focus({preventScroll:true});
  }
  function renderResults() {
    const input=$('#cc-palette-search'); const box=$('#cc-palette-results'); if(!input||!box)return;
    const query=input.value.trim().toLowerCase();
    filteredActions=actions.filter(a=>(a.title+' '+a.detail+' '+a.group+' '+a.keys).toLowerCase().includes(query));
    selectedIndex=Math.min(selectedIndex,Math.max(0,filteredActions.length-1));
    box.replaceChildren();
    if(!filteredActions.length){const empty=document.createElement('div');empty.className='cc-palette-empty';empty.textContent='No matching action. Try a shorter search term.';box.append(empty);return;}
    let lastGroup='';
    filteredActions.forEach((action,index)=>{
      if(action.group!==lastGroup){const group=document.createElement('div');group.className='cc-palette-group';group.textContent=action.group;box.append(group);lastGroup=action.group;}
      const button=document.createElement('button');button.type='button';button.className='cc-command-result'+(index===selectedIndex?' is-selected':'');button.setAttribute('role','option');button.setAttribute('aria-selected',String(index===selectedIndex));
      const copy=document.createElement('span');copy.className='cc-result-copy';const title=document.createElement('strong');title.textContent=action.title;const detail=document.createElement('small');detail.textContent=action.detail;copy.append(title,detail);
      const arrow=document.createElement('span');arrow.className='cc-result-arrow';arrow.textContent=action.run?'↵':action.external?'↗':'→';button.append(copy,arrow);
      button.addEventListener('mouseenter',()=>{selectedIndex=index;syncSelected();});button.addEventListener('click',()=>execute(action));box.append(button);
    });
  }
  function syncSelected(){ $$('.cc-command-result').forEach((el,i)=>{el.classList.toggle('is-selected',i===selectedIndex);el.setAttribute('aria-selected',String(i===selectedIndex));});$('.cc-command-result.is-selected')?.scrollIntoView({block:'nearest'}); }
  function handlePaletteKeys(e) {
    if(e.key==='ArrowDown'){e.preventDefault();selectedIndex=Math.min(selectedIndex+1,filteredActions.length-1);syncSelected();}
    else if(e.key==='ArrowUp'){e.preventDefault();selectedIndex=Math.max(0,selectedIndex-1);syncSelected();}
    else if(e.key==='Enter'){e.preventDefault();if(filteredActions[selectedIndex])execute(filteredActions[selectedIndex]);}
    else if(e.key==='Escape'){e.preventDefault();closePalette();}
  }
  function execute(action) {
    closePalette();
    if(action.run){action.run();return;}
    if(action.href){if(action.external)window.open(action.href,'_blank','noopener,noreferrer');else window.location.href=action.href;}
  }
  function ensureCommandFooter() {
    const dashboard=$('#dashboard');
    if(!dashboard)return null;
    let footer=$('#cc-global-footer');
    if(!footer){
      footer=document.createElement('footer');
      footer.id='cc-global-footer';
      footer.className='cc-global-footer';
      footer.innerHTML='<div class="cc-footer-top"><div class="cc-footer-heading"><strong>Command Centre</strong></div><div class="cc-footer-controls"></div></div><div class="cc-footer-fastlane"></div><div class="cc-footer-bottom"><div class="cc-footer-links"></div><div class="cc-footer-message" id="cc-footer-message"></div></div>';
      dashboard.append(footer);
    }
    const controls=footer.querySelector('.cc-footer-controls');
    const actions=$('.intro-actions');
    if(actions&&actions.parentElement!==controls){
      actions.classList.add('cc-footer-controls');
      controls.replaceWith(actions);
    }
    const blogLink=$('.comment-top-link');
    const links=footer.querySelector('.cc-footer-links');
    if(blogLink&&blogLink.parentElement!==links)links.append(blogLink);
    const message=$('#global-message');
    const messageSlot=$('#cc-footer-message');
    if(message&&message.parentElement!==messageSlot)messageSlot.append(message);
    return footer;
  }
  function updateRefreshStamp() {
    const footer=ensureCommandFooter();
    if(!footer)return;
    let stamp=$('#cc-refresh-stamp');
    if(!stamp){stamp=document.createElement('span');stamp.id='cc-refresh-stamp';stamp.className='cc-refresh-stamp';const actionsBox=footer.querySelector('.cc-footer-controls');if(actionsBox)actionsBox.prepend(stamp);}
    stamp.textContent=state.lastRefresh?'Refresh requested '+state.lastRefresh.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'Ready · refresh data when needed';
    stamp.title='This records when refresh was requested, not when every source finished successfully.';
  }
  function addQuickActions() {
    const footer=ensureCommandFooter();
    if(!footer||$('#cc-quick-actions'))return;
    const section=document.createElement('section');section.id='cc-quick-actions';section.className='cc-quick-actions panel';
    section.innerHTML='<div class="cc-quick-heading"><strong>Quick actions</strong><button type="button" class="btn" id="cc-open-command-menu">⌘ Command menu</button></div><div class="cc-quick-grid"><a href="/admin/orders.html" class="cc-quick-card"><span>▤</span><strong>Orders</strong></a><a href="/admin/" class="cc-quick-card"><span>▦</span><strong>Product CMS</strong></a><a href="https://analytics.google.com/analytics/web/" target="_blank" rel="noopener noreferrer" class="cc-quick-card"><span>↗</span><strong>Analytics</strong></a><button type="button" class="cc-quick-card" id="cc-export-card"><span>▧</span><strong>Export CSV</strong></button></div>';
    footer.querySelector('.cc-footer-fastlane').append(section);
    $('#cc-open-command-menu').addEventListener('click',openPalette);
    $('#cc-export-card').addEventListener('click',exportSnapshot);
  }

  /* Header navigation: icon-led workspace tabs attached to the top bar. */
  function setupGuidedNavigation() {
    const nav=$('#workspace-nav'), topbar=$('.topbar'), brand=$('.topbar .brand'), right=$('.topbar .top-right');
    if(!nav||!topbar||!brand||!right||!nav.querySelector('.workspace-tab'))return;
    const icons={
      overview:'⌂',assistant:'✦',actions:'⚡',orders:'▤',network:'◎',
      inventory:'▣',money:'＄',analytics:'▥',growth:'↗',experiments:'⌁',
      health:'♥',resources:'⚙', 'seasonal-studio':'🎄',customers:'♙'
    };
    nav.querySelectorAll('.workspace-tab').forEach(tab=>{
      const id=tab.id.replace('tab-','');
      const label=tab.querySelector('.cc-header-tab-label')?.textContent?.trim()
        ||tab.getAttribute('aria-label')
        ||tab.textContent.replace(/^\S+\s*/,'').trim()
        ||tab.textContent.trim();
      if(!tab.classList.contains('cc-header-tab')||!tab.querySelector('.cc-header-tab-label')){
        tab.classList.add('cc-header-tab');
        tab.setAttribute('aria-label',label);
        tab.title=label;
        tab.replaceChildren();
        const icon=document.createElement('span');icon.className='cc-header-tab-icon';icon.setAttribute('aria-hidden','true');icon.textContent=icons[id]||'•';
        const text=document.createElement('span');text.className='cc-header-tab-label';text.textContent=label;
        tab.append(icon,text);
      }
    });
    nav.classList.add('cc-header-navigation');
    nav.setAttribute('aria-label','Command Centre page navigation');
    if(nav.dataset.headerNav!=='1'){
      nav.dataset.headerNav='1';
      topbar.insertBefore(nav,right);
      const caption=$('#cc-topbar-caption');if(caption)caption.remove();
      let toggle=$('#cc-menu-toggle');
      if(!toggle){
        toggle=document.createElement('button');
        toggle.type='button';toggle.id='cc-menu-toggle';toggle.className='cc-menu-togg';
        toggle.setAttribute('aria-label','Open workspace menu');toggle.setAttribute('aria-expanded','false');
        toggle.innerHTML='<span></span><span></span><span></span>';
        topbar.insertBefore(toggle,nav);
        toggle.addEventListener('click',()=>{
          const open=document.body.classList.toggle('cc-nav-open');
          toggle.setAttribute('aria-expanded',String(open));
          toggle.setAttribute('aria-label',open?'Close workspace menu':'Open workspace menu');
        });
      }else if(toggle.parentElement!==topbar){topbar.insertBefore(toggle,nav);}
      let overlay=$('.cc-nav-overlay');
      if(!overlay){overlay=document.createElement('button');overlay.type='button';overlay.className='cc-nav-overlay';overlay.setAttribute('aria-label','Close workspace menu');document.body.append(overlay);}
      const closeMenu=()=>{document.body.classList.remove('cc-nav-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open workspace menu');};
      overlay.addEventListener('click',closeMenu);
      nav.addEventListener('click',e=>{if(e.target.closest('.workspace-tab'))closeMenu();});
      document.body.classList.remove('cc-nav-open','cc-nav-collapsed');
    }
  }
  function watchGuidedNavigation(){
    const nav=$('#workspace-nav');if(!nav)return;
    const apply=()=>{if(nav.querySelector('.workspace-tab'))setupGuidedNavigation();};
    apply();new MutationObserver(apply).observe(nav,{childList:true,subtree:true});
  }

  (function installNavigationStyles(){
    if($('#cc-navigation-styles'))return;const style=document.createElement('style');style.id='cc-navigation-styles';style.textContent=`
      /* Compact, bounded workspace menu: never expand the header into a full page of tabs. */
      .topbar{position:sticky!important;z-index:10020!important;overflow:visible!important}
      .topbar .cc-header-navigation{display:none!important;position:absolute!important;top:calc(100% + 8px)!important;left:auto!important;right:clamp(12px,3vw,38px)!important;width:min(520px,calc(100vw - 24px))!important;max-height:min(58vh,440px)!important;overflow-y:auto!important;overscroll-behavior:contain!important;display:none!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;align-content:start!important;gap:6px!important;padding:10px!important;margin:0!important;background:rgba(16,19,34,.98)!important;border:1px solid #ffffff20!important;border-radius:16px!important;box-shadow:0 18px 48px #080d1b55!important;backdrop-filter:blur(18px)!important;z-index:10022!important}
      body.cc-nav-open .topbar .cc-header-navigation{display:grid!important}
      .topbar .cc-header-navigation .workspace-tab{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important;min-width:0!important;min-height:42px!important;padding:9px 10px!important;margin:0!important;border:1px solid #ffffff12!important;border-radius:10px!important;background:#ffffff09!important;color:#dbe4f4!important;font-size:11px!important;line-height:1.25!important;white-space:normal!important;text-align:left!important;box-shadow:none!important;transform:none!important}
      .topbar .cc-header-navigation .workspace-tab:hover{background:#ffffff16!important}
      .topbar .cc-header-navigation .workspace-tab[aria-selected="true"]{background:linear-gradient(120deg,#ff7418,#e64d16)!important;border-color:#ff974f!important;color:#fff!important}
      .topbar .cc-header-navigation .cc-header-tab-icon{flex:0 0 18px!important;width:18px!important;text-align:center!important;font-size:15px!important}
      .topbar .cc-header-navigation .cc-header-tab-label{display:block!important;min-width:0!important;overflow-wrap:anywhere!important}
      .cc-nav-overlay{display:none!important;position:fixed!important;inset:0!important;z-index:10010!important;width:100%!important;height:100%!important;border:0!important;background:#07102055!important;cursor:default!important}
      body.cc-nav-open .cc-nav-overlay{display:block!important}
      #cc-menu-toggle{position:relative!important;z-index:10023!important;flex:0 0 auto!important}
      @media(max-width:700px){
        .topbar .cc-header-navigation{right:10px!important;left:10px!important;width:auto!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;max-height:min(62vh,430px)!important}
        .topbar .cc-header-navigation .workspace-tab{min-height:40px!important;padding:8px!important;font-size:10px!important}
        .topbar{gap:8px!important}
      }
      @media(max-width:380px){.topbar .cc-header-navigation{grid-template-columns:1fr!important;max-height:55vh!important}}
      /* Quick tools: remove the old white control tray. Keep one compact toggle visible;
         its individual controls unfold above it only when requested. */
      #dashboard .cc-float-tools.cc-float-tools-grouped{display:flex!important;flex-direction:column-reverse!important;align-items:flex-end!important;gap:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important}
      #dashboard .cc-float-tools-grouped .cc-float-tools-toggle{position:relative;z-index:2;display:flex;align-items:center;gap:9px;border:0;border-radius:999px;padding:12px 16px;background:linear-gradient(135deg,#ff7418,#e64d16);color:#fff;font-weight:850;box-shadow:0 12px 32px #10132240;cursor:pointer}
      .cc-float-tools-toggle-icon{font-size:20px;line-height:1}
      #dashboard .cc-float-tools-grouped .cc-float-tool-item{position:absolute!important;right:0!important;bottom:calc(100% + 9px)!important;display:flex!important;opacity:0;visibility:hidden;pointer-events:none;transform:translateY(12px) scale(.94);transition:opacity .2s,transform .2s,visibility .2s;box-shadow:0 8px 22px #10132220}
      #dashboard .cc-float-tools-grouped.is-open .cc-float-tool-item{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(calc(var(--tool-index) * -59px)) scale(1)}
      #dashboard .cc-float-tools-grouped.is-open .cc-float-tool-item:nth-of-type(2){transform:translateY(-59px)}
      #dashboard .cc-float-tools-grouped.is-open .cc-float-tool-item:nth-of-type(3){transform:translateY(-118px)}
      #dashboard .cc-float-tools-grouped.is-open .cc-float-tool-item:nth-of-type(4){transform:translateY(-177px)}
      #dashboard .cc-float-tools-grouped.is-open .cc-float-tool-item:nth-of-type(5){transform:translateY(-236px)}
      #dashboard .cc-float-tools-grouped.is-open .cc-float-tool-item:nth-of-type(6){transform:translateY(-295px)}
      .cc-bottom-navigation{position:fixed;z-index:9990;left:50%;bottom:max(10px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(620px,calc(100% - 24px));display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;padding:7px;background:rgba(16,19,34,.96);border:1px solid #ffffff20;border-radius:18px;box-shadow:0 14px 38px #080d1b45;backdrop-filter:blur(18px)}
      .cc-bottom-tab{min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:7px 3px;border:0;border-radius:12px;background:transparent;color:#b9c3d8;font-size:10px;font-weight:800;cursor:pointer}
      .cc-bottom-tab.is-active{background:linear-gradient(135deg,#ff7418,#e64d16);color:#fff}
      .cc-bottom-icon{font-size:19px;line-height:1.1}
      #dashboard{padding-bottom:96px!important}
      @media(min-width:900px){.cc-bottom-navigation{width:min(520px,calc(100% - 36px));bottom:16px}.cc-bottom-tab{flex-direction:row;font-size:11px;gap:7px;padding:10px}}
      @media(prefers-reduced-motion:reduce){.cc-float-tool-item{transition:none!important}}
    `;document.head.append(style);
  })();
  function setupFloatingTools(){
    const tools=$('.cc-float-tools');if(!tools||tools.dataset.grouped==='1')return;
    tools.dataset.grouped='1';tools.classList.add('cc-float-tools-grouped');
    const buttons=[...tools.querySelectorAll('.cc-float-btn')];
    const toggle=document.createElement('button');toggle.type='button';toggle.id='cc-float-tools-toggle';toggle.className='cc-float-tools-toggle';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open quick tools');toggle.innerHTML='<span class="cc-float-tools-toggle-icon">＋</span><span class="cc-float-tools-toggle-label">Quick tools</span>';
    tools.prepend(toggle);
    buttons.forEach((button,index)=>{button.classList.add('cc-float-tool-item');button.style.setProperty('--tool-index',String(index));});
    const close=()=>{tools.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open quick tools');toggle.querySelector('.cc-float-tools-toggle-icon').textContent='＋';};
    toggle.addEventListener('click',()=>{const open=tools.classList.toggle('is-open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close quick tools':'Open quick tools');toggle.querySelector('.cc-float-tools-toggle-icon').textContent=open?'×':'＋';});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
    tools.addEventListener('click',event=>{if(event.target.closest('.cc-float-tool-item'))close();});
  }
  function setupBottomNavigation(){
    if($('#cc-bottom-navigation'))return;
    const workspace=$('#workspace-nav');if(!workspace)return;
    if(!$('#tab-overview')){
      if(workspace.dataset.bottomNavWatching!=='1'){
        workspace.dataset.bottomNavWatching='1';
        new MutationObserver(()=>{if($('#tab-overview'))setupBottomNavigation();}).observe(workspace,{childList:true,subtree:true});
      }
      return;
    }
    const definitions=[['overview','⌂','Home'],['actions','⚡','Actions'],['orders','▤','Orders'],['analytics','▥','Analytics']];
    const nav=document.createElement('nav');nav.id='cc-bottom-navigation';nav.className='cc-bottom-navigation';nav.setAttribute('aria-label','Main Command Centre navigation');
    definitions.forEach(([id,icon,label])=>{const source=$('#tab-'+id);if(!source)return;const button=document.createElement('button');button.type='button';button.className='cc-bottom-tab';button.dataset.target=id;button.innerHTML='<span class="cc-bottom-icon" aria-hidden="true">'+icon+'</span><span>'+label+'</span>';button.addEventListener('click',()=>source.click());nav.append(button);});
    const more=document.createElement('button');more.type='button';more.className='cc-bottom-tab';more.dataset.target='more';more.innerHTML='<span class="cc-bottom-icon" aria-hidden="true">☰</span><span>More</span>';more.addEventListener('click',()=>{const toggle=$('#cc-menu-toggle');if(toggle){if(!document.body.classList.contains('cc-nav-open'))toggle.click();}else workspace.scrollIntoView({behavior:'smooth',block:'start'});});nav.append(more);
    const quickTools=$('.cc-float-tools');if(quickTools)nav.append(quickTools);
    document.body.append(nav);
    const sync=()=>{const active=workspace.querySelector('.workspace-tab[aria-selected="true"]')?.id?.replace('tab-','')||'overview';nav.querySelectorAll('.cc-bottom-tab').forEach(button=>button.classList.toggle('is-active',button.dataset.target===active||(button.dataset.target==='more'&&!definitions.some(x=>x[0]===active))));};
    workspace.addEventListener('click',event=>{if(event.target.closest('.workspace-tab'))setTimeout(sync,0);});new MutationObserver(sync).observe(workspace,{subtree:true,attributes:true,attributeFilter:['aria-selected']});sync();
  }
  function init() {
    createPalette(); addQuickActions(); updateRefreshStamp(); watchGuidedNavigation(); setupFloatingTools(); setupBottomNavigation();
    const refresh=$('#refresh'); if(refresh)refresh.addEventListener('click',()=>{state.lastRefresh=new Date();updateRefreshStamp();},{capture:true});
    document.addEventListener('keydown',e=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();state.paletteOpen?closePalette():openPalette();}
      if(e.key==='Escape'&&state.paletteOpen)closePalette();
    });
    const dashboard=$('#dashboard');
    if(dashboard){new MutationObserver(()=>{if(!dashboard.classList.contains('hidden')){addQuickActions();createPalette();}}).observe(dashboard,{attributes:true,attributeFilter:['class']});}
    window.addEventListener('online',()=>toast('Connection restored. Refresh data to verify source connections.','success'));
    window.addEventListener('offline',()=>toast('You are offline. Dashboard figures may be stale; no live refresh can complete.','warn'));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();