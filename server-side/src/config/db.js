import { Sequelize } from "sequelize";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const DB_NAME = process.env.DATABASE_NAME;
const DB_USER = process.env.DATABASE_USER; 
const DB_PASS = process.env.DATABASE_PASSWORD;
const DB_HOST = process.env.DATABASE_HOST; 

// Ensure the database exists
async function ensureDatabase() {
    const connection = await mysql.createConnection({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASS,
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
    await connection.end();
}

// Immediately invoke to ensure DB exists before Sequelize connects
await ensureDatabase();

const sequelize = new Sequelize(
    DB_NAME,
    DB_USER,
    DB_PASS,
    {
        host: DB_HOST,
        dialect: "mysql",
    }
);

export default sequelize;