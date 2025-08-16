import { User, Role, Department, UserRole, DepartmentProfile, LecturerProfile } from '../model/user.model.js';
import bcrypt from 'bcrypt';
import { Sequelize, Op } from 'sequelize';
import sequelize from '../config/db.js';

/**
 * Get all users with pagination
 * Query params: page (1-based), limit, role, department, search
 */
export const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const offset = (page - 1) * limit;

    const roleFilter = (req.query.role || '').trim().toLowerCase();
    const deptFilter = (req.query.department || '').trim();
    const search = (req.query.search || '').trim();

    const roleInclude = {
      model: Role,
      attributes: ['role_type'],
      through: { attributes: [] },
      required: false
    };

    const andConditions = [];
    if (deptFilter && deptFilter !== 'all') andConditions.push({ department_name: deptFilter });
    if (search) andConditions.push({ [Op.or]: [ { email: { [Op.like]: `%${search}%` } }, { display_name: { [Op.like]: `%${search}%` } } ] });

    if (roleFilter && roleFilter !== 'all') {
      if (roleFilter === 'superadmin') {
        andConditions.push({ email: 'superadmin@cadt.edu.kh' });
      } else {
        roleInclude.required = true;
        roleInclude.where = { role_type: roleFilter };
      }
    }

    const where = andConditions.length ? { [Op.and]: andConditions } : undefined;

    console.log(`Getting users page=${page} limit=${limit} role=${roleFilter||'*'} dept=${deptFilter||'*'} search=${search||'*'}`);

    const { rows, count } = await User.findAndCountAll({
      attributes: ['id', 'email', 'status', 'created_at', 'display_name', 'department_name', 'last_login'],
      include: [roleInclude],
      where,
      limit,
      offset,
      distinct: true,
      order: [['created_at', 'DESC']]
    });

    const formattedUsers = rows.map(user => {
      let role = user.Roles && user.Roles.length ? user.Roles[0].role_type : 'User';
      let name = user.display_name;
      if (!name) {
        const emailName = user.email.split('@')[0].replace(/\./g, ' ');
        name = emailName.split(' ').map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
      }
      let department = user.department_name || 'General';
      if (user.email === 'superadmin@cadt.edu.kh') { role = 'superadmin'; name = 'Super Admin'; department = 'Administration'; }
      return { id: user.id, name, email: user.email, role, department, status: user.status || 'active', createdAt: user.created_at, lastLogin: user.last_login ? user.last_login : 'Never' };
    });

    const totalPages = Math.ceil(count / limit) || 1;
    res.status(200).json({ data: formattedUsers, meta: { page, limit, total: count, totalPages } });
  } catch (error) {
    console.error('Error fetching users - Details:', error);
    if (error.parent) {
      console.error('Database error:', error.parent.message);
      console.error('SQL:', error.sql);
    }
    res.status(500).json({ message: 'Error fetching users', error: error.message, details: process.env.NODE_ENV === 'development' ? error.stack : undefined });
  }
};

/**
 * Create a new user
 * @route POST /api/users
 * @access Private (Super Admin only)
 */
export const createUser = async (req, res) => {
  try {
    const { fullName, email, role, department } = req.body;
    const errors = {};
    if (!fullName || !fullName.trim()) errors.fullName = "Full name is required";
    if (!email || !email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[A-Z0-9._%+-]+@cadt\.edu\.kh$/i.test(email)) {
      errors.email = "Email must be a CADT address (example@cadt.edu.kh)";
    } else if (await User.findOne({ where: { email } })) {
      errors.email = "Email is already registered";
    }
    if (!role) errors.role = "Role is required";
    if (!department) errors.department = "Department is required";
    if (Object.keys(errors).length > 0) return res.status(400).json({ message: "Validation failed", errors });

    // Generate a random temporary password (>= 8 chars)
    const TEMP_LEN = 10; // >6 requirement
    let tempPassword = '';
    while (tempPassword.length < TEMP_LEN) {
      tempPassword += Math.random().toString(36).slice(2); // append chunk
    }
    tempPassword = tempPassword.slice(0, TEMP_LEN);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const result = await sequelize.transaction(async (t) => {
      const newUser = await User.create({ email, password_hash: passwordHash, display_name: fullName, department_name: department }, { transaction: t });

      const [userRole] = await Role.findOrCreate({
        where: { role_type: role }, // logical attribute (mapped to name)
        defaults: { role_type: role },
        transaction: t
      });

      const [userDepartment] = await Department.findOrCreate({
        where: { dept_name: department }, // logical attribute (mapped to name)
        defaults: { dept_name: department },
        transaction: t
      });

      await UserRole.create({ user_id: newUser.id, role_id: userRole.id }, { transaction: t });

      let lecturerProfile = null;
      if (role.toLowerCase() === 'lecturer') {
        lecturerProfile = await LecturerProfile.create({
          user_id: newUser.id,
          employee_id: `EMP${Date.now().toString().slice(-6)}`,
          first_name: fullName.split(' ')[0],
          last_name: fullName.split(' ').slice(1).join(' ') || '',
          position: 'Lecturer',
          join_date: new Date(),
          status: 'active',
          cv_uploaded: false,
            cv_file_path: '',
          qualifications: ''
        }, { transaction: t });

        await DepartmentProfile.create({ dept_id: userDepartment.id, profile_id: lecturerProfile.id }, { transaction: t });
      }

      return { user: newUser, tempPassword, role: userRole.role_type, department: userDepartment.dept_name, lecturerProfile };
    });

    const responseData = { id: result.user.id, email: result.user.email, role: result.role, department: result.department, tempPassword: result.tempPassword };
    if (result.lecturerProfile) {
      responseData.profile = {
        employeeId: result.lecturerProfile.employee_id,
        firstName: result.lecturerProfile.first_name,
        lastName: result.lecturerProfile.last_name,
        position: result.lecturerProfile.position
      };
    }

    res.status(201).json(responseData);
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.parent) {
      console.error('DB parent error message:', error.parent.message);
      console.error('SQL:', error.sql);
    }
    res.status(500).json({ message: 'Failed to create user', error: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, role, department } = req.body;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (email) user.email = email.toLowerCase();
    if (fullName) user.display_name = fullName;
    if (department) user.department_name = department;
    await user.save();

    // Update role if provided
    if (role) {
      const [roleModel] = await Role.findOrCreate({ where: { role_type: role }, defaults: { role_type: role } });
      // Remove existing
      await UserRole.destroy({ where: { user_id: user.id } });
      await UserRole.create({ user_id: user.id, role_id: roleModel.id });
    }
    return res.json({ message: 'User updated' });
  } catch (e) {
    console.error('updateUser error', e);
    return res.status(500).json({ message: 'Failed to update user' });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.status = user.status === 'active' ? 'inactive' : 'active';
    await user.save();
    return res.json({ message: 'Status updated', status: user.status });
  } catch (e) {
    console.error('toggleUserStatus error', e);
    return res.status(500).json({ message: 'Failed to update status' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await user.destroy();
    return res.json({ message: 'User deleted' });
  } catch (e) {
    console.error('deleteUser error', e); return res.status(500).json({ message: 'Failed to delete user' });
  }
};
