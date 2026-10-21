/* PhoneYa2 Content Studio — lightweight navigation layer for Decap CMS. */
(function () {
  "use strict";
  const navItems = [
    { label: "Products", icon: "▣", match: ["Products"] },
    { label: "Blog & Updates", icon: "✎", match: ["Blog & Updates", "Blog Posts"] },
    { label: "Website Content", icon: "⌘", match: ["Website Content", "Site Content"] },
    { label: "Comments", icon: "◉", match: ["Blog Comments", "Comments"] }
  ];
  const actionRules = [
    { key: "publish", label: "Publish", test: /\bpublish\b/i },
    { key: "save", label: "Save", test: /\bsave\b/i },
    { key: "preview", label: "Preview", test: /\bpreview\b/i },
    { key: "unpublish", label: "Unpublish", test: /\bunpublish\b/i },
    { key: "delete", label: "Delete", test: /\bdelete\b/i },
    { key: "status", label: "Status", test: /\b(draft|review|published|status|workflow)\b/i },
    { key: "more", label: "More", test: /\b(more options|entry actions|actions)\b/i }
  ];
  function actionText(el) {
    return [
      el.innerText,
      el.textContent,
      el.getAttribute("aria-label"),
      el.getAttribute("title"),
      el.getAttribute("data-testid")
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  function syncEditorActions() {
    const area = document.getElementById("py2-editor-actions-area");
    if (!area) return;
    const candidates = Array.from(document.querySelectorAll("button,a,[role='button'],[role='menuitem']"))
      .filter((el) => !el.closest("#py2-studio-header") && el.offsetParent !== null);
    const found = [];
    for (const rule of actionRules) {
      const native = candidates.find((el) => {
        const text = actionText(el);
        if (!text || text.length > 90) return false;
        if (!rule.test.test(text)) return false;
        // Prefer compact controls from Decap's app header/editor toolbar, not content fields.
        return !!el.closest("[class*='AppHeader'],[class*='EditorControlBar'],[class*='EditorToolbar'],[class*='Workflow']");
      });
      if (native) found.push({ rule, native, text: actionText(native) });
    }
    const signature = found.map(({rule, text}) => rule.key + ":" + text).join("|");
    if (area.dataset.signature === signature) return;
    area.dataset.signature = signature;
    area.replaceChildren();
    found.forEach(({rule, native, text}) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "py2-editor-action";
      button.dataset.actionKey = rule.key;
      button.textContent = rule.key === "status" ? (text.match(/draft|review|published|status|workflow/i)?.[0] || "Status") : rule.label;
      button.setAttribute("aria-label", rule.label + " entry");
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        // Click the real Decap control so its React handlers and menus remain intact.
        native.click();
      });
      area.appendChild(button);
    });
    area.classList.toggle("has-actions", found.length > 0);
  }
  const nativeClick = (labels) => {
    const candidates = Array.from(document.querySelectorAll("a,button,[role='button'],[role='menuitem']"));
    const target = candidates.find((el) => {
      if (el.closest("#py2-studio-header")) return false;
      const text = (el.innerText || el.getAttribute("aria-label") || el.title || "").trim().replace(/\s+/g, " ");
      return labels.some((label) => text === label || text.toLowerCase() === label.toLowerCase() || text.toLowerCase().startsWith(label.toLowerCase() + " "));
    });
    if (target) { target.click(); return true; }
    return false;
  };
  function install() {
    if (!document.body || document.getElementById("py2-studio-header")) return;
    // Do not cover the sign-in screen.
    const app = document.querySelector("[class*='AppHeader'],[class*='AppMainContainer'],#nc-root > div");
    if (!app) return;
    const header = document.createElement("header");
    header.id = "py2-studio-header";
    header.innerHTML = `
      <a class="py2-studio-brand" href="/admin/" aria-label="PhoneYa2 Content Studio home">
        <span class="py2-brand-mark">PY<span>2</span></span>
        <span class="py2-brand-copy"><strong>PhoneYa2</strong><small>CONTENT STUDIO</small></span>
      </a>
      <nav class="py2-studio-tabs" aria-label="Content sections">
        ${navItems.map((item, i) => `<button type="button" class="py2-studio-tab" data-nav="${i}"><span aria-hidden="true">${item.icon}</span><span>${item.label}</span></button>`).join("")}
      </nav>
      <div class="py2-studio-actions">
        <div class="py2-editor-actions-area" id="py2-editor-actions-area" aria-label="Entry publishing actions"></div>
        <a class="py2-view-site" href="/" target="_blank" rel="noopener">View site ↗</a>
        <button type="button" class="py2-menu-toggle" aria-expanded="false" aria-controls="py2-studio-menu" aria-label="Open studio menu"><span></span><span></span><span></span></button>
      </div>
      <div id="py2-studio-menu" class="py2-studio-menu" hidden>
        <div class="py2-menu-heading">QUICK ACCESS</div>
        ${navItems.map((item, i) => `<button type="button" data-menu-nav="${i}">${item.icon} <span>${item.label}</span><b>›</b></button>`).join("")}
        <a href="/" target="_blank" rel="noopener">↗ <span>Open public website</span><b>›</b></a>
        <div class="py2-menu-tip">Changes are saved to PhoneYa2’s content repository.</div>
      </div>`;
    document.body.appendChild(header);
    syncEditorActions();
    const actionObserver = new MutationObserver(() => syncEditorActions());
    actionObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label", "title", "disabled"] });
    window.setInterval(syncEditorActions, 1200);
    const route = (index) => {
      const item = navItems[index];
      if (!item) return;
      const ok = nativeClick(item.match);
      if (!ok) {
        const slug = ["products", "blog_posts", "site_content", "blog_comments"][index];
        if (slug) window.location.hash = "#/collections/" + slug;
      }
      header.querySelector("#py2-studio-menu").hidden = true;
      header.querySelector(".py2-menu-toggle").setAttribute("aria-expanded", "false");
    };
    header.querySelectorAll("[data-nav]").forEach((button) => button.addEventListener("click", () => route(Number(button.dataset.nav))));
    header.querySelectorAll("[data-menu-nav]").forEach((button) => button.addEventListener("click", () => route(Number(button.dataset.menuNav))));
    const toggle = header.querySelector(".py2-menu-toggle");
    toggle.addEventListener("click", () => {
      const menu = header.querySelector("#py2-studio-menu");
      menu.hidden = !menu.hidden;
      toggle.setAttribute("aria-expanded", String(!menu.hidden));
    });
    document.addEventListener("click", (event) => {
      if (!header.contains(event.target)) {
        header.querySelector("#py2-studio-menu").hidden = true;
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        header.querySelector("#py2-studio-menu").hidden = true;
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    const updateActive = () => {
      const hash = window.location.hash.toLowerCase();
      let active = -1;
      if (hash.includes("products")) active = 0;
      else if (hash.includes("blog_posts")) active = 1;
      else if (hash.includes("site_content")) active = 2;
      else if (hash.includes("blog_comments")) active = 3;
      header.querySelectorAll("[data-nav]").forEach((button, i) => button.classList.toggle("is-active", i === active));
    };
    window.addEventListener("hashchange", updateActive);
    updateActive();
  }
  const observer = new MutationObserver(() => { install(); syncEditorActions(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
  window.setTimeout(() => { install(); syncEditorActions(); }, 1200);
})();