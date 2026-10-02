#!/usr/bin/env node
/*
 * ACME Press — Recon Lab.  Run:  npm start   (then http://localhost:3000)
 * Zero runtime dependencies (Node's built-in http only).
 *
 * Three kinds of "attack surface" are built in, so students see the
 * difference between a CRAWLER and a FUZZER:
 *
 *   1. LINKED pages         -> reachable from the navbar / in-page links.
 *                              A crawler follows these.
 *   2. HIDDEN-in-page forms  -> forms that EXIST in a page's HTML but are
 *                              not visible in the UI (display:none, or only
 *                              in the footer). The UI "hides" them, but they
 *                              are in the source -> a crawler still finds them.
 *   3. UNLINKED pages        -> no link anywhere points to them. A crawler
 *                              NEVER reaches them. Only fuzzing (ffuf +
 *                              common.txt) finds them. Some of THESE pages
 *                              contain their own (dangerous) forms.
 *
 * Lab target only. Attack your own copy.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");

/* ----------------------------------------------------------------- data -- */
const products = [
  { id: 1, title: "The Art of Recon", price: 29, tag: "bestseller" },
  { id: 2, title: "Fuzzing for Fun", price: 34, tag: "new" },
  { id: 3, title: "Crawlers & Spiders", price: 19, tag: "" },
  { id: 4, title: "HTTP From Scratch", price: 24, tag: "" },
  { id: 5, title: "Web Auth Deep Dive", price: 39, tag: "new" },
  { id: 6, title: "Secrets in Source", price: 27, tag: "" },
];
const posts = [
  {
    slug: "welcome",
    title: "Welcome to our new site",
    body: "We just migrated. Some old pages may linger.",
  },
  {
    slug: "recon-101",
    title: "Recon 101",
    body: "Mapping a site starts with crawling the links.",
  },
  {
    slug: "why-fuzz",
    title: "Why fuzzing matters",
    body: "Not everything is linked. Fuzz to find the rest.",
  },
  {
    slug: "forms-everywhere",
    title: "Forms are everywhere",
    body: "Even forms you can't see are still in the HTML.",
  },
  {
    slug: "robots-and-comments",
    title: "What robots.txt reveals",
    body: "Owners name paths they want hidden. Ironic.",
  },
];

/* --------------------------------------------------------------- layout -- */
/* The footer carries a (subtle) newsletter form + a display:none feedback
 * form. Both are HIDDEN-in-page forms: not obvious in the UI, but present in
 * the HTML -> a crawler that parses <form> still extracts them. */
function layout(title, body, hint = "") {
  const nav = [
    "/",
    "/catalog",
    "/blog",
    "/about",
    "/search",
    "/contact",
    "/login",
    "/register",
  ]
    .map((h) => `<a href="${h}">${h === "/" ? "Home" : h.slice(1)}</a>`)
    .join("");
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — ACME Press</title><link rel="stylesheet" href="/style.css"></head>
<body>
<!-- ${hint} -->
<header class="nav">
  <a class="brand" href="/"><img src="/logo.svg" alt="ACME Press" width="28" height="28"> ACME Press</a>
  <nav>${nav}</nav>
</header>
<main class="wrap">${body}</main>
<footer class="foot">
  <form class="mini" action="/newsletter" method="post" aria-label="newsletter">
    <input type="email" name="email" placeholder="newsletter email">
    <button>Subscribe</button>
  </form>
  <!-- beta feedback widget: disabled in UI, still shipped in HTML -->
  <form style="display:none" action="/feedback" method="post" aria-label="feedback">
    <input type="text" name="rating"><textarea name="comments"></textarea><button>Send</button>
  </form>
  <p>ACME Press · hello@acme.local · support@acme.local · +20 100 123 4567</p>
  <script src="/app.js"></script>
</footer>
</body></html>`;
}
const page = (t, b, h) => layout(t, b, h);

/* -------------------------------------------------- linked public pages -- */
function home() {
  return page(
    "Home",
    `<h1>Welcome to ACME Press</h1>
     <p>We publish books, zines, and the occasional CTF.</p>
     <div class="cards">
       <a class="card" href="/catalog"><h3>Catalog</h3><p>${products.length} titles.</p></a>
       <a class="card" href="/blog"><h3>Blog</h3><p>${posts.length} posts.</p></a>
       <a class="card" href="/contact"><h3>Contact</h3><p>Say hello.</p></a>
     </div>`,
    "DEV: staging tools under /dev, JSON API under /api, admin at /admin — remove before launch!",
  );
}
function catalog() {
  const items = products
    .map(
      (p) =>
        `<li><a href="/product/${p.id}">${p.title}</a> — $${p.price} ${p.tag ? `<em>(${p.tag})</em>` : ""}</li>`,
    )
    .join("");
  return page("Catalog", `<h1>Catalog</h1><ul class="list">${items}</ul>`);
}
function product(id) {
  const p = products.find((x) => x.id === id);
  if (!p) return null;
  return page(
    p.title,
    `<h1>${p.title}</h1><p class="price">$${p.price}</p>
     <p>A fine title for any shelf.</p>
     <h3>Leave a review</h3>
     <form action="/product/${p.id}/review" method="post">
       <input name="reviewer" placeholder="your name">
       <input name="stars" type="number" min="1" max="5" placeholder="1-5">
       <textarea name="review" placeholder="your review"></textarea>
       <button>Post review</button>
     </form>
     <p><a href="/catalog">← back to catalog</a></p>`,
  );
}
function blog() {
  const items = posts
    .map((p) => `<li><a href="/blog/${p.slug}">${p.title}</a></li>`)
    .join("");
  return page("Blog", `<h1>Blog</h1><ul class="list">${items}</ul>`);
}
function blogPost(slug) {
  const p = posts.find((x) => x.slug === slug);
  if (!p) return null;
  return page(
    p.title,
    `<h1>${p.title}</h1><p>${p.body}</p>
     <h3>Comments</h3>
     <form action="/blog/${p.slug}/comment" method="post">
       <input name="author" placeholder="name">
       <textarea name="comment" placeholder="comment"></textarea>
       <button>Comment</button>
     </form>
     <p><a href="/blog">← all posts</a></p>`,
    p.slug === "robots-and-comments"
      ? "see also the archived site under /old"
      : "",
  );
}
const staticPages = {
  "/about": page(
    "About",
    `<h1>About ACME Press</h1><p>Founded 2011. Editor: editor@acme.local, +20 109 876 5432.</p>
     <p>Site recently migrated — some <b>old</b> pages may still exist.</p>`,
    "legacy content archived under /old",
  ),
  "/contact": page(
    "Contact",
    `<h1>Contact us</h1>
     <form action="/contact" method="post">
       <input name="name" placeholder="name"><input name="email" type="email" placeholder="email">
       <textarea name="message" placeholder="message"></textarea><button>Send</button>
     </form>`,
  ),
  "/login": page(
    "Login",
    `<h1>Member login</h1>
     <form action="/login" method="post">
       <input name="username" placeholder="username"><input name="password" type="password" placeholder="password">
       <button>Sign in</button>
     </form>`,
    "staff admin login is NOT here — it's at /admin/login",
  ),
  "/register": page(
    "Register",
    `<h1>Create an account</h1>
     <form action="/register" method="post">
       <input name="username" placeholder="username"><input name="email" type="email" placeholder="email">
       <input name="password" type="password" placeholder="password">
       <input name="confirm" type="password" placeholder="confirm password"><button>Register</button>
     </form>`,
  ),
  "/search": page(
    "Search",
    `<h1>Search</h1>
     <form action="/search" method="get">
       <input name="q" placeholder="search titles"><button>Search</button>
     </form>`,
  ),
};

/* ---------------------------------------- hidden (UNLINKED) pages: ffuf -- */
/* keys are real SecLists common.txt entries. Some carry their own forms. */
function found(name, note, extra = "") {
  return page(
    name,
    `<h1>🔓 /${name}</h1>
     <p class="ok">Not linked anywhere — a crawler never reaches this.
     You found it by <b>fuzzing</b>.</p>
     <p>${note}</p>${extra}
     <p class="flag">FLAG{fuzz_${name.replace(/[^a-z0-9]/gi, "_")}}</p>`,
  );
}
const adminLoginForm = `<h3>Staff login</h3>
   <form action="/admin/login" method="post">
     <input name="user" placeholder="admin user"><input name="pass" type="password" placeholder="pass">
     <button>Enter</button></form>`;
const uploadForm = `<h3>Upload</h3>
   <form action="/uploads" method="post" enctype="multipart/form-data">
     <input type="file" name="file"><button>Upload</button></form>`;
const runForm = `<h3>Run maintenance task</h3>
   <form action="/dev/run" method="post">
     <input name="cmd" placeholder="task name"><button>Run</button></form>`;

const hidden = {
  admin: found(
    "admin",
    "Admin dashboard — jackpot in a real test. Note the unlinked staff login below.",
    adminLoginForm,
  ),
  "admin/login": found(
    "admin/login",
    "A login FORM on an unlinked page — the crawler never saw this form.",
    adminLoginForm,
  ),
  dashboard: found("dashboard", "Internal dashboard."),
  portal: found("portal", "Partner portal."),
  backup: found("backup", "Backups in webroot often hold source / creds."),
  config: found("config", "Config files leak DB strings and API keys."),
  dev: found(
    "dev",
    "Unhardened dev build (the home comment hinted at it).",
    runForm,
  ),
  debug: found("debug", "Debug endpoint — verbose errors."),
  staging: found("staging", "Pre-prod copy, usually weaker."),
  beta: found("beta", "Beta features toggled off in UI, still served."),
  internal: found("internal", "Intranet-only content exposed by mistake."),
  private: found("private", "Marked private, still reachable."),
  old: found("old", "Legacy pages the migration forgot (about/blog hinted)."),
  test: found("test", "Test endpoints often skip auth."),
  uploads: found("uploads", "Upload handler on an unlinked page.", uploadForm),
  phpinfo: found("phpinfo", "Classic info disclosure."),
  "server-status": found(
    "server-status",
    "Apache status — leaks live requests.",
  ),
};

/* /api is unlinked JSON; /api/<x> are unlinked too (fuzz /api/FUZZ). */
const apiIndex = JSON.stringify(
  {
    service: "acme-api",
    version: "latest",
    endpoints: ["/api/users", "/api/config", "/api/keys"],
    note: "undocumented — not linked from the site",
  },
  null,
  2,
);
const apiHidden = {
  users: JSON.stringify({ users: ["admin", "editor", "guest"] }, null, 2),
  config: JSON.stringify(
    { db: "mongodb://localhost/acme", debug: true },
    null,
    2,
  ),
  keys: JSON.stringify({ api_key: "FLAG{fuzz_api_keys}" }, null, 2),
};

const robots = `User-agent: *
Disallow: /admin
Disallow: /backup
Disallow: /config
`;

/* -------------------------------------------------------------- plumbing - */
function sendHTML(res, html, code = 200) {
  res.writeHead(code, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}
function sendJSON(res, body, code = 200) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(body);
}
function notFound(res) {
  sendHTML(
    res,
    page("Not found", `<h1>404</h1><p>No such page. Try fuzzing for it 🙂</p>`),
    404,
  );
}
function serveStatic(res, p) {
  const file = path.join(PUBLIC, p.replace(/^\/+/, ""));
  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  fs.readFile(file, (err, buf) => {
    if (err) return notFound(res);
    const t = {
      ".css": "text/css",
      ".js": "application/javascript",
      ".svg": "image/svg+xml",
    };
    res.writeHead(200, {
      "Content-Type": t[path.extname(file)] || "application/octet-stream",
    });
    res.end(buf);
  });
}
function thanks(res, where, body) {
  sendHTML(
    res,
    page(
      "Received",
      `<h1>Received</h1><p>Demo only — nothing stored.</p>
     <pre>${where} &lt;- ${body.slice(0, 300).replace(/</g, "&lt;")}</pre>
     <p><a href="/">Back home</a></p>`,
    ),
  );
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const p = u.pathname.replace(/\/+$/, "") || "/";

  if (["/style.css", "/app.js", "/logo.svg"].includes(p))
    return serveStatic(res, p);
  if (p === "/robots.txt") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end(robots);
  }

  // POST: accept every form the pages define (and the hidden ones too)
  if (req.method === "POST") {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => thanks(res, p, b));
    return;
  }

  // GET search results
  if (p === "/search" && u.searchParams.has("q")) {
    const q = u.searchParams.get("q").replace(/</g, "&lt;");
    return sendHTML(
      res,
      page("Search", `<h1>Results for "${q}"</h1><p>No matches (demo).</p>`),
    );
  }

  // linked pages
  if (p === "/") return sendHTML(res, home());
  if (p === "/catalog") return sendHTML(res, catalog());
  if (p === "/blog") return sendHTML(res, blog());
  if (staticPages[p]) return sendHTML(res, staticPages[p]);

  let m;
  if ((m = p.match(/^\/product\/(\d+)$/))) {
    const html = product(Number(m[1]));
    return html ? sendHTML(res, html) : notFound(res);
  }
  if ((m = p.match(/^\/blog\/([a-z0-9-]+)$/))) {
    const html = blogPost(m[1]);
    return html ? sendHTML(res, html) : notFound(res);
  }

  // hidden API
  if (p === "/api") return sendJSON(res, apiIndex);
  if ((m = p.match(/^\/api\/([a-z0-9_-]+)$/)) && apiHidden[m[1]])
    return sendJSON(res, apiHidden[m[1]]);

  // hidden (unlinked) pages — ffuf territory
  const key = p.replace(/^\/+/, "");
  if (hidden[key]) return sendHTML(res, hidden[key]);

  return notFound(res);
});

server.listen(
  PORT,
  () => console.log(`ACME Press recon lab: http://0.0.0.0:${PORT}`),
  "0.0.0.0",
);
