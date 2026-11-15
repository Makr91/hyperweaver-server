import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import Sequelize from 'sequelize';
import { loadConfig, getSetupTokenPath } from '../utils/config-loader.js';
import { log } from '../utils/Logger.js';
import { snakeKeys } from '../utils/wire.js';

const db = {};

db.Sequelize = Sequelize;
db.sequelize = null;
db.ROLES = ['user', 'admin'];

/**
 * Open the database named by db.config.yaml and define every model on it;
 * a second call while the connection is open does nothing.
 * @returns {Promise<void>}
 */
const initializeDatabase = async () => {
  if (db.sequelize) {
    return;
  }
  const dbConfig = loadConfig('db');
  const dialect = dbConfig.database_type;
  const sequelizeConfig = { logging: dbConfig.sql.logging, dialect };

  if (dialect === 'sqlite') {
    sequelizeConfig.storage = dbConfig.sql.storage;
    const storageDir = dirname(dbConfig.sql.storage);
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true, mode: 0o755 });
      log.database.info('Created SQLite database directory', { storageDir });
    }
  } else {
    sequelizeConfig.host = dbConfig.sql.host;
    sequelizeConfig.port = dbConfig.sql.port;
    sequelizeConfig.pool = {
      max: dbConfig.mysql_pool.max,
      min: dbConfig.mysql_pool.min,
      acquire: dbConfig.mysql_pool.acquire,
      idle: dbConfig.mysql_pool.idle,
    };
  }

  const sequelize = new Sequelize(
    dialect === 'sqlite' ? null : dbConfig.sql.database,
    dialect === 'sqlite' ? null : dbConfig.sql.user,
    dialect === 'sqlite' ? null : dbConfig.sql.password,
    sequelizeConfig
  );

  db.sequelize = sequelize;

  db.organization = (await import('./organizations.model.js')).default(sequelize, Sequelize);
  db.user = (await import('./user.model.js')).default(sequelize, Sequelize);
  db.role = (await import('./role.model.js')).default(sequelize, Sequelize);
  db.invitation = (await import('./invitation.model.js')).default(sequelize, Sequelize);
  db.service_account = (await import('./service_account.model.js')).default(sequelize, Sequelize);
  db.credential = (await import('./credential.model.js')).default(sequelize, Sequelize);
  db.UserOrg = (await import('./user-org.model.js')).default(sequelize, Sequelize);
  db.Request = (await import('./request.model.js')).default(sequelize, Sequelize);
  db.scimGroup = (await import('./scim-group.model.js')).default(sequelize, Sequelize);
  db.revokedSession = (await import('./revoked-session.model.js')).default(sequelize, Sequelize);
  db.server = (await import('./server.model.js')).default(sequelize, Sequelize);
  db.serverOrg = (await import('./serverOrg.model.js')).default(sequelize, Sequelize);
  db.machineOrg = (await import('./machineOrg.model.js')).default(sequelize, Sequelize);

  db.UserOrg.associate = function (models) {
    db.UserOrg.belongsTo(models.user, {
      foreignKey: 'user_id',
      as: 'user',
    });
    db.UserOrg.belongsTo(models.organization, {
      foreignKey: 'organization_id',
      as: 'organization',
    });
  };

  db.Request.associate = function (models) {
    db.Request.belongsTo(models.user, {
      foreignKey: 'user_id',
      as: 'user',
    });
    db.Request.belongsTo(models.organization, {
      foreignKey: 'organization_id',
      as: 'organization',
    });
    db.Request.belongsTo(models.user, {
      foreignKey: 'reviewed_by',
      as: 'reviewer',
    });
  };

  db.role.belongsToMany(db.user, {
    through: 'user_roles',
  });
  db.user.belongsToMany(db.role, {
    through: 'user_roles',
  });

  Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
      db[modelName].associate(db);
    }
  });

  Object.keys(db).forEach(modelName => {
    if (modelName === 'scimGroup' || !(db[modelName].prototype instanceof Sequelize.Model)) {
      return;
    }
    db[modelName].prototype.toJSON = function () {
      return snakeKeys(this.get({ plain: true }));
    };
  });
};

if (existsSync(getSetupTokenPath())) {
  log.database.info('Setup token present; the database opens after the setup write');
} else {
  await initializeDatabase();
}

export { initializeDatabase };

export default db;
