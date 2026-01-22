/**
 * Script para generar un token de prueba JWT
 */

import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const token = jwt.sign(
  {
    id: 'test-user-id-12345',
    userId: 'test-user-id-12345',
    email: 'test@verbadocpro.com',
    role: 'admin'
  },
  process.env.JWT_SECRET!,
  { expiresIn: '30d' }
);

console.log('\n✅ Token de prueba generado exitosamente!\n');
console.log('Añade esta línea a tu .env.local:\n');
console.log(`TEST_AUTH_TOKEN=${token}\n`);
console.log('Este token es válido por 30 días.\n');
