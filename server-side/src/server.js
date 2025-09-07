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
import teachingContractRoutes from './route/teachingContract.route.js';
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
app.use('/api/teaching-contracts', teachingContractRoutes);
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

(async () => {
  try {
    // Use alter:true only if DB_ALTER_SYNC is set, otherwise use safe sync
    const alterSync = process.env.DB_ALTER_SYNC === 'false';
    if (alterSync) {
      await sequelize.sync({ alter: true });
      console.log('[startup] Database synchronized (alter mode)');
    } else {
      await sequelize.sync();
      console.log('[startup] Database synchronized (safe mode)');
    }

    // Ensure new columns exist on legacy Teaching_Contracts table
    async function ensureTeachingContractColumns() {
      try {
        const table = 'Teaching_Contracts';
        const addIfMissing = async (col, ddl) => {
          const [rows] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${col}'`);
          if (!rows.length) {
            console.log(`[schema] Adding missing column ${table}.${col}`);
            await sequelize.query(ddl);
          }
        };
        // Period columns used by UI Period display
        await addIfMissing('start_date', "ALTER TABLE `Teaching_Contracts` ADD COLUMN `start_date` DATE NULL AFTER `year_level`");
        await addIfMissing('end_date', "ALTER TABLE `Teaching_Contracts` ADD COLUMN `end_date` DATE NULL AFTER `start_date`");
        await addIfMissing('lecturer_signature_path', "ALTER TABLE `Teaching_Contracts` ADD COLUMN `lecturer_signature_path` VARCHAR(512) NULL AFTER `status`");
        await addIfMissing('management_signature_path', "ALTER TABLE `Teaching_Contracts` ADD COLUMN `management_signature_path` VARCHAR(512) NULL AFTER `lecturer_signature_path`");
        await addIfMissing('lecturer_signed_at', "ALTER TABLE `Teaching_Contracts` ADD COLUMN `lecturer_signed_at` DATETIME NULL AFTER `management_signature_path`");
        await addIfMissing('management_signed_at', "ALTER TABLE `Teaching_Contracts` ADD COLUMN `management_signed_at` DATETIME NULL AFTER `lecturer_signed_at`");
        await addIfMissing('pdf_path', "ALTER TABLE `Teaching_Contracts` ADD COLUMN `pdf_path` VARCHAR(512) NULL AFTER `management_signed_at`");
      } catch (e) {
        console.error('[schema] ensureTeachingContractColumns failed:', e.message);
      }
    }
    await ensureTeachingContractColumns();

    await seedInterviewQuestions(); // seeder has its own flag checks
    await seedResearchFields(); // seed research fields if empty
    await seedUniversities(); // seed universities if empty
    await seedMajors(); // seed majors if empty

    // Ensure lecturer_profiles has title & gender columns (non-destructive add-if-missing)
    try {
      const table = 'lecturer_profiles';
      const addIfMissing = async (col, ddl) => {
        const [rows] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${col}'`);
        if (!rows.length) {
          console.log(`[schema] Adding missing column ${table}.${col}`);
          await sequelize.query(ddl);
        }
      };
      await addIfMissing('title', "ALTER TABLE `lecturer_profiles` ADD COLUMN `title` ENUM('Mr','Ms','Mrs','Dr','Prof') NULL AFTER `employee_id`");
      await addIfMissing('gender', "ALTER TABLE `lecturer_profiles` ADD COLUMN `gender` ENUM('male','female','other') NULL AFTER `title`");
    } catch (e) {
      console.warn('[schema] ensure lecturer_profiles title/gender failed:', e.message);
    }

    // Ensure Candidates.status enum includes 'done' (attempt auto-alter for MySQL)
    try {
      const [rows] = await sequelize.query("SHOW COLUMNS FROM `Candidates` LIKE 'status'");
      const type = rows?.[0]?.Type || '';
      if (type && !/done/.test(type)) {
        console.log('[schema] Candidates.status missing value done; attempting to alter enum');
        await sequelize.query("ALTER TABLE `Candidates` MODIFY COLUMN `status` ENUM('pending','interview','discussion','accepted','rejected','done') NOT NULL DEFAULT 'pending'");
        console.log('[schema] Candidates.status enum altered to include done');
      }
    } catch (e) {
      console.warn('[schema] check Candidates.status failed:', e.message);
    }

    app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
  } catch (e) {
    console.error('Startup failure:', e.message);
    process.exit(1);
  }
})(); // Trigger restart
