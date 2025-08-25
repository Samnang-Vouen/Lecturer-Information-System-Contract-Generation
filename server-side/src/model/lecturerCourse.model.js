import sequelize from '../config/db.js';
import { DataTypes } from 'sequelize';
import Course from './course.model.js';
import { LecturerProfile } from './user.model.js';

const LecturerCourse = sequelize.define('LecturerCourse', {
  // Standard signed integers to align with LecturerProfile.id and Course.id
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  lecturer_profile_id: { type: DataTypes.INTEGER, allowNull: false },
  course_id: { type: DataTypes.INTEGER, allowNull: false }
}, {
  tableName: 'Lecturer_Courses',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

LecturerCourse.belongsTo(LecturerProfile, { foreignKey: 'lecturer_profile_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
LecturerProfile.hasMany(LecturerCourse, { foreignKey: 'lecturer_profile_id' });

LecturerCourse.belongsTo(Course, { foreignKey: 'course_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Course.hasMany(LecturerCourse, { foreignKey: 'course_id' });

export default LecturerCourse;
