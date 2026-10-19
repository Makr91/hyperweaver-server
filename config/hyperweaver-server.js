import fs from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createConnection } from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CONFIG_NAMES = ['app', 'auth', 'db', 'mail'];
const SERVICE_USER = 'hyperweaver-server';
const PRODUCTION_CONFIG_DIR = process.env.CONFIG_DIR || '/etc/hyperweaver-server';
const SCHEMA_DIR = join(__dirname, 'schema');
const UPLOAD_LIMIT = 1024 * 1024;
const DIRECTORY_POINTERS = ['/logging/log_directory'];
const SSL_POINTERS = ['/server/ssl_cert_path', '/server/ssl_key_path', '/server/ssl_ca_path'];
const REACHABLE_TIMEOUT_MS = 3000;

const nearestExisting = path => {
  let current = path;
  while (!fs.existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) {
      return current;
    }
    current = parent;
  }
  return current;
};

const isWritable = path => {
  try {
    fs.accessSync(nearestExisting(path), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

const failure = (pointer, rule, params) => [{ pointer, rule, params }];

const writable = (pointer, value, name, document, configDir) => {
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }
  if (name === 'db' && pointer === '/database/storage') {
    return isWritable(dirname(resolve(value)))
      ? []
      : failure(pointer, 'writable', { user: SERVICE_USER });
  }
  if (name !== 'app') {
    return [];
  }
  if (DIRECTORY_POINTERS.includes(pointer)) {
    return isWritable(resolve(value)) ? [] : failure(pointer, 'writable', { user: SERVICE_USER });
  }
  if (!SSL_POINTERS.includes(pointer)) {
    return [];
  }
  const target = resolve(configDir, value);
  if (fs.existsSync(target)) {
    try {
      fs.accessSync(target, fs.constants.R_OK);
      return [];
    } catch {
      return failure(pointer, 'writable', { user: SERVICE_USER });
    }
  }
  if (document.server?.ssl_generate !== true) {
    return [];
  }
  return isWritable(target) ? [] : failure(pointer, 'writable', { user: SERVICE_USER });
};

const connects = (host, port) =>
  new Promise(settle => {
    const socket = createConnection({ host, port, timeout: REACHABLE_TIMEOUT_MS });
    const finish = ok => {
      socket.destroy();
      settle(ok);
    };
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });

const reachable = async (pointer, value, name, document) => {
  if (name !== 'mail' || pointer !== '/mail/smtp_host' || typeof value !== 'string') {
    return [];
  }
  if (value.trim() === '') {
    return [];
  }
  const port = document.mail?.smtp_port;
  if (!Number.isInteger(port) || (await connects(value, port))) {
    return [];
  }
  return failure(pointer, 'reachable', { host: value, port });
};

let afterSave = null;

const onConfigSaved = handler => {
  afterSave = handler;
};

const hooks = {
  writable,
  reachable,
  onSaved: (name, actor) => {
    if (afterSave) {
      afterSave(name, actor);
    }
  },
};

const exit = () => {
  process.exit(1);
};

export {
  CONFIG_NAMES,
  SERVICE_USER,
  PRODUCTION_CONFIG_DIR,
  SCHEMA_DIR,
  UPLOAD_LIMIT,
  hooks,
  exit,
  onConfigSaved,
};
