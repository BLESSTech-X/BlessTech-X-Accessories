/* PhoneYa2 password visibility controls.
 * Works for existing and dynamically-created password inputs. Revealing a password
 * is local to the current field; it is never copied, stored, or sent anywhere.
 */
(function () {
  'use strict';
  if (window.__py2PasswordVisibilityInstalled) return;
  window.__py2PasswordVisibilityInstalled = true;

  var style = document.createElement('style');
  style.id = 'py2-password-visibility-styles';
  style.textContent = [
    '.py2-password-wrap{position:relative!important;display:block!important;width:100%!important;min-width:0!important;}',
    '.py2-password-wrap>input{padding-right:78px!important;max-width:100%;}',
    '.py2-password-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);z-index:2;display:inline-flex;align-items:center;justify-content:center;gap:5px;min-width:54px;min-height:32px;padding:5px 7px;border:0;border-radius:7px;background:transparent;color:#087f79;font:700 12px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;white-space:nowrap;}',
    '.py2-password-toggle:hover{background:rgba(15,159,143,.09);color:#075e57;}',
    '.py2-password-toggle:focus-visible{outline:2px solid #0f9f8f;outline-offset:2px;}',
    '.py2-password-toggle svg{width:15px;height:15px;flex:0 0 15px;}',
    '@media(max-width:360px){.py2-password-toggle{right:5px;min-width:48px;font-size:11px;padding-inline:5px;}.py2-password-wrap>input{padding-right:66px!important;}}'
  ].join('');
  (document.head || document.documentElement).appendChild(style);

  var eye = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var eyeOff = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a16 16 0 0 1-3 3.9M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10.8 10.8 0 0 0 4-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

  function install(input) {
    if (!(input instanceof HTMLInputElement) || input.type !== 'password' || input.dataset.py2RevealReady === '1') return;
    if (input.disabled || input.readOnly) return;
    if (input.closest('.py2-password-wrap')) return;
    input.dataset.py2RevealReady = '1';

    var wrapper = document.createElement('span');
    wrapper.className = 'py2-password-wrap';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'py2-password-toggle';
    button.innerHTML = eye + '<span>Show</span>';
    button.setAttribute('aria-label', 'Show password');
    button.setAttribute('aria-pressed', 'false');
    button.title = 'Show password';
    button.addEventListener('click', function () {
      var reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.innerHTML = (reveal ? eyeOff : eye) + '<span>' + (reveal ? 'Hide' : 'Show') + '</span>';
      button.setAttribute('aria-label', (reveal ? 'Hide' : 'Show') + ' password');
      button.setAttribute('aria-pressed', reveal ? 'true' : 'false');
      button.title = (reveal ? 'Hide' : 'Show') + ' password';
    });
    wrapper.appendChild(button);
  }

  function scan(root) {
    if (root.nodeType === 1 && root.matches && root.matches('input[type="password"]')) install(root);
    if (root.querySelectorAll) root.querySelectorAll('input[type="password"]').forEach(install);
  }

  function start() {
    scan(document);
    var observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        record.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) scan(node);
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();