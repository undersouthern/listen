export default {
  async fetch(request) {
    const url = new URL(request.url);
    let pathname = url.pathname;

    if (pathname === "/" || pathname === "") {
      pathname = "/index.html";
    }

    // Kéo file trực tiếp từ repo GitHub listen
    const githubRawUrl = `https://raw.githubusercontent.com/undersouthern/listen/main${pathname}`;

    const response = await fetch(githubRawUrl);

    if (!response.ok) {
      return new Response("Not Found", { status: 404 });
    }

    const newHeaders = new Headers(response.headers);
    if (pathname.endsWith(".html")) {
      newHeaders.set("Content-Type", "text/html; charset=UTF-8");
    } else if (pathname.endsWith(".png")) {
      newHeaders.set("Content-Type", "image/png");
    } else if (pathname.endsWith(".css")) {
      newHeaders.set("Content-Type", "text/css; charset=UTF-8");
    } else if (pathname.endsWith(".js")) {
      newHeaders.set("Content-Type", "application/javascript; charset=UTF-8");
    }

    newHeaders.set("Cache-Control", "public, max-age=60");

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  },
};
