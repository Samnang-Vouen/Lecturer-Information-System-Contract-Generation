# Model Structure Overview

This document outlines the restructured Sequelize model architecture following a modular, maintainable pattern.

## File Structure

```
server-side/src/model/
├── index.js                 # Central hub for associations and exports
├── user.model.js           # User accounts and authentication
├── role.model.js           # User roles (admin, lecturer, etc.)
├── department.model.js     # Academic departments
├── researchField.model.js  # Research fields (seeded, CRUD)
├── major.model.js          # Academic majors (seeded, CRUD)
├── userRole.model.js       # User-Role junction table
├── departmentProfile.model.js  # Department-Profile junction table
└── lecturerProfile.model.js    # Lecturer profile information
```

## Model Specifications

### Common Patterns
- **Primary Key**: `id` (INTEGER, autoIncrement, primaryKey)
- **Timestamps**: `created_at`, `updated_at` (automatic)
- **Table Names**: Plural (users, roles, majors, research_fields)
- **Export**: ES modules with `export default ModelName`

### Individual Models

#### 1. User (`user.model.js`)
```javascript
{
  id: INTEGER (PK),
  email: STRING(255) UNIQUE,
  password_hash: STRING(255) -> 'password' column,
  status: ENUM('active', 'inactive'),
  display_name: STRING(255),
  department_name: STRING(255),
  last_login: DATE
}
```

#### 2. Role (`role.model.js`)
```javascript
{
  id: INTEGER (PK),
  role_type: STRING(255) -> 'name' column
}
```

#### 3. Department (`department.model.js`)
```javascript
{
  id: INTEGER (PK),
  dept_name: STRING(255) -> 'name' column
}
```

#### 4. ResearchField (`researchField.model.js`)
```javascript
{
  id: INTEGER (PK),
  name: STRING(255) UNIQUE
}
```

#### 5. Major (`major.model.js`)
```javascript
{
  id: INTEGER (PK),
  name: STRING(255) UNIQUE
}
```

## Associations (defined in `index.js`)

### User ↔ Role (Many-to-Many)
- Through: `UserRole`
- User can have multiple roles
- Role can be assigned to multiple users

### User ↔ LecturerProfile (One-to-One)
- User.hasOne(LecturerProfile)
- LecturerProfile.belongsTo(User)
- CASCADE delete/update

### Department ↔ LecturerProfile (Many-to-Many)
- Through: `DepartmentProfile`
- Lecturer can belong to multiple departments
- Department can have multiple lecturers

## Seeded Models

### ResearchField
- **Source**: `utils/seedResearchFields.js`
- **Count**: 37 fields
- **API**: `/api/research-fields` (GET, POST)
- **Auto-create**: Yes (via findOrCreate)

### Major
- **Source**: `utils/seedMajors.js`
- **Count**: 40 majors
- **API**: `/api/majors` (GET, POST)
- **Auto-create**: Yes (via findOrCreate)

### University (existing)
- **Source**: `utils/seedUniversities.js`
- **Count**: 65 universities
- **API**: `/api/universities` (GET, POST)
- **Auto-create**: Yes (via findOrCreate)

## Import Pattern

### Controllers
```javascript
import { User, Role, Department, LecturerProfile } from '../model/index.js';
```

### Other Models
```javascript
import { Department } from './index.js';
```

### Main Application
```javascript
import './model/index.js'; // Loads all models with associations
```

## Benefits

1. **Separation of Concerns**: Each model focuses solely on schema definition
2. **Central Association Management**: All relationships defined in one place
3. **Consistent Exports**: Standardized import/export pattern
4. **Maintainable**: Easy to add new models or modify associations
5. **Type Safety**: Clear model interfaces for better development
6. **Modular**: Models can be imported individually or collectively

## Migration Notes

- All imports updated from `'../model/user.model.js'` to `'../model/index.js'`
- Table names changed from PascalCase to lowercase_plural
- Associations moved from individual models to central index.js
- No breaking changes to existing functionality
