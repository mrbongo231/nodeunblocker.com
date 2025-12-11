// worker.js – Cloudflare Worker replacement for app.js

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle /proxy/ requests
    if (url.pathname.startsWith("/proxy/")) {
      const target = url.pathname.replace("/proxy/", "");
      if (!target) {
        return new Response("Missing target URL", { status: 400 });
      }

      // Forward request to target
      const proxied = await fetch(target, {
        method: request.method,
        headers: request.headers,
        body: request.method !== "GET" && request.method !== "HEAD"
          ? await request.text()
          : undefined,
      });

      // If HTML, inject GA script
      let body = proxied.body;
      const contentType = proxied.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        const text = await proxied.text();
        const gaId = env.GA_ID;
        let modified = text;
        if (gaId) {
          const ga = `
<script type="text/javascript">
var _gaq = [];
_gaq.push(['_setAccount', '${gaId}']);
_gaq.push(['_trackPageview']);
(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();
</script>`;
          modified = text.replace("</body>", ga + "\n</body>");
        }
        body = modified;
      }

      return new Response(body, {
        status: proxied.status,
        headers: proxied.headers,
      });
    }

    // Handle /no-js redirect
    if (url.pathname === "/no-js") {
      const site = url.searchParams.get("url");
      if (site) {
        return Response.redirect("/proxy/" + site, 302);
      }
    }

    // Serve static assets (Workers Sites or KV binding)
    if (url.pathname.startsWith("/public")) {
      return env.ASSETS.fetch(request);
    }

    return new Response("NodeUnblocker Worker running", { status: 200 });
  }
}
