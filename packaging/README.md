# Building Hyperweaver Server Debian Packages

Production-ready Debian package build process with automated CI/CD via Release Please.

## Prerequisites

```bash
sudo apt update
sudo apt install nodejs npm dpkg-dev gdebi-core
```

## Quick Build Commands

### 1. Prepare Application

```bash
# Fetch the pinned STARTcloud UI artifact into ui
UI_VERSION=$(node -p "require('./package.json').startcloudUiVersion")
mkdir -p ui
curl -fsSL "https://github.com/STARTcloud/startcloud-ui/releases/download/v${UI_VERSION}/startcloud-ui-${UI_VERSION}.tar.gz" | tar -xz -C ui

# Install production dependencies only
npm ci --omit=dev
```

### 2. Create Package Structure

```bash
# Extract version from package.json
export VERSION=$(node -p "require('./package.json').version")
export PACKAGE_NAME="hyperweaver-server"
export ARCH="amd64"

# Create directory structure
mkdir -p "${PACKAGE_NAME}_${VERSION}_${ARCH}"/{opt/hyperweaver-server/config-templates,opt/hyperweaver-server/scripts,etc/hyperweaver-server,etc/systemd/system,var/lib/hyperweaver-server,var/log/hyperweaver-server,DEBIAN}
```

### 3. Copy Application Files

```bash
# Application files and the fetched UI to /opt/hyperweaver-server
cp -r controllers models routes auth config middleware rules utils scripts index.js package.json ui "${PACKAGE_NAME}_${VERSION}_${ARCH}/opt/hyperweaver-server/"
cp -r node_modules "${PACKAGE_NAME}_${VERSION}_${ARCH}/opt/hyperweaver-server/"

# Configuration files
cp packaging/config/*.yaml "${PACKAGE_NAME}_${VERSION}_${ARCH}/opt/hyperweaver-server/config-templates/"
cp packaging/scripts/certbot-deploy-hook.sh "${PACKAGE_NAME}_${VERSION}_${ARCH}/opt/hyperweaver-server/scripts/"

# Systemd service
cp packaging/DEBIAN/systemd/hyperweaver-server.service "${PACKAGE_NAME}_${VERSION}_${ARCH}/etc/systemd/system/"

# DEBIAN control files
cp packaging/DEBIAN/{preinst,postinst,prerm,postrm} "${PACKAGE_NAME}_${VERSION}_${ARCH}/DEBIAN/"
```

### 4. Generate Control File

```bash
# Create control file with dynamic version
cat > "${PACKAGE_NAME}_${VERSION}_${ARCH}/DEBIAN/control" << EOF
Package: hyperweaver-server
Version: ${VERSION}
Section: web
Priority: optional
Architecture: ${ARCH}
Maintainer: Makr91 <makr91@users.noreply.github.com>
Depends: nodejs (>= 22.0.0), sqlite3, openssl
Description: Hyperweaver Server - hypervisor control-plane web interface
 Serves the STARTcloud UI, authenticates users and aggregates the
 Hyperweaver and Zoneweaver agents from one pane.
Homepage: https://github.com/Makr91/hyperweaver-server
EOF
```

### 5. Set Permissions

```bash
# Set proper permissions
find "${PACKAGE_NAME}_${VERSION}_${ARCH}" -type d -exec chmod 755 {} \;
find "${PACKAGE_NAME}_${VERSION}_${ARCH}" -type f -exec chmod 644 {} \;
chmod 755 "${PACKAGE_NAME}_${VERSION}_${ARCH}/DEBIAN"/{preinst,postinst,prerm,postrm}
chmod 755 "${PACKAGE_NAME}_${VERSION}_${ARCH}/opt/hyperweaver-server/scripts"/*
```

### 6. Build & Install Package

```bash
# Build .deb package
dpkg-deb --build "${PACKAGE_NAME}_${VERSION}_${ARCH}" "${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"

# Install package
sudo gdebi -n "${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"

# Start service
sudo systemctl enable --now hyperweaver-server

# Check status
sudo systemctl status hyperweaver-server
```

`postinst` creates an empty `/etc/hyperweaver-server/setup.token` on a fresh install; the first start fills it, so read it with `sudo cat /etc/hyperweaver-server/setup.token`, open `https://localhost:3443` and complete first-run setup with it.

## Critical Build Notes

### ⚠️ Required Directories

**Must include these directories in the copy command or the package will fail:**

- `controllers/`, `models/`, `routes/`, `auth/`, `config/`, `middleware/`, `rules/`, `utils/` - The application code
- `scripts/` - The config migration `postinst` runs as the service user on every upgrade
- `node_modules/` - Dependencies
- `ui/` - The STARTcloud UI artifact pinned by `startcloudUiVersion` in `package.json`
- `packaging/config/*.yaml` into `opt/hyperweaver-server/config-templates/` - `postinst` installs `/etc/hyperweaver-server/*.config.yaml` from them where no file of that name exists
- `etc/hyperweaver-server/` in the payload - the unit re-asserts its owner and mode on every start
- `packaging/DEBIAN/preinst` beside `postinst`, `prerm` and `postrm`

### 🔧 Systemd Service

The service includes:

- **Environment variable** (`CONFIG_DIR=/etc/hyperweaver-server`)
- **Configuration directory** (`ConfigurationDirectory=hyperweaver-server`, `ConfigurationDirectoryMode=0750`)
- **Security restrictions** (NoNewPrivileges, ProtectSystem, etc.)
- **MySQL ordering** (starts after mysql.service)

### 📁 Configuration Files

Hyperweaver Server uses multiple configuration files:

- `app.config.yaml` - Main application settings
- `auth.config.yaml` - JWT and authentication settings
- `db.config.yaml` - Database connection settings
- `mail.config.yaml` - SMTP mail configuration

## Database Setup

**SQLite is the packaged default** (`database_type: sqlite`, `/var/lib/hyperweaver-server/database/hyperweaver-server.db`), so no database server is needed. MySQL is optional: install it, then pick `mysql` and the connection on the setup page or in `/etc/hyperweaver-server/db.config.yaml`.

```bash
# Install MySQL/MariaDB
sudo apt install mysql-server
# OR
sudo apt install mariadb-server

# Create database and user
sudo mysql -e "CREATE DATABASE hyperweaver_server;"
sudo mysql -e "CREATE USER 'hyperweaver-server'@'localhost' IDENTIFIED BY 'your_password';"
sudo mysql -e "GRANT ALL PRIVILEGES ON hyperweaver_server.* TO 'hyperweaver-server'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

# Update database config
sudo nano /etc/hyperweaver-server/db.config.yaml
```

## Automated CI/CD

### Release Please Integration

Every push to main triggers Release Please:

1. **Creates release PR** with version bumps and changelog
2. **Merges PR** → triggers package build
3. **Creates GitHub release** with `.deb` package attached
4. **Uses semantic versioning** based on conventional commits

### Manual Release Trigger

`release-please.yml` runs on every push to `main` and has no manual trigger. The package build can be re-run for an existing release tag:

```bash
gh workflow run prod-build.yml -f version=0.79.0 -f tag_name=v0.79.0
```

## Package Information

- **Service User**: `hyperweaver-server` (created during installation)
- **Configuration**: `/etc/hyperweaver-server/*.config.yaml`
- **Setup Token**: `/etc/hyperweaver-server/setup.token`
- **Data Directory**: `/var/lib/hyperweaver-server/`
- **- **Log Directory**: `/var/log/hyperweaver-server/`
- **Service**: `systemctl {start|stop|status|restart} hyperweaver-server`
- **Default Access**: `https://localhost:3443` (`server.port` in `app.config.yaml`)

## Troubleshooting

### Common Build Errors

1. **Cannot find module '/opt/hyperweaver-server/...'**
   - ❌ Missing a source folder in the copy command
   - ✅ Fix: Ensure every source folder is copied to the package

2. **Cannot stat 'ui'**
   - ❌ UI artifact not fetched
   - ✅ Fix: Run the fetch step in "Prepare Application" before packaging

3. **Database connection errors**
   - ❌ `database_type: mysql` chosen but MySQL/MariaDB not installed or configured
   - ✅ Fix: Install the database and update `/etc/hyperweaver-server/db.config.yaml`, or keep SQLite

### Service Issues

```bash
# Check logs
sudo journalctl -fu hyperweaver-server

# Check configs
sudo ls -la /etc/hyperweaver-server/
sudo cat /etc/hyperweaver-server/app.config.yaml

# Restart service
sudo systemctl restart hyperweaver-server
```

### Uninstall

```bash
sudo systemctl stop hyperweaver-server
sudo apt remove hyperweaver-server
sudo apt autoremove

# Purge all data and configs
sudo apt purge hyperweaver-server
```
