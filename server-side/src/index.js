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
import { seedInterviewQuestions } from './utils/seedInterviewQuestions.js';

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
app.use('/api', interviewRoutes);
app.use('/api/users', userRoutes);
// Liveness/health check endpoint used by uptime monitors or container orchestrators
// to quickly verify the API process is running (does not perform deep dependency checks).
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

async function ensureUserColumns() {
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

(async () => {
  try {
    await sequelize.sync();
    console.log('Database synchronized');
    await ensureUserColumns();
  await seedInterviewQuestions();
    app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
  } catch (e) {
    console.error('Startup failure:', e.message);
    process.exit(1);
  }
})();