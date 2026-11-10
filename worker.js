export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let pathname = url.pathname;

    // Helper kiểm tra cookie đăng nhập
    const cookieHeader = request.headers.get("Cookie") || "";
    const isAuthenticated = cookieHeader.includes("us_admin_auth=authenticated");

    // 1. Xử lý API Đăng nhập (/api/login)
    if (request.method === "POST" && pathname === "/api/login") {
      try {
        const formData = await request.formData();
        const email = formData.get("email");
        const pass = formData.get("pass");

        // Kiểm tra thông tin trong bảng admin (email: label@undersouthern.asia, pass: Vinh19061998//)
        const adminUser = await env.DB.prepare(
          "SELECT * FROM admin WHERE email = ? AND pass = ?"
        ).bind(email, pass).first();

        if (!adminUser) {
          return new Response(JSON.stringify({ success: false, error: "Email hoặc mật khẩu không chính xác!" }), {
            status: 401,
            headers: { "Content-Type": "application/json; charset=UTF-8", "Access-Control-Allow-Origin": "*" }
          });
        }

        // Đăng nhập thành công, thiết lập Cookie (tồn tại trong 7 ngày)
        const headers = new Headers({
          "Content-Type": "application/json; charset=UTF-8",
          "Access-Control-Allow-Origin": "*",
          "Set-Cookie": "us_admin_auth=authenticated; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800"
        });

        return new Response(JSON.stringify({ success: true }), { headers });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json; charset=UTF-8", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // 2. Bảo vệ các trang yêu cầu đăng nhập: /dashboard, /create, /update
    const protectedPaths = ["/dashboard", "/create", "/update"];
    const isProtected = protectedPaths.some(p => pathname === p || pathname.startsWith(p + "/"));

    if (isProtected && !isAuthenticated) {
      // Chưa đăng nhập -> Chuyển hướng về trang /signin
      return Response.redirect(new URL("/signin", request.url), 302);
    }

    // 3. Xử lý API tạo smart-link từ form Create (/api/create)
    if (request.method === "POST" && pathname === "/api/create") {
      try {
        const formData = await request.formData();
        const title = formData.get("title");
        let customUrl = formData.get("url_release");

        let url_release = "";
        let id_title = "";

        if (customUrl && customUrl.trim() !== "") {
          url_release = customUrl.trim();
          id_title = formData.get("id_title") ? formData.get("id_title").trim() : url_release;
        } else {
          function generateRandomVNCode() {
            const randomNum = Math.floor(10000 + Math.random() * 90000);
            return `VN${randomNum}`;
          }

          let uniqueCode = '';
          let isDuplicate = true;
          while (isDuplicate) {
            uniqueCode = generateRandomVNCode();
            const existing = await env.DB.prepare(
              "SELECT id_title FROM landing_page WHERE id_title = ? OR url_release = ?"
            ).bind(uniqueCode, uniqueCode).first();
            
            if (!existing) {
              isDuplicate = false;
            }
          }

          url_release = uniqueCode;
          id_title = uniqueCode;
        }

        const url_spotify = formData.get("url_spotify");
        const url_apple_music_music = formData.get("url_apple_music_music");
        const url_amazon_music = formData.get("url_amazon_music");
        const url_soundcloud = formData.get("url_soundcloud");
        const url_deezer = formData.get("url_deezer");
        const url_youtube = formData.get("url_youtube");
        const url_youtube_music = formData.get("url_youtube_music");
        const url_zingmp3 = formData.get("url_zingmp3");
        const url_nct = formData.get("url_nct");

        let cover_url = "";
        const coverImage = formData.get("cover_image");
        if (coverImage && typeof coverImage === "object" && coverImage.size > 0) {
          const safeName = coverImage.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
          const fileName = `covers/${Date.now()}-${safeName}`;
          
          const arrayBuffer = await coverImage.arrayBuffer();
          await env.MY_BUCKET.put(fileName, arrayBuffer, {
            httpMetadata: { contentType: coverImage.type }
          });
          
          const r2PublicDomain = "https://pub-3e105cf90fc140c484fbb8ece9b4271b.r2.dev";
          cover_url = `${r2PublicDomain}/${fileName}`;
        }

        await env.DB.prepare(`
          INSERT INTO landing_page (
            id_title, title, cover_url, 
            url_spotify, url_apple_music_music, url_amazon_music, 
            url_soundcloud, url_deezer, url_youtube, 
            url_youtube_music, url_zingmp3, url_nct, url_release
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id_title, title, cover_url,
          url_spotify, url_apple_music_music, url_amazon_music,
          url_soundcloud, url_deezer, url_youtube,
          url_youtube_music, url_zingmp3, url_nct, url_release
        ).run();

        return new Response(JSON.stringify({ success: true, url_release }), {
          headers: { "Content-Type": "application/json; charset=UTF-8", "Access-Control-Allow-Origin": "*" }
        });
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json; charset=UTF-8", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // 4. Xử lý API lấy danh sách tất cả các release (/api/releases)
    if (request.method === "GET" && pathname === "/api/releases") {
      try {
        const { results } = await env.DB.prepare(
          "SELECT title, url_release FROM landing_page ORDER BY rowid DESC"
        ).all();

        return new Response(JSON.stringify(results || []), {
          headers: { "Content-Type": "application/json; charset=UTF-8", "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json; charset=UTF-8", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // 5. Xử lý API lấy thông tin bài hát theo slug (/api/release/:slug)
    if (request.method === "GET" && pathname.startsWith("/api/release/")) {
      const slug = pathname.split("/").pop();
      try {
        const { results } = await env.DB.prepare(
          "SELECT * FROM landing_page WHERE url_release = ?"
        ).bind(slug).all();

        if (!results || results.length === 0) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json; charset=UTF-8", "Access-Control-Allow-Origin": "*" }
          });
        }

        return new Response(JSON.stringify(results[0]), {
          headers: { "Content-Type": "application/json; charset=UTF-8", "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json; charset=UTF-8", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // 6. Xử lý API cập nhật thông tin smart-link (/api/update/:slug)
    if (request.method === "POST" && pathname.startsWith("/api/update/")) {
      const slug = pathname.split("/").pop();
      try {
        const formData = await request.formData();
        
        const title = formData.get("title");
        const url_spotify = formData.get("url_spotify");
        const url_apple_music_music = formData.get("url_apple_music_music");
        const url_amazon_music = formData.get("url_amazon_music");
        const url_soundcloud = formData.get("url_soundcloud");
        const url_deezer = formData.get("url_deezer");
        const url_youtube = formData.get("url_youtube");
        const url_youtube_music = formData.get("url_youtube_music");
        const url_zingmp3 = formData.get("url_zingmp3");
        const url_nct = formData.get("url_nct");

        const coverImage = formData.get("cover_image");
        let updateQuery = "";
        let bindParams = [];

        if (coverImage && typeof coverImage === "object" && coverImage.size > 0) {
          const safeName = coverImage.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
          const fileName = `covers/${Date.now()}-${safeName}`;
          
          const arrayBuffer = await coverImage.arrayBuffer();
          await env.MY_BUCKET.put(fileName, arrayBuffer, {
            httpMetadata: { contentType: coverImage.type }
          });
          
          const r2PublicDomain = "https://pub-3e105cf90fc140c484fbb8ece9b4271b.r2.dev";
          const cover_url = `${r2PublicDomain}/${fileName}`;

          updateQuery = `
            UPDATE landing_page SET 
              title = ?, cover_url = ?, 
              url_spotify = ?, url_apple_music_music = ?, url_amazon_music = ?, 
              url_soundcloud = ?, url_deezer = ?, url_youtube = ?, 
              url_youtube_music = ?, url_zingmp3 = ?, url_nct = ?
            WHERE url_release = ?
          `;
          bindParams = [
            title, cover_url,
            url_spotify, url_apple_music_music, url_amazon_music,
            url_soundcloud, url_deezer, url_youtube,
            url_youtube_music, url_zingmp3, url_nct,
            slug
          ];
        } else {
          updateQuery = `
            UPDATE landing_page SET 
              title = ?, 
              url_spotify = ?, url_apple_music_music = ?, url_amazon_music = ?, 
              url_soundcloud = ?, url_deezer = ?, url_youtube = ?, 
              url_youtube_music = ?, url_zingmp3 = ?, url_nct = ?
            WHERE url_release = ?
          `;
          bindParams = [
            title,
            url_spotify, url_apple_music_music, url_amazon_music,
            url_soundcloud, url_deezer, url_youtube,
            url_youtube_music, url_zingmp3, url_nct,
            slug
          ];
        }

        await env.DB.prepare(updateQuery).bind(...bindParams).run();

        return new Response(JSON.stringify({ success: true, url_release: slug }), {
          headers: { "Content-Type": "application/json; charset=UTF-8", "Access-Control-Allow-Origin": "*" }
        });
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json; charset=UTF-8", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // 7. Định tuyến file tĩnh từ GitHub repository
    if (pathname === "/" || pathname === "" || pathname === "/dashboard" || pathname === "/dashboard/") {
      pathname = "/dashboard/index.html";
    } else {
      const pathSegments = pathname.split("/").filter(Boolean);
      if (pathSegments.length === 1 && pathSegments[0] !== "create" && pathSegments[0] !== "update" && pathSegments[0] !== "dashboard" && pathSegments[0] !== "signin" && !pathSegments[0].includes(".")) {
        pathname = "/index.html";
      }
    }

    if (pathname === "/create" || pathname === "/create/") {
      pathname = "/create/index.html";
    }

    if (pathname === "/update" || pathname === "/update/") {
      pathname = "/update/index.html";
    }

    if (pathname === "/signin" || pathname === "/signin/") {
      pathname = "/signin/index.html";
    }

    if (!pathname.startsWith("/")) {
      pathname = "/" + pathname;
    }

    const githubRawUrl = `https://raw.githubusercontent.com/undersouthern/listen/main${pathname}`;

    const response = await fetch(githubRawUrl, {
      headers: { "User-Agent": "Cloudflare-Worker" }
    });

    if (!response.ok) {
      return new Response(`File not found: ${pathname}`, { 
        status: 404,
        headers: { "Content-Type": "text/plain; charset=UTF-8" }
      });
    }

    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "public, max-age=300");

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
      const originType = response.headers.get("Content-Type");
      if (originType) headers.set("Content-Type", originType);
    }

    return new Response(response.body, { status: 200, headers: headers });
  },
};
