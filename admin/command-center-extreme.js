/* PhoneYa2 Command Centre Extreme UX layer — additive, no new APIs or database. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const state = { paletteOpen: false, focusMode: false, lastRefresh: null };
  const actions = [
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
  function updateRefreshStamp() {
    let stamp=$('#cc-refresh-stamp');
    if(!stamp){stamp=document.createElement('span');stamp.id='cc-refresh-stamp';stamp.className='cc-refresh-stamp';const actionsBox=$('.intro-actions');if(actionsBox)actionsBox.prepend(stamp);}
    stamp.textContent=state.lastRefresh?'Refresh requested '+state.lastRefresh.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'Ready · refresh data when needed';
    stamp.title='This records when refresh was requested, not when every source finished successfully.';
  }
  function addQuickActions() {
    const intro=$('.intro');
    if(!intro||$('#cc-quick-actions'))return;
    const section=document.createElement('section');section.id='cc-quick-actions';section.className='cc-quick-actions panel';
    section.innerHTML='<div class="cc-quick-heading"><div><span class="cc-quick-eyebrow">FAST LANE</span><h2>Quick actions</h2><p>Go straight to the work that moves the business.</p></div><button type="button" class="btn" id="cc-open-command-menu">⌘ Open command menu</button></div><div class="cc-quick-grid"><a href="/admin/orders.html" class="cc-quick-card"><span>▤</span><strong>Follow up orders</strong><small>Fulfilment and pending buyers</small><b>Open Order Desk →</b></a><a href="/admin/" class="cc-quick-card"><span>▦</span><strong>Improve product offers</strong><small>Catalogue, pricing and publishing</small><b>Open Product CMS →</b></a><a href="https://analytics.google.com/analytics/web/" target="_blank" rel="noopener noreferrer" class="cc-quick-card"><span>↗</span><strong>Find traffic opportunities</strong><small>Acquisition and page performance</small><b>Open Analytics ↗</b></a><button type="button" class="cc-quick-card" id="cc-export-card"><span>▧</span><strong>Export a KPI snapshot</strong><small>Keep a dated operational record</small><b>Download CSV ↓</b></button></div>';
    intro.insertAdjacentElement('afterend',section);
    $('#cc-open-command-menu').addEventListener('click',openPalette);
    $('#cc-export-card').addEventListener('click',exportSnapshot);
  }
  function init() {
    createPalette(); addQuickActions(); updateRefreshStamp();
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