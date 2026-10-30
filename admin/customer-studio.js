/* PhoneYa2 Customer Desk — built from existing order records */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 let mounted=false,query='';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=value=>'ZMW '+Number(value||0).toLocaleString('en-ZM',{minimumFractionDigits:2,maximumFractionDigits:2});
 function records(){
  const orders=window.PY2_GET_ORDERS?.()||[],map=new Map();
  orders.forEach(order=>{
   const email=String(order.customer_email||'').trim().toLowerCase(),phone=String(order.customer_phone||'').trim(),name=String(order.customer_name||'').trim();
   const key=email||phone||name.toLowerCase();if(!key)return;
   if(!map.has(key))map.set(key,{key,name:name||'Customer',email,phone,orders:[],value:0,last:null});
   const customer=map.get(key);customer.orders.push(order);
   if(order.status!=='cancelled')customer.value+=Number(order.total_amount||0);
   const date=new Date(order.created_at||0);if(!Number.isNaN(date.getTime())&&(!customer.last||date>customer.last)){customer.last=date;customer.latestStatus=order.status||'—';}
   if(!customer.name&&name)customer.name=name;
  });
  return [...map.values()].sort((a,b)=>(b.last?.getTime()||0)-(a.last?.getTime()||0));
 }
 function render(){
  const all=records(),filtered=all.filter(c=>[c.name,c.email,c.phone].join(' ').toLowerCase().includes(query));
  const orders=window.PY2_GET_ORDERS?.()||[],totalOrders=orders.length,value=orders.filter(o=>o.status!=='cancelled').reduce((n,o)=>n+Number(o.total_amount||0),0);
  $('customer-total').textContent=all.length.toLocaleString();$('customer-orders').textContent=totalOrders.toLocaleString();$('customer-value').textContent=money(value);
  $('customer-results').textContent=filtered.length+' customer'+(filtered.length===1?'':'s');
  $('customer-table-body').innerHTML=filtered.length?filtered.map(c=>{
   const latest=c.last?c.last.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—';
   const lastStatus=c.latestStatus||'—';
   return '<tr><td><strong>'+esc(c.name)+'</strong><small>'+esc(c.email||'No email recorded')+'</small></td><td>'+esc(c.phone||'—')+'</td><td>'+c.orders.length+'</td><td><strong>'+money(c.value)+'</strong></td><td>'+esc(latest)+'</td><td><span class="cs-status">'+esc(lastStatus)+'</span></td></tr>';
  }).join(''):'<tr><td colspan="6" class="cs-empty">No matching customer records found.</td></tr>';
  $('customer-mobile-list').innerHTML=filtered.length?filtered.map(c=>'<article class="cs-customer-card"><div><strong>'+esc(c.name)+'</strong><small>'+esc(c.email||'No email recorded')+'</small><small>'+esc(c.phone||'No phone recorded')+'</small></div><div class="cs-card-metrics"><span><b>'+c.orders.length+'</b> orders</span><span><b>'+money(c.value)+'</b> recorded order value</span></div></article>').join(''):'<div class="cs-empty">No matching customer records found.</div>';
 }
 function mount(){
  if(mounted)return;
  const nav=$('workspace-nav'),host=$('workspace-views');if(!nav||!host)return;
  const tab=document.createElement('button');tab.type='button';tab.className='workspace-tab';tab.id='tab-customers';tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');tab.textContent='Customers';
  const panel=document.createElement('section');panel.className='workspace-view';panel.id='view-customers';panel.setAttribute('role','tabpanel');panel.hidden=true;
  panel.innerHTML='<div class="cs-head"><div><div class="ss-kicker">CUSTOMER RELATIONSHIPS</div><h2>Customer Desk</h2><p>Understand customer activity from the orders already recorded by PhoneYa2.</p></div><button class="btn" id="customer-refresh" type="button">Refresh records</button></div><div class="cs-stats"><div><small>Customers identified</small><strong id="customer-total">—</strong></div><div><small>Recorded orders</small><strong id="customer-orders">—</strong></div><div><small>Recorded order value</small><strong id="customer-value">—</strong></div></div><div class="cs-toolbar"><input id="customer-search" type="search" placeholder="Search name, email or phone" aria-label="Search customers"><span id="customer-results">—</span></div><div class="cs-table-wrap"><table class="cs-table"><thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Order value</th><th>Last order</th><th>Latest status</th></tr></thead><tbody id="customer-table-body"></tbody></table></div><div id="customer-mobile-list" class="cs-mobile-list"></div><p class="cs-note">This desk groups customers from order contact details. It does not create a separate customer database or claim verified lifetime value; cancelled orders are excluded from recorded order value.</p>';
  host.append(panel);const seasonal=$('tab-seasonal-studio');if(seasonal)nav.insertBefore(tab,seasonal);else nav.append(tab);
  function activate(){nav.querySelectorAll('[role=tab]').forEach(b=>{b.setAttribute('aria-selected',String(b===tab));b.tabIndex=b===tab?0:-1;});host.querySelectorAll('[role=tabpanel]').forEach(p=>p.hidden=p!==panel);panel.hidden=false;render();}
  tab.addEventListener('click',activate);
  $('customer-search').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();render();});
  $('customer-refresh').addEventListener('click',async()=>{const b=$('customer-refresh');b.disabled=true;try{await window.PY2_REFRESH_DATA?.();render();}finally{b.disabled=false;}});
  mounted=true;
 }
 function init(){mount();}
 window.addEventListener('py2-admin-ready',init);if(window.PY2_SEASONAL_AUTH_TOKEN)init();
})();
