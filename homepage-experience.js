/* PhoneYa2 homepage interaction and measurement layer. */
(function(){
  'use strict';
  if(window.__phoneya2HomepageExperience)return;
  window.__phoneya2HomepageExperience=true;
  const send=(name,params)=>{
    try{if(typeof window.gtag==='function')window.gtag('event',name,Object.assign({page_type:'homepage'},params||{}));}catch(_){}
  };
  const sectionSelectors=[
    ['hero','.hero-banner'],['new_arrivals','#new-arrivals-section'],['flash_offers','#flash-section'],
    ['daily_deals','#deals-section'],['category_showcase','.cat-showcase'],['trust','.trust-row'],
    ['shopping_guide','.howto-section'],['confidence','.testimonials-section'],['more_products','#py2-endless-products']
  ];
  if('IntersectionObserver'in window){
    const seen=new Set();
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(!entry.isIntersecting)return;
        const id=entry.target.getAttribute('data-py2-track-section');
        if(id&&!seen.has(id)){seen.add(id);send('homepage_section_view',{section_id:id});}
      });
    },{threshold:.35});
    sectionSelectors.forEach(([id,selector])=>{
      const el=document.querySelector(selector);
      if(el){el.setAttribute('data-py2-track-section',id);observer.observe(el);}
    });
  }
  document.addEventListener('click',event=>{
    const target=event.target.closest('a,button');
    if(!target)return;
    const section=target.closest('[data-py2-track-section]');
    const sectionId=section&&section.getAttribute('data-py2-track-section');
    if(sectionId)send('homepage_section_click',{section_id:sectionId,action_label:(target.textContent||target.getAttribute('aria-label')||'').trim().slice(0,80),destination:target.getAttribute('href')||''});
    if(target.matches('.py2-add-cart'))send('homepage_add_to_cart',{section_id:sectionId||'product_grid'});
    if(target.matches('.btn-order,.pc-wa,.btn-hero-shop'))send('homepage_buy_intent',{section_id:sectionId||'product_grid',destination:target.getAttribute('href')||''});
    if(target.closest('.promo-banner'))send('homepage_promo_click',{destination:target.getAttribute('href')||''});
  },true);
})();