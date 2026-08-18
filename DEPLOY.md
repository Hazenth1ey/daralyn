# Hosting on Cloudflare (daraleakhena.com)

The repo is already set up to deploy as a Cloudflare **Workers static site**
(`wrangler.jsonc` + `.github/workflows/deploy.yml`). Three one-time steps
finish the job — all in your browser, ~10 minutes.

## 1. Give GitHub permission to deploy

1. In the [Cloudflare dashboard](https://dash.cloudflare.com), copy your
   **Account ID** (Workers & Pages → overview, right-hand column).
2. Create an API token: **My Profile → API Tokens → Create Token →
   "Edit Cloudflare Workers" template**. Scope it to your account.
3. In the GitHub repo (**Settings → Secrets and variables → Actions**), add:
   - `CLOUDFLARE_API_TOKEN` — the token
   - `CLOUDFLARE_ACCOUNT_ID` — the account ID

Then re-run the "Deploy to Cloudflare Workers" workflow (Actions tab) or
push any commit. The site goes live at:

```
https://daraleakhena.<your-subdomain>.workers.dev
```

## 2. Get the domain

If you haven't registered **daraleakhena.com** yet: Cloudflare dashboard →
**Domain Registration → Register Domains** (at-cost pricing, ~US$10/yr).
If you own it elsewhere, add it: **Add a site** → follow the nameserver
instructions.

Either way you end up with a `daraleakhena.com` zone in your account.

## 3. Point the domain at the site

Uncomment the `routes` block in `wrangler.jsonc` and push:

```jsonc
"routes": [
  { "pattern": "daraleakhena.com", "custom_domain": true },
  { "pattern": "www.daraleakhena.com", "custom_domain": true }
],
```

Cloudflare creates the DNS records and TLS certificate automatically.
A minute later the site is live at **https://daraleakhena.com**.

## Alternative: no GitHub secrets

Instead of step 1 you can use **Workers Builds**: Cloudflare dashboard →
Workers & Pages → Create → **Import a repository** → pick this repo, set
"Deploy command" to `npx wrangler deploy`. Cloudflare then builds and
deploys on every push without any tokens in GitHub.

## Notes

- `.assetsignore` keeps repo files (README, workflow, config) off the
  public site.
- Guest notes on the Studio wall are still per-browser (`localStorage`).
  When you want them shared between all guests, that's a small Worker +
  KV addition — ask and it can be wired up.
