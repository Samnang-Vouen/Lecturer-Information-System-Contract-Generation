import sequelize from '../config/db.js';
import { DataTypes } from 'sequelize';
import User from './user.model.js';

const Contract = sequelize.define('Contract', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  contract_number: { type: DataTypes.STRING(255), allowNull: false },
  title: { type: DataTypes.STRING(255), allowNull: false },
  contract_type: { type: DataTypes.ENUM('FULL_TIME','PART_TIME','ADJUNCT','TEMPORARY'), allowNull: false },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: false },
  annual_salary: { type: DataTypes.DECIMAL(12,2), allowNull: true },
  content: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM('DRAFT','ACTIVE','EXPIRED','TERMINATED'), allowNull: false, defaultValue: 'DRAFT' },
  created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }
}, {
  tableName: 'Contracts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

Contract.belongsTo(User, { foreignKey: 'created_by', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
User.hasMany(Contract, { foreignKey: 'created_by' });

export default Contract;
