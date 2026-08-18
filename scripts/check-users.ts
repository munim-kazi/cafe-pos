import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  
  const users = await prisma.user.findMany({
    select: { email: true, role: true, active: true, password: true }
  });
  
  console.log('Users found:', users.length);
  for (const u of users) {
    console.log(`  ${u.email} (${u.role}, active=${u.active})`);
    const match = await bcrypt.compare('admin123', u.password);
    console.log(`    admin123 matches: ${match}`);
    const match2 = await bcrypt.compare('cashier123', u.password);
    console.log(`    cashier123 matches: ${match2}`);
  }
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
