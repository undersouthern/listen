export default {
  async fetch(request) {
    const url = new URL(request.url);
    let pathname = url.pathname;

    // Chuẩn hóa root path về index.html
    if (pathname === "/" || pathname === "") {
      pathname = "/index.html";
    }

    // Xử lý route cho trang tạo smart-link trong thư mục create
    if (pathname === "/create" || pathname === "/create/") {
      pathname = "/create/index.html";
    }

    // Đảm bảo pathname luôn bắt đầu bằng dấu /
    if (!pathname.startsWith("/")) {
      pathname = "/" + pathname;
    }

    // URL file raw từ GitHub repository listen
    const githubRawUrl = `https://raw.githubusercontent.com/undersouthern/listen/main${pathname}`;

    const response = await fetch(githubRawUrl, {
      headers: {
        "User-Agent": "Cloudflare-Worker"
      }
    });

    if (!response.ok) {
      return new Response(`File not found: ${pathname}`, { 
        status: 404,
        headers: { "Content-Type": "text/plain; charset=UTF-8" }
      });
    }

    // Xác định chính xác Content-Type cho từng loại file
    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "public, max-age=300"); // Cache 5 phút

    if (pathname.endsWith(".html")) {
      headers.set("Content-Type", "text/html; charset=UTF-8");
    } else if (pathname.endsWith(".css")) {
      headers.set("Content-Type", "text/css; charset=UTF-8");
    } else if (pathname.endsWith(".js")) {
      headers.set("Content-Type", "application/javascript; charset=UTF-8");
    } else if (pathname.endsWith(".png")) {
      headers.set("Content-Type", "image/png");
    } else if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
      headers.set("Content-Type", "image/jpeg");
    } else if (pathname.endsWith(".svg")) {
      headers.set("Content-Type", "image/svg+xml");
    } else if (pathname.endsWith(".json")) {
      headers.set("Content-Type", "application/json; charset=UTF-8");
    } else {
      // Giữ nguyên content-type gốc nếu là file khác
      const originType = response.headers.get("Content-Type");
      if (originType) headers.set("Content-Type", originType);
    }

    return new Response(response.body, {
      status: 200,
      headers: headers,
    });
  },
};
