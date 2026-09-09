/**
 * Ensure ONECOMIT tenant admin exists (aligned with VPS / README).
 * Idempotent. Password default: ChangeMe!2026
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config({ path: require('path').join(__dirname, '../../.env') });
dotenv.config();

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
  });
  await dataSource.initialize();

  const email = (process.env.ONECOMIT_ADMIN_EMAIL ?? 'admin@onecomit.sn').toLowerCase();
  const password = process.env.ONECOMIT_ADMIN_PASSWORD ?? 'ChangeMe!2026';
  const fullName = process.env.ONECOMIT_ADMIN_NAME ?? 'Admin ONECOMIT';
  const companyName = 'ONECOMIT';
  const passwordHash = await bcrypt.hash(password, 10);

  let companies = await dataSource.query(
    `SELECT id FROM companies WHERE lower(name) = lower($1) LIMIT 1`,
    [companyName],
  );
  let companyId: string;
  if (companies.length === 0) {
    const inserted = await dataSource.query(
      `INSERT INTO companies (id, name, sonatel_subcontractor_name, active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, true, now(), now())
       RETURNING id`,
      [companyName, '3STB'],
    );
    companyId = inserted[0].id;
    console.log(`company créée : ${companyName} (${companyId})`);
  } else {
    companyId = companies[0].id;
    console.log(`company existante : ${companyName} (${companyId})`);
  }

  const existing = await dataSource.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
  if (existing.length > 0) {
    await dataSource.query(
      `UPDATE users SET password_hash = $2, full_name = $3, role = 'admin', company_id = $4,
        active = true, updated_at = now() WHERE email = $1`,
      [email, passwordHash, fullName, companyId],
    );
    console.log(`admin tenant mis à jour : ${email}`);
  } else {
    await dataSource.query(
      `INSERT INTO users (id, company_id, email, password_hash, full_name, role, active, license_type, license_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'admin', true, 'web', true, now(), now())`,
      [companyId, email, passwordHash, fullName],
    );
    console.log(`admin tenant créé : ${email}`);
  }

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('ensure-onecomit-admin échoué :', err);
  process.exit(1);
});
