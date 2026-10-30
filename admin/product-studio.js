/* PhoneYa2 Command Centre — embedded business workspaces */
(function(){
  'use strict';
  function boot(){
    var inventory=document.getElementById('view-inventory');
    var modal=document.getElementById('workspace-modal');
    var frame=document.getElementById('workspace-modal-frame');
    if(!inventory||!modal||!frame||inventory.dataset.productStudioReady)return;
    inventory.dataset.productStudioReady='1';
    var panel=document.createElement('section');
    panel.className='panel section py2-product-studio';
    panel.innerHTML='<div class="py2-studio-head"><div class="py2-studio-copy"><span class="py2-studio-eyebrow">STORE OPERATIONS</span><h2>Product & Content Studio</h2><p>Manage the catalogue, publishing and homepage content from one workspace.</p></div><span class="py2-studio-status"><i></i> CMS CONNECTED</span></div>'+
      '<div class="py2-studio-actions">'+
      '<button type="button" class="py2-studio-action primary" data-cms-url="/admin/#/collections/products/new" data-cms-title="Add a product"><span class="py2-studio-icon">＋</span><span><strong>Add a product</strong><small>Create a new product listing</small></span><b>↗</b></button>'+
      '<button type="button" class="py2-studio-action" data-cms-url="/admin/#/collections/products" data-cms-title="Manage product catalogue"><span class="py2-studio-icon">▦</span><span><strong>Manage products</strong><small>Edit prices, stock, images and offers</small></span><b>↗</b></button>'+
      '<button type="button" class="py2-studio-action" data-cms-url="/admin/#/collections/blog_posts/new" data-cms-title="Write a blog post"><span class="py2-studio-icon">✎</span><span><strong>Write a post</strong><small>Publish buying guides and updates</small></span><b>↗</b></button>'+
      '<button type="button" class="py2-studio-action" data-cms-url="/admin/#/collections/site_content" data-cms-title="Manage homepage and site content"><span class="py2-studio-icon">⌘</span><span><strong>Site content</strong><small>Homepage wording and promotions</small></span><b>↗</b></button></div>'+
      '<div class="py2-studio-foot"><span>Publishing workflow</span><strong>Decap CMS <b>→</b> GitHub <b>→</b> Live storefront</strong></div>';
    inventory.insertBefore(panel,inventory.firstChild);
    panel.addEventListener('click',function(e){
      var button=e.target.closest('[data-cms-url]');
      if(!button)return;
      var url=button.getAttribute('data-cms-url');
      document.getElementById('workspace-modal-title').textContent=button.getAttribute('data-cms-title')||'PhoneYa2 workspace';
      document.getElementById('workspace-modal-subtitle').textContent='Manage PhoneYa2 content inside the Command Centre';
      var newtab=document.getElementById('workspace-modal-newtab');
      if(newtab)newtab.href=url;
      frame.title=(button.getAttribute('data-cms-title')||'PhoneYa2')+' — direct management';
      frame.src=url;
      modal.classList.add('open');
      modal.setAttribute('aria-hidden','false');
      document.body.classList.add('py2-management-open');
      document.body.style.overflow='hidden';
      var close=document.getElementById('workspace-modal-close');
      if(close)close.focus();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  var attempts=0,wait=setInterval(function(){attempts++;boot();if(document.getElementById('view-inventory')||attempts>40)clearInterval(wait);},250);
})();
