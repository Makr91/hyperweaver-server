# Hyperweaver Server

Hyperweaver Server is the control-plane server for the Hyperweaver platform: it serves the [STARTcloud UI](https://github.com/STARTcloud/startcloud-ui) and aggregates/proxies host agents (hyperweaver-agent for VirtualBox, zoneweaver-agent for Bhyve/OmniOS) for user auth, monitoring, and browser-based console access.

## Platform Requirements

Debian/Ubuntu (the Server ships as a `.deb`):

```bash
# Build essentials for native dependencies (bcrypt)
sudo apt-get install build-essential

# Install dependencies
npm install
```

## Getting Started

The web UI is the [STARTcloud UI](https://github.com/STARTcloud/startcloud-ui), one build shared across the estate, fetched as a release artifact and served from `./ui`; it renders what `GET /api/status` advertises. The consumed version is pinned by `startcloudUiVersion` in `package.json`; every STARTcloud UI release dispatches `dependency-update` here and `.github/workflows/dependency-bump.yml` answers with a `bump/startcloud-ui` pull request for a human to merge.

For local development, fetch the pinned UI into `./ui` first:

```bash
UI_VERSION=$(node -p "require('./package.json').startcloudUiVersion")
mkdir -p ui
curl -fsSL "https://github.com/STARTcloud/startcloud-ui/releases/download/v${UI_VERSION}/startcloud-ui-${UI_VERSION}.tar.gz" | tar -xz -C ui
```

## Configuration

- Development reads `config/<name>.dev.config.yaml` for `app`, `auth`, `db` and `mail`.
- Production reads `<name>.config.yaml` under `CONFIG_DIR` (default `/etc/hyperweaver-server`), the one environment variable the server reads; the package installs each file from `/opt/hyperweaver-server/config-templates/` where absent and writes an empty `setup.token` on a fresh install, which the setup page consumes.
- Every file is served and written at `/api/config/<name>`, its JSON Schema at `/api/config/<name>/schema`.

## Available Scripts

- `npm install` — install server dependencies
- `npm run dev` — run the server under nodemon (serves the UI from `./ui`, reloads on changes)
- `npm start` — run the server in production mode (`node index.js`)
- `npm run lint` / `npm run lint:fix` — lint the server code
- `npm run format` / `npm run format:check` — Prettier formatting
- `npm run generate-docs` — regenerate the OpenAPI documentation

## SSL Configuration

SSL is configured in `app.config.yaml` under `server`:

- `ssl_enabled` turns HTTPS on
- `ssl_key_path` and `ssl_cert_path` name the files, shipped as `/etc/hyperweaver-server/ssl/key.pem` and `cert.pem`; both leaves take an upload on the admin configuration page
- `ssl_generate` mints a self-signed pair when the files are absent
- `force_secure` redirects HTTP requests to HTTPS
