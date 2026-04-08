const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
  const client = new Client({
    host: process.env.DB_HOST_RESTORED || process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to RDS...');
    await client.connect();
    console.log('Connected!');

    console.log('Creating user_profiles table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "maywin_db"."user_profiles" (
        "id" BIGSERIAL PRIMARY KEY,
        "user_id" BIGINT NOT NULL UNIQUE,
        "avatar_data" TEXT,
        "bio" TEXT,
        "phone_number" TEXT,
        "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_user_profile_user" FOREIGN KEY ("user_id") 
          REFERENCES "maywin_db"."users"("id") ON DELETE CASCADE
      );
    `);

    console.log('Creating index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_profiles_user_id" ON "maywin_db"."user_profiles" ("user_id");
    `);

    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
