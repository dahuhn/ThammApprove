import { Sequelize } from 'sequelize';
import path from 'path';

const databasePath = process.env.DATABASE_PATH || './database.sqlite';

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.resolve(databasePath),
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: false
  }
});