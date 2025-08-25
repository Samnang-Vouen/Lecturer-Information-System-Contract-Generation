import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';
import Course from './course.model.js';
import ClassModel from './class.model.js';
import { LecturerProfile, Department } from './user.model.js';

// Represents an assignment (or potential assignment) of a lecturer to teach a course for a class (group count etc.)
const CourseMapping = sequelize.define('CourseMapping', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dept_id: { type: DataTypes.INTEGER, allowNull: true }, // denormalized for quick filters
  // Match Classes.id which is defined as INTEGER.UNSIGNED to avoid FK incompatibility
  class_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  course_id: { type: DataTypes.INTEGER, allowNull: false },
  lecturer_profile_id: { type: DataTypes.INTEGER, allowNull: true },
  academic_year: { type: DataTypes.STRING(20), allowNull: false },
  term: { type: DataTypes.STRING(50), allowNull: false },
  year_level: { type: DataTypes.STRING(50), allowNull: true },
  group_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  type_hours: { type: DataTypes.ENUM('Theory (15h)','Lab (30h)','Only 15h','Only 30h'), allowNull: false, defaultValue: 'Theory (15h)' },
  availability: { type: DataTypes.STRING(255), allowNull: true },
  status: { type: DataTypes.ENUM('Pending','Contacting','Accepted','Rejected'), allowNull: false, defaultValue: 'Pending' },
  contacted_by: { type: DataTypes.STRING(255), allowNull: true },
  comment: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'Course_Mappings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Associations
CourseMapping.belongsTo(ClassModel, { foreignKey: 'class_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
ClassModel.hasMany(CourseMapping, { foreignKey: 'class_id' });
CourseMapping.belongsTo(Course, { foreignKey: 'course_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Course.hasMany(CourseMapping, { foreignKey: 'course_id' });
CourseMapping.belongsTo(LecturerProfile, { foreignKey: 'lecturer_profile_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
LecturerProfile.hasMany(CourseMapping, { foreignKey: 'lecturer_profile_id' });
CourseMapping.belongsTo(Department, { foreignKey: 'dept_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Department.hasMany(CourseMapping, { foreignKey: 'dept_id' });

export default CourseMapping;
