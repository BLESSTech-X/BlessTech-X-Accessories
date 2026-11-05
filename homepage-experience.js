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

  // Clean escaped line-break markers if any CMS/product text reaches the page
  // without being decoded. This only touches rendered text/labels, never scripts.
  const cleanEscapedBreaks=value=>String(value||'').replace(/\\\\r\\\\n|\\\\n|\\\\r/g,' ').replace(/[ \\t]{2,}/g,' ').trim();
  const cleanRenderedText=root=>{
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const parent=node.parentElement;
      if(!parent||parent.closest('script,style,textarea,pre,code'))return;
      if(/\\\\[nr]/.test(node.nodeValue||''))node.nodeValue=cleanEscapedBreaks(node.nodeValue);
    });
    if(root.querySelectorAll)root.querySelectorAll('[title],[aria-label],[alt]').forEach(el=>{
      ['title','aria-label','alt'].forEach(attr=>{
        const value=el.getAttribute(attr);
        if(value&&/\\\\[nr]/.test(value))el.setAttribute(attr,cleanEscapedBreaks(value));
      });
    });
  };
  cleanRenderedText(document.body);
  if('MutationObserver'in window){
    let cleaning=false;
    const textCleanupObserver=new MutationObserver(records=>{
      if(cleaning)return;
      cleaning=true;
      records.forEach(record=>{
        record.addedNodes&&record.addedNodes.forEach(node=>{
          if(node.nodeType===Node.TEXT_NODE){
            const parent=node.parentElement;
            if(parent&&!parent.closest('script,style,textarea,pre,code')&&/\\\\[nr]/.test(node.nodeValue||''))node.nodeValue=cleanEscapedBreaks(node.nodeValue);
          }else if(node.nodeType===Node.ELEMENT_NODE)cleanRenderedText(node);
        });
      });
      cleaning=false;
    });
    textCleanupObserver.observe(document.body,{childList:true,subtree:true});
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