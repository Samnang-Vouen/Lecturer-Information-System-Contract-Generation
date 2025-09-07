// Import all models
import User from './user.model.js';
import Role from './role.model.js';
import Department from './department.model.js';
import ResearchField from './researchField.model.js';
import Major from './major.model.js';
import UserRole from './userRole.model.js';
import DepartmentProfile from './departmentProfile.model.js';
import LecturerProfile from './lecturerProfile.model.js';
import Course from './course.model.js';
import ClassModel from './class.model.js';
import LecturerCourse from './lecturerCourse.model.js';
import LecturerResearchField from './lecturerResearchField.model.js';
import CourseMapping from './courseMapping.model.js';
import Contract from './contract.model.js';
import DigitalSignature from './digitalSignature.model.js';
import Candidate from './candidate.model.js';
import { InterviewQuestion } from './interviewQuestion.model.js';
import { CandidateQuestion } from './candidateQuestion.model.js';
import University from './university.model.js';
import TeachingContract from './teachingContract.model.js';
import TeachingContractCourse from './teachingContractCourse.model.js';

// Set up associations

// User - Role (Many-to-Many)
User.belongsToMany(Role, { 
  through: UserRole, 
  foreignKey: 'user_id',
  otherKey: 'role_id'
});
Role.belongsToMany(User, { 
  through: UserRole, 
  foreignKey: 'role_id',
  otherKey: 'user_id'
});

// For convenience eager loading
UserRole.belongsTo(Role, { foreignKey: 'role_id' });
Role.hasMany(UserRole, { foreignKey: 'role_id' });

// User - LecturerProfile (One-to-One)
User.hasOne(LecturerProfile, { 
  foreignKey: 'user_id',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
LecturerProfile.belongsTo(User, { 
  foreignKey: 'user_id',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// Department - LecturerProfile (Many-to-Many)
Department.belongsToMany(LecturerProfile, { 
  through: DepartmentProfile, 
  foreignKey: 'dept_id',
  otherKey: 'profile_id'
});
LecturerProfile.belongsToMany(Department, { 
  through: DepartmentProfile, 
  foreignKey: 'profile_id',
  otherKey: 'dept_id'
});
// Course - Department relationships
Course.belongsTo(Department, { 
  foreignKey: 'dept_id', 
  onDelete: 'CASCADE', 
  onUpdate: 'CASCADE' 
});
Department.hasMany(Course, { 
  foreignKey: 'dept_id' 
});

// Class - Department relationships
ClassModel.belongsTo(Department, { 
  foreignKey: 'dept_id', 
  onDelete: 'CASCADE', 
  onUpdate: 'CASCADE' 
});
Department.hasMany(ClassModel, { 
  foreignKey: 'dept_id' 
});

// LecturerCourse relationships
LecturerCourse.belongsTo(LecturerProfile, { 
  foreignKey: 'lecturer_profile_id', 
  onDelete: 'CASCADE', 
  onUpdate: 'CASCADE' 
});
LecturerProfile.hasMany(LecturerCourse, { 
  foreignKey: 'lecturer_profile_id' 
});

LecturerCourse.belongsTo(Course, { 
  foreignKey: 'course_id', 
  onDelete: 'CASCADE', 
  onUpdate: 'CASCADE' 
});
Course.hasMany(LecturerCourse, { 
  foreignKey: 'course_id' 
});

// LecturerProfile - ResearchField (Many-to-Many)
LecturerProfile.belongsToMany(ResearchField, {
  through: LecturerResearchField,
  foreignKey: 'lecturer_profile_id',
  otherKey: 'research_field_id',
  as: 'ResearchFields',
  uniqueKey: 'lecturer_researchfield_unique'
});

ResearchField.belongsToMany(LecturerProfile, {
  through: LecturerResearchField,
  foreignKey: 'research_field_id',
  otherKey: 'lecturer_profile_id',
  as: 'LecturerProfiles',
  uniqueKey: 'lecturer_researchfield_unique'
});

// CourseMapping relationships
CourseMapping.belongsTo(ClassModel, { 
  foreignKey: 'class_id', 
  onDelete: 'CASCADE', 
  onUpdate: 'CASCADE' 
});
ClassModel.hasMany(CourseMapping, { 
  foreignKey: 'class_id' 
});

CourseMapping.belongsTo(Course, { 
  foreignKey: 'course_id', 
  onDelete: 'CASCADE', 
  onUpdate: 'CASCADE' 
});
Course.hasMany(CourseMapping, { 
  foreignKey: 'course_id' 
});

CourseMapping.belongsTo(LecturerProfile, { 
  foreignKey: 'lecturer_profile_id', 
  onDelete: 'SET NULL', 
  onUpdate: 'CASCADE' 
});
LecturerProfile.hasMany(CourseMapping, { 
  foreignKey: 'lecturer_profile_id' 
});

CourseMapping.belongsTo(Department, { 
  foreignKey: 'dept_id', 
  onDelete: 'SET NULL', 
  onUpdate: 'CASCADE' 
});
Department.hasMany(CourseMapping, { 
  foreignKey: 'dept_id' 
});

// Contract relationships
Contract.belongsTo(User, { 
  foreignKey: 'created_by', 
  onDelete: 'RESTRICT', 
  onUpdate: 'CASCADE' 
});
User.hasMany(Contract, { 
  foreignKey: 'created_by' 
});

// DigitalSignature relationships
DigitalSignature.belongsTo(Contract, { 
  foreignKey: 'contract_id', 
  onDelete: 'CASCADE', 
  onUpdate: 'CASCADE' 
});
Contract.hasMany(DigitalSignature, { 
  foreignKey: 'contract_id' 
});

DigitalSignature.belongsTo(User, { 
  foreignKey: 'user_id', 
  onDelete: 'CASCADE', 
  onUpdate: 'CASCADE' 
});
User.hasMany(DigitalSignature, { 
  foreignKey: 'user_id' 
});

// Teaching contract relationships
TeachingContract.belongsTo(User, { foreignKey: 'lecturer_user_id', as: 'lecturer', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
TeachingContract.belongsTo(User, { foreignKey: 'created_by', as: 'creator', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
User.hasMany(TeachingContract, { foreignKey: 'lecturer_user_id', as: 'lecturerContracts' });
User.hasMany(TeachingContract, { foreignKey: 'created_by', as: 'createdContracts' });

TeachingContractCourse.belongsTo(TeachingContract, { foreignKey: 'contract_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
TeachingContract.hasMany(TeachingContractCourse, { foreignKey: 'contract_id', as: 'courses' });

TeachingContractCourse.belongsTo(Course, { foreignKey: 'course_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Course.hasMany(TeachingContractCourse, { foreignKey: 'course_id' });

TeachingContractCourse.belongsTo(ClassModel, { foreignKey: 'class_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
ClassModel.hasMany(TeachingContractCourse, { foreignKey: 'class_id' });

// Candidate - CandidateQuestion - InterviewQuestion relationships
Candidate.hasMany(CandidateQuestion, {
  foreignKey: 'candidate_id',
  as: 'interviewResponses', // Alias for accessing candidate's interview responses
  onDelete: 'CASCADE', // Delete responses when candidate is deleted
  onUpdate: 'CASCADE'
});

CandidateQuestion.belongsTo(Candidate, {
  foreignKey: 'candidate_id',
  as: 'candidate', // Alias for accessing the candidate from a response
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

InterviewQuestion.hasMany(CandidateQuestion, {
  foreignKey: 'question_id',
  as: 'candidateResponses', // Alias for accessing all responses to this question
  onDelete: 'CASCADE', // Delete responses when question is deleted
  onUpdate: 'CASCADE'
});

CandidateQuestion.belongsTo(InterviewQuestion, {
  foreignKey: 'question_id',
  as: 'question', // Alias for accessing the question from a response
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// Export all models
export {
  User,
  Role,
  Department,
  ResearchField,
  Major,
  UserRole,
  DepartmentProfile,
  LecturerProfile,
  Course,
  ClassModel,
  LecturerCourse,
  LecturerResearchField,
  CourseMapping,
  Contract,
  DigitalSignature,
  Candidate,
  InterviewQuestion,
  CandidateQuestion,
  University,
  TeachingContract,
  TeachingContractCourse
};

// Default export (User for backward compatibility)
export default User;
