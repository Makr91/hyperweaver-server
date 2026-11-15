import express from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import { basename } from 'path';
import crypto from 'crypto';
import cors from 'cors';
import axios from 'axios';
import session from 'express-session';
import connectSessionSequelize from 'connect-session-sequelize';
import lusca from 'lusca';
import { loadConfig, setupTokenGuard, getSetupTokenPath } from './utils/config-loader.js';
import { routes as configEngineRoutes } from './config/config-engine.js';
import { exit, SERVICE_USER, UPLOAD_LIMIT } from './config/hyperweaver-server.js';
import { ensureJwtSecret } from './utils/auth.js';
import { spaLimiter } from './middleware/rateLimiter.js';
import { authJwt } from './middleware/index.js';
import { initializeStrategies } from './auth/passport.js';
import authRoutes from './routes/auth.routes.js';
import mailRoutes from './routes/mail.routes.js';
import userRoutes from './routes/user.routes.js';
import accountRoutes from './routes/account.routes.js';
import requestRoutes from './routes/request.routes.js';
import organizationRoutes from './routes/organization.routes.js';
import serviceAccountRoutes from './routes/service_account.routes.js';
import systemRoutes from './routes/system.routes.js';
import scimRoutes from './routes/scim.routes.js';
import serversRoutes from './routes/servers.routes.js';
import statusRoutes from './routes/status.routes.js';
import healthRoutes from './routes/health.routes.js';
import rulesRoutes from './routes/rules.routes.js';
import clientErrorsRoutes from './routes/client_errors.routes.js';
import configRoutes from './routes/config.routes.js';
import ServerController from './controllers/ServerController.js';
import db, { initializeDatabase } from './models/index.js';
import { upgradeSchema } from './models/schema.js';
import { specs, swaggerUi } from './config/swagger.js';
import { log, createRequestLogger, generateRequestId } from './utils/Logger.js';
import { configAwareI18nMiddleware as i18nMiddleware } from './config/i18n.js';
import { errorHandler } from './middleware/errorHandler.js';
import eventsRoutes from './routes/events.routes.js';
import favoritesRoutes from './routes/favorites.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import searchRoutes from './routes/search.routes.js';
import { opensearch } from './controllers/opensearch.controller.js';
import { uiIndex, uiManifest } from './middleware/uiIndex.js';
import { handleWebSocketUpgrade } from './utils/wsProxy.js';
import { generateSSLCertificatesIfNeeded } from './utils/sslSetup.js';
import { csrfProtection } from './auth/csrfProtection.js';

/**
 * Dark Swagger theme shared with the Hyperweaver UI + docs site (config/swagger-theme.css).
 * Read once at module load; injected as swagger-ui-express customCss on /api/docs and
 * on the selected-agent shell below.
 */
const swaggerCustomCss = fs.readFileSync(
  new URL('./config/swagger-theme.css', import.meta.url),
  'utf8'
);

/**
 * Themed shell for the selected-agent API docs (/agent/api-docs). It loads swagger-ui's
 * assets from /api/docs (already served) and its spec from the same-origin relay, reading
 * the selected host id from ?server= in the browser.
 */
const agentApiDocsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Agent API Documentation</title>
<link rel="stylesheet" href="/api/docs/swagger-ui.css" />
<style>${swaggerCustomCss}</style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="/api/docs/swagger-ui-bundle.js"></script>
<script>
window.onload = function () {
  var params = new URLSearchParams(window.location.search);
  var server = params.get('server');
  var specUrl = '/agent/api-docs/swagger.json' + (server ? '?server=' + encodeURIComponent(server) : '');
  window.ui = SwaggerUIBundle({
    url: specUrl,
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [SwaggerUIBundle.presets.apis],
    layout: 'BaseLayout',
    tryItOutEnabled: true,
  });
};
</script>
</body>
</html>`;

const SessionStore = connectSessionSequelize(session.Store);
const { csrf } = lusca;

process.on('uncaughtException', err => {
  log.app.error('Uncaught Exception', {
    error: err.message,
    stack: err.stack,
  });
});

await ensureJwtSecret();

const appConfig = loadConfig('app');

const app = express();
const { port } = appConfig.server;

const CATALOG_ORIGIN = 'https://provisioner-catalog.startcloud.com';

const corsOptions = {
  origin: [
    new URL(appConfig.frontend.frontend_url).origin,
    ...appConfig.security.cors.whitelist,
    CATALOG_ORIGIN,
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['x-access-token', 'Authorization', 'Origin', 'Content-Type', 'Accept'],
  exposedHeaders: ['X-Refreshed-Token'],
  maxAge: 600,
  credentials: appConfig.security.cors.credentials,
};

app.set('trust proxy', appConfig.frontend.trust_proxy);
app.use(cors(corsOptions));
app.options('*splat', cors(corsOptions));
app.use(i18nMiddleware);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/index.html', spaLimiter, uiIndex(404));
app.get('/callback/index.html', spaLimiter, uiIndex(404));
app.get('/manifest.json', spaLimiter, uiManifest);
app.get('/opensearch.xml', spaLimiter, opensearch);

app.use(
  express.static('./ui', {
    index: false,
    setHeaders: (res, filePath) => {
      res.setHeader(
        'Cache-Control',
        basename(filePath) === 'index.html' ? 'no-store, no-transform' : 'no-cache'
      );
    },
  })
);

app.use((req, res, next) => {
  req.requestId = generateRequestId();
  const logger = createRequestLogger(req.requestId, req);

  res.on('finish', () => {
    if (res.statusCode >= 400) {
      logger.error(res.statusCode, res.statusMessage);
    } else {
      logger.success(res.statusCode);
    }
  });

  next();
});

app.use(csrfProtection);

/**
 * End the process once the setup write has answered 200, so the service
 * manager starts it again on the written configuration with the database open.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Next handler
 * @returns {void}
 */
const restartAfterSetup = (req, res, next) => {
  void req;
  res.on('finish', () => {
    if (res.statusCode === 200) {
      log.app.info('Setup complete; restarting on the written configuration');
      exit();
    }
  });
  next();
};

app.put('/api/setup', restartAfterSetup);
app.use('/api', statusRoutes);
app.use('/api', configRoutes);
configEngineRoutes(
  app,
  {
    admin: [authJwt.verifyToken, authJwt.isUser, authJwt.isAdmin],
    setup: [setupTokenGuard],
    actor: async req => {
      const user = await db.user.findByPk(req.userId, { attributes: ['email'] });
      return user.email;
    },
    user: SERVICE_USER,
  },
  exit,
  UPLOAD_LIMIT
);

app.use('/docs', spaLimiter, (req, res) => {
  void req;
  res.status(503).json({
    error: 'Documentation not bundled in this build',
    details:
      'The docs site is bundled into the STARTcloud UI artifact (ui/docs) at UI build time; serve a UI artifact that includes it.',
  });
});

app.use('/api/docs', swaggerUi.serve, (req, res, next) => {
  const { protocol } = req;
  const host = req.get('host');
  const dynamicSpecs = {
    ...specs,
    servers: [
      {
        url: `${protocol}://${host}`,
        description: 'Current server (auto-detected)',
      },
      {
        url: '{protocol}://{host}',
        description: 'Custom server',
        variables: {
          protocol: {
            enum: ['http', 'https'],
            default: 'https',
            description: 'The protocol used to access the server',
          },
          host: {
            default: 'localhost:3000',
            description: 'The hostname and port of the server',
          },
        },
      },
    ],
  };

  swaggerUi.setup(dynamicSpecs, {
    explorer: true,
    customCss: swaggerCustomCss,
    customSiteTitle: 'Hyperweaver Server API Documentation',
    swaggerOptions: {
      url: `${protocol}://${host}/api/docs/swagger.json`,
    },
  })(req, res, next);
});

app.get('/api/docs/swagger.json', (req, res) => {
  const { protocol } = req;
  const host = req.get('host');
  const dynamicSpecs = {
    ...specs,
    servers: [
      {
        url: `${protocol}://${host}`,
        description: 'Current server (auto-detected)',
      },
    ],
  };
  res.setHeader('Content-Type', 'application/json');
  res.send(dynamicSpecs);
});

/**
 * Selected-agent API docs (Aggregated mode). The Hyperweaver UI's "Agent API" reference
 * opens /agent/api-docs?server={id}, where id is the host selected in the navbar. This
 * themed shell loads swagger-ui from /api/docs and its spec from the relay below.
 */
app.get('/agent/api-docs', (req, res) => {
  void req;
  res.type('html').send(agentApiDocsHtml);
});

/**
 * Relay: fetch the selected agent's own OpenAPI spec server-side (no browser CORS,
 * and NAT'd agents still work since the Server reaches them), then point "Try it out"
 * back through this Server's authenticated agent proxy.
 */
app.get('/agent/api-docs/swagger.json', async (req, res) => {
  const id = req.query.server;
  const stub = message => ({
    openapi: '3.0.0',
    info: { title: 'Agent API — unavailable', version: '0.0.0', description: message },
    paths: {},
  });
  res.setHeader('Content-Type', 'application/json');
  if (!id) {
    return res.send(
      stub('No agent selected — pick a host in the navbar, then open the Agent API reference.')
    );
  }
  try {
    const agent = await ServerController.getAgentById(id);
    if (!agent) {
      return res.status(404).send(stub(`No registered agent with id ${id}.`));
    }
    if (!agent.isAgentRole()) {
      return res.status(409).send(stub('The selected backend is not an agent.'));
    }
    const specResponse = await axios.get(
      `${agent.protocol}://${agent.hostname}:${agent.port}/api-docs/swagger.json`,
      {
        timeout: 10000,
        httpsAgent: new https.Agent({ rejectUnauthorized: !agent.allow_insecure }),
      }
    );
    const spec = specResponse.data;
    spec.servers = [
      {
        url: `${req.protocol}://${req.get('host')}/api/agents/${agent.id}`,
        description: `${agent.entity_name || agent.hostname} — via Hyperweaver Server (authorize with your JWT to try requests)`,
      },
    ];
    return res.send(spec);
  } catch (error) {
    log.app.warn('Agent API docs relay failed', { id, error: error.message });
    return res
      .status(502)
      .send(stub(`Could not load the selected agent's API spec: ${error.message}`));
  }
});

const SEEDED_ROLES = [
  { id: 1, name: 'user' },
  { id: 3, name: 'admin' },
];

const seedRoles = () =>
  SEEDED_ROLES.reduce(
    (chain, role) =>
      chain.then(() => db.role.findOrCreate({ where: { name: role.name }, defaults: role })),
    Promise.resolve()
  );

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const CODE_AUTHENTICATED = ['/api/auth/oidc/exchange', '/api/auth/oidc/backchannel-logout'];
const sessionCsrf = csrf();

const oidcSessionCsrf = (req, res, next) => {
  if (!req.path.startsWith('/api/auth/oidc') || SAFE_METHODS.includes(req.method)) {
    return next();
  }
  if (req.headers['x-access-token'] || req.headers.authorization) {
    return next();
  }
  if (CODE_AUTHENTICATED.includes(req.path)) {
    return next();
  }
  return sessionCsrf(req, res, next);
};

const initializeApp = async () => {
  const sessionStore = new SessionStore({
    db: db.sequelize,
    tableName: 'Sessions',
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 30 * 60 * 1000,
  });

  const sessionSecret = crypto
    .createHash('sha256')
    .update(`hyperweaver-session:${loadConfig('auth').auth.jwt.jwt_secret}`)
    .digest('hex');

  app.use(
    session({
      secret: sessionSecret,
      store: sessionStore,
      name: 'hyperweaver-server.sid',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        secure: appConfig.server.ssl_enabled,
        httpOnly: true,
        maxAge: 30 * 60 * 1000,
        sameSite: 'lax',
      },
    })
  );

  log.database.info('Database synced', await upgradeSchema(db.sequelize));
  await sessionStore.sync();
  await initializeStrategies();
  app.use(oidcSessionCsrf);
  await seedRoles();

  app.use('/api', rulesRoutes);
  app.use('/api', healthRoutes);
  app.use('/api', authRoutes);
  app.use('/api', mailRoutes);
  app.use('/api', userRoutes);
  app.use('/api', accountRoutes);
  app.use('/api', requestRoutes);
  app.use('/api', organizationRoutes);
  app.use('/api', serviceAccountRoutes);
  app.use('/api', serversRoutes);
  app.use('/api', favoritesRoutes);
  app.use('/api', notificationRoutes);
  app.use('/api', eventsRoutes);
  app.use('/api', systemRoutes);
  app.use('/api', clientErrorsRoutes);
  app.use('/api', searchRoutes);
  app.use('/scim/v2', scimRoutes);

  app.get('*splat', spaLimiter, uiIndex());
  app.use(errorHandler);
  log.app.info('Hyperweaver Server application initialized');
};

const startApplication = () =>
  initializeDatabase()
    .then(() => initializeApp())
    .catch(error => {
      log.app.error('Application start failed', { error: error.message, stack: error.stack });
    });

if (fs.existsSync(getSetupTokenPath())) {
  log.app.info('Setup token present; serving the setup routes until the setup write', {
    path: getSetupTokenPath(),
  });
  app.get('/', spaLimiter, uiIndex());
  app.use(errorHandler);
} else {
  startApplication();
}

(async () => {
  if (appConfig.server.ssl_enabled) {
    await generateSSLCertificatesIfNeeded();

    try {
      const privateKey = fs.readFileSync(appConfig.server.ssl_key_path, 'utf8');
      const certificate = fs.readFileSync(appConfig.server.ssl_cert_path, 'utf8');

      const credentials = { key: privateKey, cert: certificate };

      if (appConfig.server.ssl_ca_path) {
        const ca = fs.readFileSync(appConfig.server.ssl_ca_path, 'utf8');
        credentials.ca = ca;
      }

      const httpsServer = https.createServer(credentials, app);

      httpsServer.on('upgrade', handleWebSocketUpgrade);

      httpsServer.listen(port, () => {
        log.app.info('HTTPS Server started', { port });
      });

      /**
       * server.force_secure (AGREED cross-repo contract, default true):
       * true  → the plain-HTTP port serves ONLY 308 redirects to the HTTPS listener
       *         (client's host kept, HTTPS port pinned, path+query preserved; WS upgrades
       *         are dropped — no upgrade handler on this listener).
       * false → dual-serve: the HTTP port serves the full app + WS upgrades alongside HTTPS.
       */
      const forceSecure = appConfig.server.force_secure !== false;
      if (forceSecure) {
        const redirectApp = express();
        redirectApp.use((req, res) => {
          const rawHost = req.headers.host || appConfig.server.hostname;
          const hostname = rawHost.startsWith('[')
            ? rawHost.replace(/^(?<bracketed>\[[^\]]+\]).*$/, '$<bracketed>')
            : rawHost.replace(/:\d+$/, '');
          const portSuffix = Number(port) === 443 ? '' : `:${port}`;
          res.redirect(308, `https://${hostname}${portSuffix}${req.url}`);
        });

        const httpServer = http.createServer(redirectApp);
        httpServer.listen(80, () => {
          log.app.info('HTTP Server started - 308 redirect to HTTPS (force_secure)', {
            port: 80,
            httpsPort: port,
          });
        });
      } else {
        const httpServer = http.createServer(app);
        httpServer.on('upgrade', handleWebSocketUpgrade);
        httpServer.listen(80, () => {
          log.app.info('HTTP Server started - dual-serve mode (force_secure=false)', {
            port: 80,
            httpsPort: port,
          });
        });
      }
    } catch (error) {
      log.app.error('SSL Certificate Error', { error: error.message });
      log.app.warn('Falling back to HTTP server...');

      const httpServer = http.createServer(app);
      httpServer.on('upgrade', handleWebSocketUpgrade);

      httpServer.listen(port, () => {
        log.app.warn('HTTP Server started (SSL certificates not found)', { port });
      });
    }
  } else {
    const httpServer = http.createServer(app);
    httpServer.on('upgrade', handleWebSocketUpgrade);

    httpServer.listen(port, () => {
      log.app.info('HTTP Server started', {
        port,
        apiDocs: `http://localhost:${port}/api/docs`,
      });
    });
  }
})();

export { appConfig as config };
