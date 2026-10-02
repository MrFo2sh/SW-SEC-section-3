# ACME Press — Recon Lab (Crawler + ffuf)

A deliberately *mappable* Node.js web app for practicing web reconnaissance.
You will map it two ways and see why you need **both**:

1. a **crawler** — follows links, maps the *visible* site (and the forms
   hidden inside pages);
2. a **fuzzer (ffuf)** — guesses paths, finds pages that are **not navigable
   from the UI at all**.

> ⚠️ Lab target. Run it locally and only attack your own copy.

---

## 1. Run the app

Node.js only, no extra packages:

```bash
npm start
# -> ACME Press recon lab: http://localhost:3000
```

Open <http://localhost:3000> and click around. Everything in the navbar is the
*linked* surface. A lot is **not** in the navbar.

---

## 2. Three kinds of surface in this app

| # | Surface | Example | Found by |
|---|---------|---------|----------|
| 1 | **Linked pages** | `/catalog`, `/product/3`, `/blog/why-fuzz` | crawler (follows `<a href>`) |
| 2 | **Hidden-in-page forms** | footer newsletter form; a `display:none` feedback form; per-product review & per-post comment forms | crawler (parses `<form>` from HTML even when the UI hides it) |
| 3 | **Unlinked pages** | `/admin`, `/dev`, `/api/keys` … nothing links to them | **ffuf only** |

The key idea: **the UI hiding something ≠ it being gone from the HTTP surface.**
A hidden form is still in the source. An unlinked page is still one request away.

---

## 3. Map the LINKED surface with the crawler

```bash
python crawler.py http://localhost:3000 -o acme.json
```

Open `acme.json` and inspect:

| Field | What to notice |
|-------|----------------|
| `pages`, `links` | every page reachable by clicking (home, catalog, each product, blog, each post, …) |
| `forms` | login, register, contact, search **+ the footer newsletter form, the `display:none` feedback form, and every product/blog form** — the crawler lists them all with their input names |
| `emails`, `phones` | contacts leaked in page text / footer |
| `comments` | **developer HTML comments** — read them; they name hidden areas |

👉 Notice the crawler reports forms you never *saw* in the browser (the hidden
footer/feedback ones). That is surface #2.

---

## 4. Find the UNLINKED pages with ffuf

Nothing links to these, so no crawler reaches them. Brute-force the path with a
wordlist (SecLists `common.txt`):

```bash
ffuf -u http://localhost:3000/FUZZ \
     -w /usr/share/seclists/Discovery/Web-Content/common.txt \
     -mc 200 -ic -c
```

- `-mc 200` — show real hits only · `-ic` — ignore wordlist comments · `-c` — colour

Then fuzz a *second level* you only learn about from the `/api` hit:

```bash
ffuf -u http://localhost:3000/api/FUZZ \
     -w /usr/share/seclists/Discovery/Web-Content/common.txt -mc 200 -ic -c
```

Each hit carries a `FLAG{...}`. Some unlinked pages (e.g. `/admin`, `/uploads`,
`/dev`) contain their **own forms** — forms the crawler could never have seen,
because it could never reach the page.

Also read the manual source the crawler skips:

```bash
curl http://localhost:3000/robots.txt
```

---

## 5. The lesson

| Tool | Finds | Misses |
|------|-------|--------|
| **Crawler** | linked pages, assets, emails, comments, **all forms in reachable pages (even hidden ones)** | anything not linked |
| **ffuf** | unlinked paths from a wordlist (and deeper levels like `/api/*`) | anything not in the wordlist |
| **robots.txt / comments** | paths the owner *named* | the rest |

Real recon = **crawl first** (understand the app, harvest hints + forms), **then
fuzz** (uncover what they never linked).

---

## 6. Exercises

1. In `acme.json → forms`, find the two forms that do **not** appear anywhere
   in the rendered UI. Where are they in the HTML, and why did the crawler
   still catch them?
2. Three HTML comments name hidden areas. List them, then confirm with `curl`.
3. Run ffuf. How many unlinked pages exist? Collect every flag.
4. Fuzz `/api/FUZZ`. Which endpoint leaks a credential?
5. `robots.txt` lists 3 paths. Is anything hidden that is **not** in
   robots.txt? What does that teach you about trusting robots.txt for recon?
6. Which unlinked pages contain their own forms? Why are those especially
   dangerous that a crawler would never report them?

---

<details>
<summary>Instructor answer key (hide from students)</summary>

**Hidden-in-page forms (surface #2):** footer `/newsletter` form and the
`display:none` `/feedback` form (both in the shared layout), plus every
`/product/:id/review` and `/blog/:slug/comment` form.

**Unlinked pages (surface #3, all `common.txt` entries):**
`/admin`, `/admin/login`, `/dashboard`, `/portal`, `/backup`, `/config`,
`/dev`, `/debug`, `/staging`, `/beta`, `/internal`, `/private`, `/old`,
`/test`, `/uploads`, `/phpinfo`, `/server-status`, `/api` → ~18 flags, plus
`/api/users`, `/api/config`, `/api/keys` (the last leaks `FLAG{fuzz_api_keys}`).

**Unlinked pages that contain forms:** `/admin` & `/admin/login` (staff login),
`/uploads` (file upload), `/dev` (run-task).

**Comment hints:** home → `/dev`, `/api`, `/admin`; `/about` & blog post
`robots-and-comments` → `/old`; `/login` → `/admin/login`. `robots.txt` names
only `/admin`, `/backup`, `/config` — a small subset; fuzzing reveals the rest.
</details>
