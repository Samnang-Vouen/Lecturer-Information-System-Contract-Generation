import sequelize from '../config/db.js';
import { DataTypes } from 'sequelize';

const DigitalSignature = sequelize.define('DigitalSignature', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  contract_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  role: { type: DataTypes.ENUM('LECTURER','HOD','DEAN','HR','SUPERADMIN'), allowNull: false },
  signed_at: { type: DataTypes.DATE, allowNull: true },
  signature_data: { type: DataTypes.STRING(255), allowNull: true }
}, {
  tableName: 'Digital_Signatures',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default DigitalSignature;
