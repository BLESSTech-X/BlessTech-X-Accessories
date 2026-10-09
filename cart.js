/* PhoneYa2 shared cart: same storage format used by checkout.html */
(function () {
  "use strict";
  const KEY = "phoneya2-checkout-cart-v1";

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (!Array.isArray(value)) return [];
      const merged = new Map();
      value.forEach(entry => {
        if (!Array.isArray(entry) || typeof entry[0] !== "string") return;
        const slug = entry[0];
        const qty = Math.max(0, Math.min(99, Math.floor(Number(entry[1]) || 0)));
        if (/^[a-z0-9][a-z0-9-]{0,100}$/.test(slug) && qty) {
          merged.set(slug, Math.min(99, (merged.get(slug) || 0) + qty));
        }
      });
      return Array.from(merged.entries());
    } catch (_) { return []; }
  }

  function count() {
    return read().reduce((sum, entry) => sum + entry[1], 0);
  }

  function refresh() {
    const total = count();
    document.querySelectorAll("[data-cart-count]").forEach(el => {
      el.textContent = String(total);
      el.setAttribute("aria-label", total + (total === 1 ? " item in cart" : " items in cart"));
    });
  }

  function toast(message) {
    let el = document.getElementById("py2-cart-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "py2-cart-toast";
      el.setAttribute("role", "status");
      el.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translate(-50%,16px);z-index:9999;background:#171725;color:#fff;padding:12px 18px;border-radius:12px;box-shadow:0 10px 35px #0003;font:600 14px/1.4 system-ui,sans-serif;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;max-width:calc(100vw - 32px);text-align:center";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.opacity = "1";
    el.style.transform = "translate(-50%,0)";
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translate(-50%,16px)";
    }, 2400);
  }

  function add(slug, quantity, stock, title) {
    if (typeof slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,100}$/.test(slug)) {
      toast("Sorry, we couldn't add that product.");
      return false;
    }
    quantity = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)));
    stock = Math.max(0, Math.floor(Number(stock) || 0));
    if (!stock) {
      toast("This item is currently out of stock.");
      return false;
    }
    const items = new Map(read());
    const next = (items.get(slug) || 0) + quantity;
    if (next > Math.min(99, stock)) {
      toast("Only " + stock + " unit(s) available for " + (title || "this item") + ".");
      return false;
    }
    items.set(slug, next);
    try {
      localStorage.setItem(KEY, JSON.stringify(Array.from(items.entries())));
    } catch (_) {
      toast("Your browser couldn't save the cart. Please check device storage settings.");
      return false;
    }
    refresh();
    window.dispatchEvent(new CustomEvent("phoneya2:cart-updated", { detail: { slug, quantity: next } }));
    toast((title || "Product") + " added to your cart.");
    return true;
  }

  window.PhoneYa2Cart = { add, count, refresh, read };
  window.addEventListener("storage", refresh);
  window.addEventListener("phoneya2:cart-updated", refresh);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh);
  else refresh();
})();