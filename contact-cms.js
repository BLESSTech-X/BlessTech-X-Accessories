(function(){
'use strict';
function setText(el,value){if(el&&value!==undefined&&value!==null)el.textContent=String(value)}
function digits(value){return String(value||'').replace(/[^0-9]/g,'')}
function boot(d){
 if(!d)return;
 setText(document.querySelector('.contact-hero h1'),d.hero_title);
 setText(document.querySelector('.contact-hero p'),d.hero_subtitle);
 setText(document.querySelector('.contact-info h2'),d.info_heading);
 setText(document.querySelector('.contact-info .subtitle'),d.info_subtitle);
 setText(document.querySelector('.contact-form-card h3'),d.form_heading);
 setText(document.querySelector('.contact-form-card .form-sub'),d.form_subtitle);
 setText(document.querySelector('.faq-section h3'),d.faq_heading);
 var phone=document.getElementById('contact-phone'),wa=document.getElementById('contact-whatsapp');
 var email=document.getElementById('contact-email'),loc=document.getElementById('contact-location'),hours=document.getElementById('contact-hours');
 setText(phone,d.phone);setText(wa,d.phone);setText(email,d.email);setText(loc,d.location);setText(hours,d.hours);
 if(wa&&wa.closest('a'))wa.closest('a').href='https://wa.me/'+digits(d.whatsapp);
 if(phone&&phone.closest('a'))phone.closest('a').href='tel:'+String(d.phone||'').replace(/[^0-9+]/g,'');
 if(email&&email.closest('a'))email.closest('a').href='mailto:'+String(d.email||'');
 var table=document.getElementById('hours-table');
 if(table&&Array.isArray(d.hours_days)){
  table.replaceChildren();var today=new Date().getDay(),todayIndex=today===0?6:today-1;
  d.hours_days.forEach(function(row,i){
   var el=document.createElement('div');el.className='hours-row'+(i===todayIndex?' today':'')+(row.open?'':' closed');
   var day=document.createElement('span');day.className='day-name';day.textContent=row.day||'';
   if(i===todayIndex){var badge=document.createElement('span');badge.style.cssText='font-size:11px;color:#16a34a;';badge.textContent=' (Today)';day.appendChild(badge)}
   var value=document.createElement('span');value.className='day-hours';value.textContent=row.hours||'';el.append(day,value);table.appendChild(el)
  })
 }
 var faq=document.querySelector('.faq-section');
 if(faq&&Array.isArray(d.faqs)){
  faq.querySelectorAll('.faq-item').forEach(function(item){item.remove()});
  d.faqs.forEach(function(row){
   var item=document.createElement('div');item.className='faq-item';
   var button=document.createElement('button');button.className='faq-question';button.type='button';button.appendChild(document.createTextNode(row.question||''));
   var icon=document.createElement('i');icon.className='fa-solid fa-chevron-down faq-chevron';button.appendChild(icon);
   var answer=document.createElement('div');answer.className='faq-answer';var inner=document.createElement('div');inner.className='faq-answer-inner';inner.textContent=row.answer||'';answer.appendChild(inner);
   button.addEventListener('click',function(){var open=item.classList.contains('open');faq.querySelectorAll('.faq-item').forEach(function(x){x.classList.remove('open')});if(!open)item.classList.add('open')});
   item.append(button,answer);faq.appendChild(item)
  })
 }
 var footer=document.querySelectorAll('footer .footer-contact-item');
 if(footer[0]){var a=footer[0].querySelector('a');if(a){a.textContent=d.phone||'';a.href='https://wa.me/'+digits(d.whatsapp)}}
 if(footer[1]){var e=footer[1].querySelector('a');if(e){e.textContent=d.email||'';e.href='mailto:'+String(d.email||'')}}
 if(footer[2])setText(footer[2].querySelector('span'),d.location);
 if(footer[3])setText(footer[3].querySelector('span'),d.hours)
}
fetch('/content/settings/contact.json?v=editable1').then(function(r){if(!r.ok)throw Error('CMS contact data unavailable');return r.json()}).then(boot).catch(function(e){console.warn('Contact page CMS content was not loaded; showing built-in fallback.',e)})
})();