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
import lecturerSelfRoutes from './route/lecturerSelf.route.js';
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
import contractsRoutes from './route/contracts.route.js';
import lecturerDashboardRoutes from './route/lecturerDashboard.route.js';
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
// Allow flexible localhost origins in development (Vite may pick a random port)
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // mobile apps / curl
    // Allow exact configured origin
    if (origin === ORIGIN) return callback(null, true);
    // Allow any localhost:* during development
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/i.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};
app.use(cors(corsOptions));

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
app.use('/api/lecturer', lecturerSelfRoutes);
app.use('/api/lecturer-profile', lecturerProfileRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/course-mappings', courseMappingRoutes);
app.use('/api/research-fields', researchFieldRoutes);
app.use('/api/universities', universityRoutes);
app.use('/api/majors', majorRoutes);
app.use('/api/teaching-contracts', teachingContractRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/lecturer-dashboard', lecturerDashboardRoutes);
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

    // Ensure Course_Mappings has dual theory/lab columns (non-destructive add-if-missing)
    try {
      const table = 'Course_Mappings';
      const addIfMissing = async (col, ddl) => {
        const [rows] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${col}'`);
        if (!rows.length) {
          console.log(`[schema] Adding missing column ${table}.${col}`);
          await sequelize.query(ddl);
        }
      };
      await addIfMissing('theory_hours', "ALTER TABLE `Course_Mappings` ADD COLUMN `theory_hours` VARCHAR(10) NULL AFTER `type_hours`");
      await addIfMissing('theory_groups', "ALTER TABLE `Course_Mappings` ADD COLUMN `theory_groups` INT NULL DEFAULT 0 AFTER `theory_hours`");
  await addIfMissing('lab_hours', "ALTER TABLE `Course_Mappings` ADD COLUMN `lab_hours` VARCHAR(10) NULL AFTER `theory_groups`");
  await addIfMissing('lab_groups', "ALTER TABLE `Course_Mappings` ADD COLUMN `lab_groups` INT NULL DEFAULT 0 AFTER `lab_hours`");
  await addIfMissing('theory_15h_combined', "ALTER TABLE `Course_Mappings` ADD COLUMN `theory_15h_combined` TINYINT(1) NULL DEFAULT 0 AFTER `theory_groups`");
    } catch (e) {
      console.warn('[schema] ensure Course_Mappings theory/lab columns failed:', e.message);
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
        await addIfMissing('items', "ALTER TABLE `Teaching_Contracts` ADD COLUMN `items` TEXT NULL AFTER `pdf_path`");

        // Migrate legacy DRAFT status to MANAGEMENT_SIGNED and drop DRAFT from ENUM
        try {
          const [rows] = await sequelize.query("SHOW COLUMNS FROM `Teaching_Contracts` LIKE 'status'");
          const type = rows?.[0]?.Type || '';
          if (/enum\(/i.test(type) && /'DRAFT'/i.test(type)) {
            console.log('[schema] Migrating Teaching_Contracts.status: DRAFT -> MANAGEMENT_SIGNED and dropping DRAFT from enum');
            await sequelize.query("UPDATE `Teaching_Contracts` SET `status`='MANAGEMENT_SIGNED' WHERE `status`='DRAFT'");
            await sequelize.query("ALTER TABLE `Teaching_Contracts` MODIFY COLUMN `status` ENUM('LECTURER_SIGNED','MANAGEMENT_SIGNED','COMPLETED') NOT NULL DEFAULT 'MANAGEMENT_SIGNED'");
          }
        } catch (e) {
          console.warn('[schema] migrate Teaching_Contracts.status failed:', e.message);
        }
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

    // Ensure contract_items table exists and is aligned with Teaching_Contracts (store Duties)
    try {
      const ensureTable = async (name, ddl) => {
        const [rows] = await sequelize.query(`SHOW TABLES LIKE '${name}'`);
        if (!rows.length) {
          console.log(`[schema] Creating table ${name}`);
          await sequelize.query(ddl);
        }
      };
      await ensureTable('contract_items', `
        CREATE TABLE contract_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          contract_id INT UNSIGNED NOT NULL,
          duties TEXT NOT NULL,
          CONSTRAINT fk_contract_items_contract FOREIGN KEY (contract_id) REFERENCES Teaching_Contracts(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // If table exists from older deployment, migrate column and FK
      try {
        const [colItem] = await sequelize.query("SHOW COLUMNS FROM `contract_items` LIKE 'item'");
        const [colDuties] = await sequelize.query("SHOW COLUMNS FROM `contract_items` LIKE 'duties'");
        if (colItem.length && !colDuties.length) {
          console.log('[schema] Renaming contract_items.item -> duties');
          await sequelize.query("ALTER TABLE `contract_items` CHANGE COLUMN `item` `duties` TEXT NOT NULL");
        }
      } catch (e) {
        console.warn('[schema] migrate contract_items item->duties failed:', e.message);
      }

      // Ensure FK references Teaching_Contracts (drop legacy FKs like `contract_items_ibfk_1` to `contracts`)
      try {
        // Find and drop any FK on contract_items.contract_id not pointing to Teaching_Contracts
        const [fks] = await sequelize.query(`
          SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME
          FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'contract_items'
            AND COLUMN_NAME = 'contract_id'
            AND REFERENCED_TABLE_NAME IS NOT NULL;
        `);
        for (const fk of fks) {
          const name = fk.CONSTRAINT_NAME;
          const ref = (fk.REFERENCED_TABLE_NAME || '').toString();
          if (ref.toLowerCase() !== 'teaching_contracts') {
            console.log(`[schema] Dropping legacy FK ${name} on contract_items.contract_id -> ${ref}`);
            try { await sequelize.query(`ALTER TABLE \`contract_items\` DROP FOREIGN KEY \`${name}\``); } catch (e) { console.warn(`[schema] drop FK ${name} failed:`, e.message); }
          }
        }
        // Extra safety: drop any remaining FK constraints on contract_items (then we re-add the single correct FK)
        const [fkConstraints] = await sequelize.query(`
          SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract_items' AND CONSTRAINT_TYPE = 'FOREIGN KEY';
        `);
        for (const row of fkConstraints) {
          const name = row.CONSTRAINT_NAME;
          console.log(`[schema] Dropping FK ${name} on contract_items (safety cleanup)`);
          try { await sequelize.query(`ALTER TABLE \`contract_items\` DROP FOREIGN KEY \`${name}\``); } catch (e) { console.warn(`[schema] drop FK ${name} failed:`, e.message); }
        }
      } catch (e) {
        console.warn('[schema] inspect contract_items FKs failed:', e.message);
      }
      // Drop by common legacy names first, ignore failures
      try { await sequelize.query("ALTER TABLE `contract_items` DROP FOREIGN KEY `contract_items_ibfk_1`"); } catch {}
      try { await sequelize.query("ALTER TABLE `contract_items` DROP FOREIGN KEY `contract_items_ibfk_2`"); } catch {}
      try { await sequelize.query("ALTER TABLE `contract_items` DROP FOREIGN KEY `fk_contract_items_contract`"); } catch {}
      try { await sequelize.query("ALTER TABLE `contract_items` DROP FOREIGN KEY `fk_contract_items_teaching_contracts`"); } catch {}
      try {
        await sequelize.query("ALTER TABLE `contract_items` ADD CONSTRAINT `fk_contract_items_teaching_contracts` FOREIGN KEY (`contract_id`) REFERENCES `Teaching_Contracts`(`id`) ON DELETE CASCADE");
      } catch (e) {
        console.warn('[schema] ensure contract_items FK to Teaching_Contracts failed (may already exist or orphan rows present):', e.message);
      }
    } catch (e) {
      console.warn('[schema] ensure contract_items table failed:', e.message);
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
