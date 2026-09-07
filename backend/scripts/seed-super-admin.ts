import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Seed du compte console Green-T (super_admin, hors tenant).
 * Idempotent : met à jour le mot de passe si le compte existe déjà.
 */
async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: process.env.NODE_ENV !== 'production',
    entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
  });
  await dataSource.initialize();

  const email = (process.env.GREEN_T_ADMIN_EMAIL ?? 'admin@green-t.sn').toLowerCase();
  const password = process.env.GREEN_T_ADMIN_PASSWORD ?? 'ChangeMe!2026';
  const fullName = process.env.GREEN_T_ADMIN_NAME ?? 'Green-T Super Admin';
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await dataSource.query(
    'SELECT id FROM users WHERE email = $1 LIMIT 1',
    [email],
  );

  if (existing.length > 0) {
    await dataSource.query(
      'UPDATE users SET password_hash = $2, full_name = $3, role = $4, active = true, updated_at = now() WHERE email = $1',
      [email, passwordHash, fullName, 'super_admin'],
    );
    console.log(`super_admin mis à jour : ${email}`);
  } else {
    await dataSource.query(
      `INSERT INTO users (id, company_id, email, password_hash, full_name, role, active, license_type, license_active)
       VALUES (gen_random_uuid(), NULL, $1, $2, $3, 'super_admin', true, 'web', true)`,
      [email, passwordHash, fullName],
    );
    console.log(`super_admin créé : ${email}`);
  }

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed échoué :', err);
  process.exit(1);
});
