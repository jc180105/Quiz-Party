const { Pool } = require('pg');
const { log } = require('./utils');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Railway/Cloud connections
    }
});

async function query(text, params) {
    return pool.query(text, params);
}

async function initDB() {
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Table: Settings
            await client.query(`
        CREATE TABLE IF NOT EXISTS settings (
          key VARCHAR(50) PRIMARY KEY,
          value JSONB NOT NULL
        );
      `);

            // Table: Questions
            // Storing options as JSONB to preserve structure easily without complex joins for now
            await client.query(`
        CREATE TABLE IF NOT EXISTS questions (
          id BIGINT PRIMARY KEY,
          type VARCHAR(20),
          question TEXT,
          time INT,
          image TEXT,
          options JSONB,
          correct INT
        );
      `);

            // Table: Images
            await client.query(`
        CREATE TABLE IF NOT EXISTS images (
          id SERIAL PRIMARY KEY,
          data BYTEA NOT NULL,
          mime_type VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

            await client.query('COMMIT');
            log.info('✅ Database initialized successfully');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        log.error('❌ Failed to initialize database:', err);
        process.exit(1);
    }
}

module.exports = {
    query,
    initDB,
    pool
};
