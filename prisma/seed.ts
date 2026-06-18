import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const adminEmail = process.env.APP_USER_EMAIL || 'admin@clipping.com';
  const defaultPassword = 'admin123';
  
  // Check if admin user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingUser) {
    const salt = bcrypt.genSaltSync(12);
    const passwordHash = bcrypt.hashSync(defaultPassword, salt);

    const user = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
      },
    });

    console.log(`Default admin user created:`);
    console.log(`Email: ${user.email}`);
    console.log(`Password: ${defaultPassword}`);
    console.log(`Please change this password or configure APP_USER_PASSWORD_HASH in production!`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  console.log('Database seeding completed.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
