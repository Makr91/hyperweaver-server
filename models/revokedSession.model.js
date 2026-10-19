import { DataTypes } from '@sequelize/core';

export default sequelize => {
  const RevokedSession = sequelize.define(
    'revoked_session',
    {
      sid: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        allowNull: false,
      },
      issuer: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        columnName: 'user_id',
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        columnName: 'expires_at',
      },
    },
    {
      tableName: 'revoked_sessions',
    }
  );

  return RevokedSession;
};
