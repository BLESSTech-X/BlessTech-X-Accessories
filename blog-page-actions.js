(function(){
'use strict';
var input=document.getElementById('blog-header-search'),button=document.getElementById('blog-header-search-btn');
function search(){var q=input&&input.value.trim();if(q)location.href='/shop.html?q='+encodeURIComponent(q);else if(input)input.focus()}
if(button)button.addEventListener('click',search);if(input)input.addEventListener('keydown',function(e){if(e.key==='Enter')search()});
var share=document.getElementById('share-blog-button');if(share)share.addEventListener('click',function(){var data={title:'PhoneYa2 Blog',text:'Useful phone-accessory tips, product discoveries and free advertising for Zambian businesses.',url:'https://phoneya2.pages.dev/blog.html'};if(navigator.share)navigator.share(data).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(data.url).then(function(){share.textContent='Link copied ✓'}).catch(function(){location.href='mailto:?subject='+encodeURIComponent(data.title)+'&body='+encodeURIComponent(data.url)});else location.href='mailto:?subject='+encodeURIComponent(data.title)+'&body='+encodeURIComponent(data.url)});
})();