#!/usr/bin/env node

/**
 * Script to create an admin user
 *
 * Usage:
 *   node scripts/create-admin.js <email> <password> [name]
 */

require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || null;

  if (!email || !password) {
    console.error('ERROR: Email and password are required');
    console.log('Usage: node scripts/create-admin.js <email> <password> [name]');
    process.exit(1);
  }

  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: POSTGRES_URL or DATABASE_URL environment variable not configured');
    process.exit(1);
  }

  try {
    console.log('Creating admin user...');

    // Check if user already exists
    const existing = await sql`
      SELECT id, email FROM users WHERE email = ${email.toLowerCase()}
    `;

    if (existing.rows.length > 0) {
      console.log('User already exists. Making them admin...');
      await sql`
        UPDATE users
        SET role = 'admin'
        WHERE email = ${email.toLowerCase()}
        RETURNING id, email, name, role
      `;
      console.log('✅ User updated to admin role');
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new admin user
      const result = await sql`
        INSERT INTO users (email, password, name, role)
        VALUES (${email.toLowerCase()}, ${hashedPassword}, ${name}, 'admin')
        RETURNING id, email, name, role, created_at
      `;

      console.log('\n✅ Admin user created successfully!');
      console.log('ID:', result.rows[0].id);
      console.log('Email:', result.rows[0].email);
      console.log('Name:', result.rows[0].name);
      console.log('Role:', result.rows[0].role);
      console.log('\nYou can now login at: https://verbadocpro.eu/login');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin user:');
    console.error(error);
    process.exit(1);
  }
}

createAdmin();
