/* PhoneYa2 shared admin navigation. It activates only after the page reveals its authenticated dashboard. */
(()=>{'use strict';
const links=[
 {label:'Overview',icon:'▦',href:'/admin/command-center.html',match:['command-center.html']},
 {label:'Orders',icon:'▤',href:'/admin/orders.html',match:['orders.html']},
 {label:'Advertising',icon:'📣',href:'/ads-admin/',match:['/ads-admin/']},
 {label:'Communications',icon:'✉',href:'/admin/communications.html',match:['communications.html']},
 {label:'Blog comments',icon:'▤',href:'/admin/comments.html',match:['comments.html']},
 {label:'Content studio',icon:'✎',href:'/admin/',match:['/admin/']}
];
const path=location.pathname;
function visible(el){return !!el&&!el.classList.contains('hidden')&&getComputedStyle(el).display!=='none'}
function mount(){
 if(document.body.classList.contains('py2-admin-shell-active'))return;
 const dashboard=document.querySelector('#dashboard')||document.querySelector('#scr-admin');
 if(!visible(dashboard))return;
 document.body.classList.add('py2-admin-shell-active');
 const active=links.find(x=>x.match.some(m=>m==='/admin/'?path==='/admin/'||path==='/admin/index.html':path.endsWith(m)));
 const nav=links.map(x=>'<a class="py2-admin-nav" href="'+x.href+'" '+(x===active?'aria-current="page"':'')+'><span class="py2-admin-nav-icon" aria-hidden="true">'+x.icon+'</span><span>'+x.label+'</span></a>').join('');
 const top=document.createElement('header');top.className='py2-admin-topbar';top.innerHTML='<div class="py2-admin-brand"><span class="py2-admin-mark">P</span><span>PhoneYa<em>2</em> <span style="font-weight:600;color:#687386">/ Workspace</span></span></div><div class="py2-admin-topmeta"><span><i class="py2-admin-live"></i>SECURE ADMIN SESSION</span><a href="/" style="color:inherit">View store ↗</a></div>';
 const side=document.createElement('aside');side.className='py2-admin-sidebar';side.setAttribute('aria-label','Admin workspace navigation');side.innerHTML='<div class="py2-admin-navlabel">Workspace</div><nav>'+nav+'</nav><div class="py2-admin-sidebar-foot">PhoneYa2 Management Workspace<br>Smart CHOICES. Better CONNECTED 💙</div>';
 document.body.prepend(side);document.body.prepend(top);
}
const observer=new MutationObserver(mount);
observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class','style']});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
setTimeout(mount,800);
})();