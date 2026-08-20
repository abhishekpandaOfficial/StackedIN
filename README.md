# Substack Dashboard

A Vite + React dashboard for tracking Substack article views, shares, topics, imports, and LinkedIn publication status.

## Local development

```bash
npm install
npm run dev
```

The local app runs at `http://127.0.0.1:5173/` and starts the optional SQLite API automatically.

## GitHub Pages deployment

1. Create a GitHub repository named `substack_dashboard`.
2. Push this project to the repository's `main` branch.
3. In GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.
4. The workflow in `.github/workflows/deploy-pages.yml` publishes the app automatically.

The expected URL is:

```text
https://YOUR_GITHUB_USERNAME.github.io/substack_dashboard/
```

GitHub Pages is static hosting, so LinkedIn checkbox state is stored in the current browser with `localStorage`. The local SQLite API remains available for local development.
