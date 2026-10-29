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
    panel.style.cssText='margin:0 0 16px;padding:20px;border:1px solid #e7eaf1;border-radius:15px;background:#fff;box-shadow:0 5px 24px #1c254008';
    panel.innerHTML='<div style="display:flex;gap:14px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap"><div><div style="font-size:10px;font-weight:900;letter-spacing:1.6px;color:#ff6500;text-transform:uppercase">Store operations</div><h2 style="font-size:19px;letter-spacing:-.4px;margin:4px 0">Product & Content Studio</h2><p style="margin:0;color:#747b8e;font-size:12px;max-width:650px">Add products, update prices and stock, publish blog posts, and manage homepage promotions without leaving this Command Centre. Work opens in an in-page workspace.</p></div><span style="background:#fff0e6;color:#b84b00;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:900">CMS CONNECTED</span></div><div class="py2-studio-actions" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;margin-top:17px"><button type="button" data-cms-url="/admin/#/collections/products/new" data-cms-title="Add a product" style="border:0;border-radius:10px;background:#ff6500;color:#fff;padding:13px;text-align:left;font-weight:850;cursor:pointer">＋ Add a product <span style="display:block;font-size:11px;font-weight:500;opacity:.88;margin-top:4px">Create a new product listing</span></button><button type="button" data-cms-url="/admin/#/collections/products" data-cms-title="Manage product catalogue" style="border:1px solid #e7eaf1;border-radius:10px;background:#fff;color:#151827;padding:13px;text-align:left;font-weight:850;cursor:pointer">▦ Manage products <span style="display:block;font-size:11px;font-weight:500;color:#747b8e;margin-top:4px">Edit prices, stock, images and offers</span></button><button type="button" data-cms-url="/admin/#/collections/blog_posts/new" data-cms-title="Write a blog post" style="border:1px solid #e7eaf1;border-radius:10px;background:#fff;color:#151827;padding:13px;text-align:left;font-weight:850;cursor:pointer">✎ Write a post <span style="display:block;font-size:11px;font-weight:500;color:#747b8e;margin-top:4px">Create buying guides and updates</span></button><button type="button" data-cms-url="/admin/#/collections/site_content" data-cms-title="Manage homepage and site content" style="border:1px solid #e7eaf1;border-radius:10px;background:#fff;color:#151827;padding:13px;text-align:left;font-weight:850;cursor:pointer">⌘ Site content <span style="display:block;font-size:11px;font-weight:500;color:#747b8e;margin-top:4px">Homepage wording and promotions</span></button></div><p style="font-size:11px;color:#747b8e;margin:13px 0 0">Publishing still uses your existing CMS and GitHub workflow; this workspace keeps it inside the Command Centre instead of opening a separate tab.</p>';
    inventory.insertBefore(panel,inventory.firstChild);
    panel.addEventListener('click',function(e){
      var button=e.target.closest('[data-cms-url]');
      if(!button)return;
      var url=button.getAttribute('data-cms-url');
      document.getElementById('workspace-modal-title').textContent=button.getAttribute('data-cms-title')||'PhoneYa2 workspace';
      document.getElementById('workspace-modal-subtitle').textContent='Manage PhoneYa2 content inside the Command Centre';
      var newtab=document.getElementById('workspace-modal-newtab');
      if(newtab)newtab.href=url;
      frame.src=url;
      modal.classList.add('open');
      document.body.style.overflow='hidden';
      var close=document.getElementById('workspace-modal-close');
      if(close)close.focus();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  var attempts=0,wait=setInterval(function(){attempts++;boot();if(document.getElementById('view-inventory')||attempts>40)clearInterval(wait);},250);
})();
