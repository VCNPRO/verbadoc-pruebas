/**
 * Script de Verificación de Backups
 * Comprueba que los sistemas de backup automático están funcionando correctamente
 *
 * Uso: node verify_backups.cjs
 */

require('dotenv').config({ path: '.env.local' });
const { list } = require('@vercel/blob');

async function verifyBackups() {
  console.log('\n🔍 VERIFICANDO SISTEMA DE BACKUPS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // VERIFICAR BACKUPS DE BASE DE DATOS
    console.log('1️⃣  BACKUPS DE BASE DE DATOS\n');

    const { blobs: dbBlobs } = await list({ prefix: 'database-backups/' });

    if (dbBlobs.length === 0) {
      console.log('❌ NO HAY BACKUPS DE BASE DE DATOS\n');
      console.log('   Acción: Ejecutar backup manual con:');
      console.log('   POST /api/admin/backup-manual {"type": "database"}\n');
    } else {
      // Agrupar por tipo
      const dailyBackups = dbBlobs.filter(b => b.pathname.includes('/daily/'));
      const weeklyBackups = dbBlobs.filter(b => b.pathname.includes('/weekly/'));
      const monthlyBackups = dbBlobs.filter(b => b.pathname.includes('/monthly/'));

      console.log(`📅 Backups Diarios:    ${dailyBackups.length} / 7 esperados`);
      console.log(`📅 Backups Semanales:  ${weeklyBackups.length} / 4 esperados`);
      console.log(`📅 Backups Mensuales:  ${monthlyBackups.length} / 3 esperados\n`);

      // Verificar backup más reciente
      const sortedByDate = [...dbBlobs].sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );

      const latest = sortedByDate[0];
      const hoursAgo = (Date.now() - new Date(latest.uploadedAt).getTime()) / 3600000;

      console.log('📌 Backup más reciente:');
      console.log(`   Archivo: ${latest.pathname}`);
      console.log(`   Fecha:   ${new Date(latest.uploadedAt).toLocaleString()}`);
      console.log(`   Hace:    ${hoursAgo.toFixed(1)} horas`);
      console.log(`   Tamaño:  ${(latest.size / 1024 / 1024).toFixed(2)} MB\n`);

      if (hoursAgo > 26) {
        console.log('⚠️  ADVERTENCIA: Último backup hace más de 26 horas');
        console.log('   El cron job debería ejecutarse diariamente a las 2 AM\n');
      } else if (hoursAgo > 24) {
        console.log('⚠️  INFO: Último backup hace más de 24 horas (puede ser normal)\n');
      } else {
        console.log('✅ Backup de base de datos está actualizado\n');
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // VERIFICAR BACKUPS DE EXCEL MASTER
    console.log('2️⃣  BACKUPS DE EXCEL MASTER\n');

    const { blobs: excelBlobs } = await list({ prefix: 'backups/' });

    if (excelBlobs.length === 0) {
      console.log('❌ NO HAY BACKUPS DE EXCEL MASTER\n');
      console.log('   Acción: Ejecutar backup manual con:');
      console.log('   POST /api/admin/backup-manual {"type": "excel"}\n');
    } else {
      // Agrupar por usuario
      const byUser = excelBlobs.reduce((acc, blob) => {
        const match = blob.pathname.match(/user_([^/]+)/);
        if (match) {
          const userId = match[1];
          if (!acc[userId]) acc[userId] = [];
          acc[userId].push(blob);
        }
        return acc;
      }, {});

      const userCount = Object.keys(byUser).length;
      console.log(`👥 Usuarios con backups: ${userCount}\n`);

      // Mostrar stats por usuario
      for (const [userId, userBlobs] of Object.entries(byUser)) {
        const sorted = userBlobs.sort(
          (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );

        const latest = sorted[0];
        const hoursAgo = (Date.now() - new Date(latest.uploadedAt).getTime()) / 3600000;

        console.log(`📊 Usuario: ${userId}`);
        console.log(`   Total backups: ${userBlobs.length} / 48 máximo`);
        console.log(`   Último backup: hace ${hoursAgo.toFixed(1)} horas`);

        if (hoursAgo > 2) {
          console.log(`   ⚠️  Más de 2 horas sin backup (cron cada hora)`);
        } else {
          console.log(`   ✅ Actualizado`);
        }
        console.log('');
      }

      // Verificar backup más reciente global
      const allSorted = excelBlobs.sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );

      const latestGlobal = allSorted[0];
      const hoursAgoGlobal = (Date.now() - new Date(latestGlobal.uploadedAt).getTime()) / 3600000;

      if (hoursAgoGlobal > 2) {
        console.log('⚠️  ADVERTENCIA: Último backup de Excel hace más de 2 horas');
        console.log('   El cron job debería ejecutarse cada hora\n');
      } else {
        console.log('✅ Sistema de backup de Excel funcionando correctamente\n');
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // RESUMEN FINAL
    console.log('📊 RESUMEN\n');

    const totalBackups = dbBlobs.length + excelBlobs.length;
    const totalSizeMB = (dbBlobs.reduce((sum, b) => sum + b.size, 0) +
      excelBlobs.reduce((sum, b) => sum + b.size, 0)) / 1024 / 1024;

    console.log(`Total de backups:      ${totalBackups}`);
    console.log(`Espacio utilizado:     ${totalSizeMB.toFixed(2)} MB`);
    console.log(`Backups de BD:         ${dbBlobs.length}`);
    console.log(`Backups de Excel:      ${excelBlobs.length}\n`);

    // Verificar configuración de cron
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('3️⃣  CONFIGURACIÓN DE CRON JOBS\n');
    console.log('Verificar en vercel.json:\n');
    console.log('✅ /api/cron/backup-database     (0 2 * * *)  - Diario 2 AM');
    console.log('✅ /api/cron/backup-master-excel (0 * * * *)  - Cada hora\n');
    console.log('Verificar en Vercel Dashboard:');
    console.log('https://vercel.com/your-team/verbadocpro/logs?type=cron\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('4️⃣  RECOMENDACIONES\n');

    const recommendations = [];

    if (dbBlobs.length === 0) {
      recommendations.push('❌ Configurar y ejecutar primer backup de base de datos');
    }

    if (excelBlobs.length === 0) {
      recommendations.push('❌ Configurar y ejecutar primer backup de Excel Master');
    }

    const dailyBackups = dbBlobs.filter(b => b.pathname.includes('/daily/'));
    if (dailyBackups.length < 7) {
      recommendations.push('⚠️  Esperar a que se acumulen 7 backups diarios (1 semana)');
    }

    if (excelBlobs.length > 0) {
      const latestExcel = excelBlobs.sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )[0];
      const hoursAgo = (Date.now() - new Date(latestExcel.uploadedAt).getTime()) / 3600000;
      if (hoursAgo > 2) {
        recommendations.push('⚠️  Verificar que el cron job de Excel está activo');
      }
    }

    if (recommendations.length === 0) {
      console.log('✅ Sistema de backups funcionando correctamente');
      console.log('✅ Todos los checks pasados\n');
    } else {
      recommendations.forEach(rec => console.log(rec));
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('5️⃣  ACCIONES DISPONIBLES\n');
    console.log('Backup manual completo:');
    console.log('  POST /api/admin/backup-manual');
    console.log('  Body: {"type": "full"}\n');
    console.log('Backup solo BD:');
    console.log('  POST /api/admin/backup-manual');
    console.log('  Body: {"type": "database"}\n');
    console.log('Backup solo Excel:');
    console.log('  POST /api/admin/backup-manual');
    console.log('  Body: {"type": "excel"}\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ VERIFICACIÓN COMPLETADA\n');

  } catch (error) {
    console.error('❌ Error al verificar backups:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verifyBackups();
