const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin created:', { username: admin.username, role: admin.role });

  // Create sample worker WITH sub-roles
  const workerPassword = await bcrypt.hash('worker123', 10);
  const worker = await prisma.user.upsert({
    where: { username: 'worker1' },
    update: {},
    create: {
      username: 'worker1',
      password: workerPassword,
      role: 'WORKER',
      subRoles: {
        create: [
          { subRole: 'CNC' },
          { subRole: 'ASSEMBLY' },
        ],
      },
    },
  });
  console.log('✅ Worker created:', { username: worker.username, role: worker.role });

  console.log('\n📝 Default credentials:');
  console.log('Admin  → username: admin,   password: admin123');
  console.log('Worker → username: worker1, password: worker123');
  console.log('Worker sub-roles: CNC, ASSEMBLY');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });