/* Compact Partner Studio tutorial: first-visit popup plus an always-available floating help button. */
(()=>{'use strict';
const steps=[
 {key:'profile',title:'Complete your business profile',body:'Add your business name, contact person, phone number, tagline and a short description so customers know who you are.',section:'profile',target:'#profile-form'},
 {key:'images',title:'Add your logo and business images',body:'Upload a clear logo and add a cover image in Website Builder. Preview images before saving.',section:'profile',target:'#profile-logo-file'},
 {key:'website',title:'Customise your website',body:'Choose your template, colours, layout, contact options and the sections customers should see.',section:'website',target:'#site-form'},
 {key:'content',title:'Create your first post or catalogue item',body:'Publish a useful update, product, service or offer so customers have something specific to discover.',section:'composer',target:'#composer'},
 {key:'publish',title:'Preview and publish your business page',body:'Check your website on mobile, publish it, then share your public business link with customers.',section:'overview',target:'#publish'}
];
const $=s=>document.querySelector(s);let completed=new Set(),dismissed=false,step=0,modal=null,partnerData=null;
async function save(){try{await fetch('/api/partner',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'onboarding.save',completed_steps:[...completed],dismissed})});}catch(e){console.warn('Partner tutorial progress could not be saved:',e);}}
function go(section,target){const nav=$('[data-go="'+section+'"]');if(nav)nav.click();setTimeout(()=>$(target)?.scrollIntoView({behavior:'smooth',block:'center'}),250);}
function nextAction(){const p=partnerData?.partner||{},items=partnerData?.items||[],posts=partnerData?.posts||[],enquiries=partnerData?.enquiries||[];
 if(!p.business_name||!p.owner_name)return 'Complete your business profile';
 if(!p.logo_url)return 'Add your business logo';
 if(!p.slug||p.published===0)return 'Publish your business website';
 if(!items.length&&!posts.length)return 'Create your first product or post';
 if(!posts.some(x=>x.status==='published'))return 'Publish a business update';
 if(!enquiries.length)return 'Share your business website link';
 return 'Review and respond to customer enquiries';
}
function ensureModal(){if(modal)return;const style=document.createElement('style');style.textContent=`
.tutorial-fab{width:46px!important;height:46px!important;min-width:46px!important;padding:0!important;justify-content:center!important;border-radius:50%!important;font-size:22px!important;font-weight:900!important}
.tutorial-fab .sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
#py2-tutorial-backdrop{position:fixed;inset:0;z-index:300;background:rgba(8,22,40,.62);display:none;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(5px)}
#py2-tutorial-backdrop.open{display:flex}
#py2-tutorial-modal{width:min(560px,100%);max-height:min(760px,calc(100dvh - 36px));overflow:auto;background:#fff;color:#17263b;border:1px solid #dce5ef;border-radius:20px;box-shadow:0 28px 90px #06162d66;padding:22px}
#py2-tutorial-modal .tutorial-top{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
#py2-tutorial-modal .tutorial-kicker{font-size:10px;letter-spacing:1.3px;font-weight:900;color:#e85b20}
#py2-tutorial-modal h2{font-size:22px;line-height:1.2;margin:7px 0}
#py2-tutorial-modal p{font-size:13px;line-height:1.65;color:#5b6b7e;margin:8px 0 15px}
#py2-tutorial-modal .tutorial-close{width:36px;height:36px;flex:none;border:1px solid #dce5ef;border-radius:50%;background:#f7f9fc;color:#263c55;font-size:20px;cursor:pointer}
#py2-tutorial-modal .tutorial-progress{height:6px;background:#e9eef5;border-radius:9px;overflow:hidden;margin:16px 0 8px}
#py2-tutorial-modal .tutorial-progress>span{display:block;height:100%;background:#16865b;transition:width .2s}
#py2-tutorial-modal .tutorial-meta{font-size:10px;font-weight:850;letter-spacing:.5px;color:#758398}
#py2-tutorial-modal .tutorial-next-action{padding:12px 14px;border:1px solid #f4d7c8;background:#fff7f1;border-radius:12px;margin:15px 0}
#py2-tutorial-modal .tutorial-next-action small{display:block;color:#a64a1b;font-size:9px;font-weight:900;letter-spacing:1px}
#py2-tutorial-modal .tutorial-next-action b{display:block;font-size:13px;margin-top:4px}
#py2-tutorial-modal .tutorial-step-list{display:flex;gap:6px;flex-wrap:wrap;margin:15px 0}
#py2-tutorial-modal .tutorial-step-list button{border:1px solid #dce5ef;background:#f8fafc;color:#34465d;border-radius:20px;padding:7px 10px;font-size:10px;font-weight:800;cursor:pointer}
#py2-tutorial-modal .tutorial-step-list button.active{background:#173f73;color:#fff;border-color:#173f73}
#py2-tutorial-modal .tutorial-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:16px}
#py2-tutorial-modal .tutorial-actions button{border:0;border-radius:10px;padding:11px 14px;font-size:12px;font-weight:850;cursor:pointer}
#py2-tutorial-modal .tutorial-secondary{background:#edf2f7;color:#34465d}
#py2-tutorial-modal .tutorial-primary{background:#ff641f;color:#fff}
body.dark #py2-tutorial-modal{background:#242b34;color:#f2f5f8;border-color:#46515e}
body.dark #py2-tutorial-modal p{color:#c0cad5}
body.dark #py2-tutorial-modal .tutorial-step-list button{background:#303944;color:#dce5ef;border-color:#4a5664}
body.dark #py2-tutorial-modal .tutorial-step-list button.active{background:#315d91;color:#fff}
body.dark #py2-tutorial-modal .tutorial-close,body.dark #py2-tutorial-modal .tutorial-secondary{background:#343d48;color:#f2f5f8;border-color:#4a5664}
body.dark #py2-tutorial-modal .tutorial-next-action{background:#3a302b;border-color:#69503f;color:#fff}
@media(max-width:520px){#py2-tutorial-backdrop{padding:10px}#py2-tutorial-modal{padding:17px;border-radius:16px}#py2-tutorial-modal h2{font-size:19px}}
`;document.head.append(style);
const back=document.createElement('div');back.id='py2-tutorial-backdrop';back.innerHTML='<section id="py2-tutorial-modal" role="dialog" aria-modal="true" aria-labelledby="py2-tutorial-title"><div class="tutorial-top"><div><div class="tutorial-kicker">PHONEYA2 PARTNER STUDIO</div><h2 id="py2-tutorial-title">Quick business setup</h2></div><button type="button" class="tutorial-close" id="py2-tutorial-close" aria-label="Close tutorial">×</button></div><p id="py2-tutorial-body"></p><div class="tutorial-progress"><span id="py2-tutorial-progress"></span></div><div class="tutorial-meta" id="py2-tutorial-meta"></div><div class="tutorial-next-action"><small>YOUR NEXT RECOMMENDED MOVE</small><b id="py2-tutorial-recommendation"></b></div><div class="tutorial-step-list" id="py2-tutorial-steps"></div><div class="tutorial-actions"><button type="button" class="tutorial-secondary" id="py2-tutorial-close-bottom">Close</button><button type="button" class="tutorial-secondary" id="py2-tutorial-open">Open this section</button><button type="button" class="tutorial-primary" id="py2-tutorial-next">Continue</button></div></section>';
document.body.append(back);modal=back;
const close=()=>{back.classList.remove('open');dismissed=true;save();};
back.querySelector('#py2-tutorial-close').onclick=close;back.querySelector('#py2-tutorial-close-bottom').onclick=close;
back.addEventListener('click',e=>{if(e.target===back)close();});
back.querySelector('#py2-tutorial-open').onclick=()=>{const x=steps[step];close();go(x.section,x.target);};
back.querySelector('#py2-tutorial-next').onclick=async()=>{completed.add(steps[step].key);if(step<steps.length-1){step++;render();await save();}else{dismissed=true;await save();close();}};
back.querySelector('#py2-tutorial-steps').onclick=e=>{const b=e.target.closest('[data-step]');if(b){step=Number(b.dataset.step);render();}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&back.classList.contains('open'))close();});
}
function render(){if(!modal)return;const x=steps[step],done=completed.size;modal.querySelector('#py2-tutorial-title').textContent=x.title;modal.querySelector('#py2-tutorial-body').textContent=x.body;modal.querySelector('#py2-tutorial-meta').textContent='STEP '+(step+1)+' OF '+steps.length+' · '+done+' COMPLETED';modal.querySelector('#py2-tutorial-progress').style.width=(done/steps.length*100)+'%';modal.querySelector('#py2-tutorial-recommendation').textContent=nextAction();modal.querySelector('#py2-tutorial-next').textContent=step===steps.length-1?'Finish tutorial':'Mark done & continue';modal.querySelector('#py2-tutorial-steps').innerHTML=steps.map((v,i)=>'<button type="button" data-step="'+i+'" class="'+(i===step?'active':'')+'">'+(completed.has(v.key)?'✓ ':'')+(i+1)+'. '+v.title+'</button>').join('');}
function open(){ensureModal();render();dismissed=false;modal.classList.add('open');modal.querySelector('#py2-tutorial-close').focus();}
async function boot(){const btn=$('#floating-guide');if(btn){btn.onclick=null;btn.innerHTML='?<span class="sr-only">Tutorial</span>';btn.title='Open the Partner Studio tutorial';btn.setAttribute('aria-label','Open the Partner Studio tutorial');btn.addEventListener('click',open);}
let response;for(let i=0;i<10;i++){if(!$('#app')||$('#app').classList.contains('hidden')){await new Promise(r=>setTimeout(r,450));continue;}try{response=await fetch('/api/partner',{credentials:'same-origin',cache:'no-store'});if(response.ok)break;}catch{}await new Promise(r=>setTimeout(r,450));}
if(!response?.ok)return;partnerData=await response.json();const saved=partnerData.onboarding||{};completed=new Set(Array.isArray(saved.completed_steps)?saved.completed_steps:[]);dismissed=!!saved.dismissed;ensureModal();render();if(!dismissed&&completed.size<steps.length){modal.classList.add('open');}
}
let started=false;function startIfReady(){if(started)return;const app=$('#app');if(app&&!app.classList.contains('hidden')){started=true;boot();}}
const observer=new MutationObserver(startIfReady);observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startIfReady,{once:true});else startIfReady();
})();