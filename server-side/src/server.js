import express from "express";
import dotenv from "dotenv";
import cors from 'cors';
import cookieParser from 'cookie-parser';
import sequelize from "./config/db.js";
import authRoutes from "./route/auth.route.js";
import candidateRoutes from './route/candidate.route.js';
import dashboardRoutes from './route/dashboard.route.js';
import profileRoutes from './route/profile.route.js';
import interviewRoutes from './route/interview.route.js';
import userRoutes from './route/user.route.js';
import lecturerRoutes from './route/lecturer.route.js';
import lecturerProfileRoutes from './route/lecturerProfile.route.js';
import onboardingRoutes from './route/onboarding.route.js';
import classRoutes from './route/class.route.js';
import courseRoutes from './route/course.route.js';
import catalogRoutes from './route/catalog.route.js';
import courseMappingRoutes from './route/courseMapping.route.js';
import researchFieldRoutes from './route/researchField.route.js';
import universityRoutes from './route/university.route.js';
import majorRoutes from './route/major.route.js';
import { seedInterviewQuestions } from './utils/seedInterviewQuestions.js';
import { seedResearchFields } from './utils/seedResearchFields.js';
import { seedUniversities } from './utils/seedUniversities.js';
import { seedMajors } from './utils/seedMajors.js';
// Import models to ensure they are loaded with associations
import './model/index.js';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: ORIGIN, credentials: true }));

app.use('/api/auth', authRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/interview-questions', interviewRoutes);
app.use('/api/users', userRoutes);
// IMPORTANT: Mount the more specific lecturer onboarding route BEFORE the generic /api/lecturers route.
// Otherwise requests to /api/lecturers/onboarding/* would be captured by the /api/lecturers router
// which is admin-only, causing 403 errors for lecturers fetching their onboarding status.
app.use('/api/lecturers/onboarding', onboardingRoutes);
app.use('/api/lecturers', lecturerRoutes);
app.use('/api/lecturer-profile', lecturerProfileRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/course-mappings', courseMappingRoutes);
app.use('/api/research-fields', researchFieldRoutes);
app.use('/api/universities', universityRoutes);
app.use('/api/majors', majorRoutes);
// Serve uploaded lecturer files (CVs, syllabi)
app.use('/uploads', express.static('uploads'));
// Swagger/OpenAPI docs
const openapiPath = path.join(process.cwd(), 'src', 'openapi.json');
let openapiDoc = null;
try { openapiDoc = JSON.parse(fs.readFileSync(openapiPath, 'utf-8')); } catch (e) { console.error('Failed to load openapi.json', e.message); openapiDoc = { openapi: '3.0.0', info: { title: 'API Docs', version: '0.0.0' } }; }
app.get('/api/openapi.json', (_req,res)=> res.json(openapiDoc));
app.use('/api/doc', swaggerUi.serve, swaggerUi.setup(openapiDoc));
// Liveness/health check endpoint used by uptime monitors or container orchestrators
// to quickly verify the API process is running (does not perform deep dependency checks).
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

/* async function ensureUserColumns() {
  const columns = [
    { name: 'status', ddl: "ALTER TABLE `Users` ADD COLUMN `status` ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER `password`" },
    { name: 'display_name', ddl: "ALTER TABLE `Users` ADD COLUMN `display_name` VARCHAR(255) NULL AFTER `email`" },
    { name: 'department_name', ddl: "ALTER TABLE `Users` ADD COLUMN `department_name` VARCHAR(255) NULL AFTER `display_name`" },
    { name: 'last_login', ddl: "ALTER TABLE `Users` ADD COLUMN `last_login` DATETIME NULL AFTER `department_name`" }
  ];
  try {
    for (const col of columns) {
      const [rows] = await sequelize.query(`SHOW COLUMNS FROM \`Users\` LIKE '${col.name}'`);
      if (rows.length === 0) {
        console.log(`Adding missing column: ${col.name}`);
        await sequelize.query(col.ddl);
      }
    }
  } catch (e) {
    console.error('Column ensure failed:', e.message);
  }
}
 */

// Ensure Classes.dept_id allows NULL (legacy schema may have NOT NULL constraint)
/* async function ensureClassDeptNullable() {
  try {
    const [rows] = await sequelize.query("SHOW COLUMNS FROM `Classes` LIKE 'dept_id'");
    if (rows.length && rows[0].Null === 'NO') {
      console.log('Altering Classes.dept_id to allow NULL');
      await sequelize.query('ALTER TABLE `Classes` MODIFY `dept_id` INT NULL');
    }
  } catch (e) {
    console.error('Class dept_id alter failed:', e.message);
  }
}
 */
// Prevent runaway duplicate indexes (root cause of: Too many keys specified; max 64 keys allowed)
/* async function ensureUniqueIndexes() {
  try {
    const [indexes] = await sequelize.query('SHOW INDEX FROM `Users`');
    const emailIndexes = indexes.filter(i => i.Column_name === 'email' && i.Non_unique === 0);
    // Keep only first (oldest) unique email index
    if (emailIndexes.length > 1) {
      // Sort by Key_name to deterministically keep one
      const toDrop = emailIndexes.slice(1); // drop all but first
      for (const idx of toDrop) {
        try {
          console.log('Dropping duplicate unique index on Users.email:', idx.Key_name);
          await sequelize.query(`ALTER TABLE \`Users\` DROP INDEX \`${idx.Key_name}\``);
        } catch (e) {
          console.warn('Drop index failed', idx.Key_name, e.message);
        }
      }
    }
    // If no unique email index exists, create one
    if (emailIndexes.length === 0) {
      console.log('Creating unique index uniq_users_email');
      await sequelize.query('ALTER TABLE `Users` ADD UNIQUE INDEX `uniq_users_email` (`email`)');
    }
  } catch (e) {
    console.error('ensureUniqueIndexes failed:', e.message);
  }
}
 */

// Ensure candidates.dept_id exists for department scoping of recruitment
/* async function ensureCandidateDeptIdColumn() {
  try {
    const [rows] = await sequelize.query("SHOW COLUMNS FROM `candidates` LIKE 'dept_id'");
    if (!rows.length) {
      console.log('Adding missing column candidates.dept_id');
      await sequelize.query('ALTER TABLE `candidates` ADD COLUMN `dept_id` INT NULL AFTER `evaluator`');
    }
  } catch (e) {
    console.error('ensureCandidateDeptIdColumn failed:', e.message);
  }
} */

// Optimized startup: avoid slow ALTER each run. Use environment flags to opt-in when needed.
//   DB_ALTER_SYNC=true     -> run sequelize.sync({ alter: true }) (non-destructive; can be slow)
//   DB_FORCE_SYNC=true     -> run sequelize.sync({ force: true }) (DESTRUCTIVE: drops tables)
//   SEED_INTERVIEW_QUESTIONS=true -> seed interview questions if empty (or SEED_FORCE=true to replace)
//   SQL_LOG=true           -> enable raw SQL logging (configured in db.js)
(async () => {
  try {
    // Use alter:true only if DB_ALTER_SYNC is set, otherwise use safe sync
    const alterSync = process.env.DB_ALTER_SYNC === 'true';
    if (alterSync) {
      await sequelize.sync({ alter: true });
      console.log('[startup] Database synchronized (alter mode)');
    } else {
      await sequelize.sync();
      console.log('[startup] Database synchronized (safe mode)');
    }

    await seedInterviewQuestions(); // seeder has its own flag checks
    await seedResearchFields(); // seed research fields if empty
    await seedUniversities(); // seed universities if empty
    await seedMajors(); // seed majors if empty

    app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
  } catch (e) {
    console.error('Startup failure:', e.message);
    process.exit(1);
  }
})(); // Trigger restart
