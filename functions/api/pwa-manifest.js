const APPS = {
  agent: {
    name: "PhoneYa2 Agent",
    short_name: "Agent",
    description: "Your personal PhoneYa2 sales and commission dashboard.",
    start_url: "/agents/network.html?source=installed",
    scope: "/agents/network.html",
    theme_color: "#1877f2",
    background_color: "#f4f7fb"
  },
  partner: {
    name: "PhoneYa2 Partner",
    short_name: "Partner",
    description: "Your PhoneYa2 business partner workspace.",
    start_url: "/partners-dashboard/index.html?source=installed",
    scope: "/partners-dashboard/index.html",
    theme_color: "#102b4e",
    background_color: "#f4f7fb"
  },
  command: {
    name: "PhoneYa2 Command Centre",
    short_name: "Command Centre",
    description: "Private PhoneYa2 administration workspace.",
    start_url: "/admin/command-center.html?source=installed",
    scope: "/admin/command-center.html",
    theme_color: "#101322",
    background_color: "#f5f7fb"
  }
};

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const app = APPS[url.searchParams.get("app")];
  if (!app) return new Response("Unknown PhoneYa2 app", { status: 404 });
  const suppliedIcon = url.searchParams.get("icon") || "";
  let icon = "/icon-512x512.jpg";
  if (suppliedIcon.length <= 2048) {
    try {
      const parsed = new URL(suppliedIcon, url.origin);
      if (parsed.protocol === "https:" && (parsed.origin === url.origin || suppliedIcon.startsWith("https://"))) {
        icon = parsed.href;
      }
    } catch (_) {}
  }
  const manifest = {
    ...app,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    lang: "en",
    icons: [
      { src: icon, sizes: "any", purpose: "any" },
      { src: "/icon-512x512.jpg", sizes: "512x512", type: "image/jpeg", purpose: "any" }
    ]
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}