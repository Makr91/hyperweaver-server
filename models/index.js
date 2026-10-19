import fs from 'fs';
import path from 'path';
import { Sequelize } from '@sequelize/core';
import { SqliteDialect } from '@sequelize/sqlite3';
import { PostgresDialect } from '@sequelize/postgres';
import { MySqlDialect } from '@sequelize/mysql';
import { MariaDbDialect } from '@sequelize/mariadb';
import { loadConfig } from '../utils/config-loader.js';
import { createMigrationHelper } from '../config/DatabaseMigrations.js';
import { log, createTimer } from '../utils/Logger.js';

const dbConfig = loadConfig('db').database;

const { dialect } = dbConfig;
const loggingEnabled = dbConfig.logging;

// Sequelize 7 requires the dialect CLASS (not the v6 string). Map the
// config dialect string to its corresponding @sequelize dialect class.
const dialectClasses = {
  sqlite: SqliteDialect,
  postgresql: PostgresDialect,
  mysql: MySqlDialect,
  mariadb: MariaDbDialect,
};

const dialectClass = dialectClasses[dialect];
if (!dialectClass) {
  log.database.error('Unsupported database dialect', { dialect });
  throw new Error(`Unsupported database dialect: ${dialect}`);
}

// Custom logging function for Sequelize
const sequelizeLogging = loggingEnabled
  ? (msg, timing) => {
      // Parse the query to check if it's a slow query
      if (timing && timing > 1000) {
        log.database.warn('Slow database query', {
          query: msg,
          duration_ms: timing,
        });
      } else {
        // Log regular queries at debug level
        log.database.debug(msg, { timing });
      }
    }
  : false;

const sequelizeConfig = {
  logging: sequelizeLogging,
  dialect: dialectClass,
  benchmark: true, // Enable timing for all queries
};

if (dialect === 'sqlite') {
  // SQLite configuration - use storage from config
  sequelizeConfig.storage = dbConfig.storage;

  // Ensure the directory exists for SQLite database file
  const storageDir = path.dirname(sequelizeConfig.storage);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true, mode: 0o755 });
    log.database.info('Created SQLite database directory', { directory: storageDir });
  }

  log.database.info('Using SQLite database', { storage: sequelizeConfig.storage });
} else {
  sequelizeConfig.host = dbConfig.host;
  sequelizeConfig.port = dbConfig.port;
  sequelizeConfig.pool = { ...dbConfig.pool };
  sequelizeConfig.database = dbConfig.database_name;
  sequelizeConfig.user = dbConfig.user;
  sequelizeConfig.password = dbConfig.password;
}

const sequelize = new Sequelize(sequelizeConfig);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models - using dynamic imports for ES modules
const modelFiles = [
  'user.model.js',
  'organization.model.js',
  'invitation.model.js',
  'server.model.js',
  'credential.model.js',
  'serverOrg.model.js',
  'machineOrg.model.js',
  'revokedSession.model.js',
];

// Initialize models - handle async imports properly
const modelPromises = modelFiles.map(async file => {
  try {
    const { default: modelDefiner } = await import(`./${file}`);
    const modelName = file.replace('.model.js', '');
    return { modelName, modelDefiner };
  } catch (error) {
    log.database.warn('Could not load model', {
      file,
      error: error.message,
    });
    return null;
  }
});

// Wait for all models to load
const loadedModels = await Promise.all(modelPromises);

// Create model instances
loadedModels.forEach(result => {
  if (result) {
    const { modelName, modelDefiner } = result;
    db[modelName] = modelDefiner(sequelize);
  }
});

// Define associations after all models are loaded
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Test database connection and run migrations
try {
  const connectionTimer = createTimer('database_connection');
  await sequelize.authenticate();
  const connectionTime = connectionTimer.end();

  log.database.info('Database connection established successfully', {
    dialect,
    duration_ms: connectionTime,
  });

  // Initialize automatic migration system
  const migrationTimer = createTimer('database_migration');
  const migrationHelper = createMigrationHelper(sequelize);
  await migrationHelper.setupDatabase();
  const migrationTime = migrationTimer.end();

  log.database.info('Database migrations completed', {
    duration_ms: migrationTime,
  });
} catch (error) {
  log.database.error('Unable to connect to database', {
    error: error.message,
    dialect,
  });
  throw error;
}

export default db;
