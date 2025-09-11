import sequelize from '../config/db.js';
import { DataTypes } from 'sequelize';

const TeachingContract = sequelize.define('TeachingContract', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  lecturer_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  academic_year: { type: DataTypes.STRING(20), allowNull: false },
  term: { type: DataTypes.STRING(50), allowNull: false },
  year_level: { type: DataTypes.STRING(50), allowNull: true },
  // Optional teaching period dates
  start_date: { type: DataTypes.DATEONLY, allowNull: true },
  end_date: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.ENUM('DRAFT','LECTURER_SIGNED','MANAGEMENT_SIGNED','COMPLETED'), allowNull: false, defaultValue: 'DRAFT' },
  lecturer_signature_path: { type: DataTypes.STRING(512), allowNull: true },
  management_signature_path: { type: DataTypes.STRING(512), allowNull: true },
  lecturer_signed_at: { type: DataTypes.DATE, allowNull: true },
  management_signed_at: { type: DataTypes.DATE, allowNull: true },
  pdf_path: { type: DataTypes.STRING(512), allowNull: true },
  created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }
}, {
  tableName: 'Teaching_Contracts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default TeachingContract;
