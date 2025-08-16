import sequelize from '../config/db.js';
import { DataTypes } from 'sequelize';

// Define the users table schema
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password' // Map to the actual column name in database
  },
  // ...re-added status field now that the column exists in DB
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active'
  },
  display_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  department_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'Users', // Match the exact table name from schema
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define Role model
const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // Keep logical name role_type but map to physical column `name`
  role_type: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'name'
  }
}, {
  tableName: 'Roles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define Department model
const Department = sequelize.define('Department', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // Keep logical name dept_name but map to physical column `name`
  dept_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'name'
  }

}, {
  tableName: 'Departments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define UserRole junction model
const UserRole = sequelize.define('UserRole', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Roles', key: 'id' }
  }
}, {
  tableName: 'User_Roles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define Department_Profiles junction model 
const DepartmentProfile = sequelize.define('DepartmentProfile', {
  dept_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'Departments',
      key: 'id'
    }
  },
  profile_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'Lectuer_Profiles', // Match the actual table name in database
      key: 'id'
    }
  }
}, {
  tableName: 'Department_Profiles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define Lecturer Profile model
const LecturerProfile = sequelize.define('LecturerProfile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    field: 'user_id (fk)' // Match the actual column name in database
  },
  employee_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  first_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  last_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  position: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  join_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false
  },
  cv_uploaded: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  cv_file_path: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  qualifications: {
    type: DataTypes.STRING(255),
    allowNull: false
  }
}, {
  tableName: 'Lectuer_Profiles', // Match the exact table name from schema (note the typo)
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define relationships
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

// User to Profiles
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

// Department to Profile relationships
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

export { User, Role, Department, UserRole, DepartmentProfile, LecturerProfile };
export default User;