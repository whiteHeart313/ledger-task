import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Transaction Types
  console.log('📝 Creating transaction types...');
  
  const transactionTypes = [
    {
      name: 'DEPOSIT',
      description: 'Money deposited into account from external source (ATM, bank transfer, etc.)',
      isActive: true,
    },
    {
      name: 'WITHDRAWAL',
      description: 'Money withdrawn from account to external destination (ATM, cash, etc.)',
      isActive: true,
    },
    {
      name: 'TRANSFER',
      description: 'Money transferred between accounts within the system',
      isActive: true,
    },
  ];

  for (const transactionType of transactionTypes) {
    const created = await prisma.transactionType.upsert({
      where: { name: transactionType.name },
      update: transactionType,
      create: transactionType,
    });
    console.log(`✅ Transaction Type: ${created.name} (ID: ${created.id})`);
  }

  // 2. Seed Account Types
  console.log('🏦 Creating account types...');
  
  const accountTypes = [
    {
      name: 'CHECKING',
      description: 'Standard checking account for daily transactions',
      isActive: true,
    },
    {
      name: 'SAVINGS',
      description: 'Savings account with higher interest rates',
      isActive: true,
    },
    {
      name: 'BUSINESS',
      description: 'Business account for commercial transactions',
      isActive: true,
    },
    {
      name: 'WALLET',
      description: 'Digital wallet account for mobile payments',
      isActive: true,
    },
  ];

  for (const accountType of accountTypes) {
    const created = await prisma.accountType.upsert({
      where: { name: accountType.name },
      update: accountType,
      create: accountType,
    });
    console.log(`✅ Account Type: ${created.name} (ID: ${created.id})`);
  }

  // 3. Seed Test Users
  console.log('👥 Creating test users...');
  
  const users = [
    {
      email: 'john.doe@example.com',
      phone: '+201234567890',
      firstName: 'John',
      lastName: 'Doe',
      status: 'ACTIVE' as const,
      kycStatus: 'VERIFIED' as const,
    },
    {
      email: 'jane.smith@example.com',
      phone: '+201234567891',
      firstName: 'Jane',
      lastName: 'Smith',
      status: 'ACTIVE' as const,
      kycStatus: 'VERIFIED' as const,
    },
    {
      email: 'mike.wilson@example.com',
      phone: '+201234567892',
      firstName: 'Mike',
      lastName: 'Wilson',
      status: 'ACTIVE' as const,
      kycStatus: 'PENDING' as const,
    },
  ];

  for (const user of users) {
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: user,
      create: user,
    });
    console.log(`✅ User: ${created.firstName} ${created.lastName} (ID: ${created.id})`);
  }

  // 4. Seed Test Accounts
  console.log('💳 Creating test accounts...');
  
  // Get created users and account types
  const createdUsers = await prisma.user.findMany();
  const checkingAccountType = await prisma.accountType.findUnique({ where: { name: 'CHECKING' } });
  const savingsAccountType = await prisma.accountType.findUnique({ where: { name: 'SAVINGS' } });
  const walletAccountType = await prisma.accountType.findUnique({ where: { name: 'WALLET' } });

  const accounts = [
    {
      accountNumber: 'CHK001234567890',
      userId: createdUsers[0].id,
      accountTypeId: checkingAccountType!.id,
      balance: BigInt(100000), // 1000 EGP
      availableBalance: BigInt(100000),
      status: 'ACTIVE' as const,
      dailyLimit: BigInt(500000), // 5000 EGP
      monthlyLimit: BigInt(10000000), // 100000 EGP
    },
    {
      accountNumber: 'SAV001234567890',
      userId: createdUsers[0].id,
      accountTypeId: savingsAccountType!.id,
      balance: BigInt(500000), // 5000 EGP
      availableBalance: BigInt(500000),
      status: 'ACTIVE' as const,
      dailyLimit: BigInt(200000), // 2000 EGP
      monthlyLimit: BigInt(5000000), // 50000 EGP
    },
    {
      accountNumber: 'CHK001234567891',
      userId: createdUsers[1].id,
      accountTypeId: checkingAccountType!.id,
      balance: BigInt(75000), // 750 EGP
      availableBalance: BigInt(75000),
      status: 'ACTIVE' as const,
      dailyLimit: BigInt(500000),
      monthlyLimit: BigInt(10000000),
    },
    {
      accountNumber: 'WALLET001234567892',
      userId: createdUsers[2].id,
      accountTypeId: walletAccountType!.id,
      balance: BigInt(25000), // 250 EGP
      availableBalance: BigInt(25000),
      status: 'ACTIVE' as const,
      dailyLimit: BigInt(100000), // 1000 EGP
      monthlyLimit: BigInt(2000000), // 20000 EGP
    },
  ];

  for (const account of accounts) {
    const created = await prisma.account.upsert({
      where: { accountNumber: account.accountNumber },
      update: account,
      create: account,
      include: {
        user: true,
        accountType: true,
      },
    });
    console.log(`✅ Account: ${created.accountNumber} - ${created.user?.firstName} ${created.user?.lastName} (${created.accountType.name}) - Balance: ${Number(created.balance) / 100} EGP`);
  }

  console.log('✨ Database seeding completed successfully!');
  
  // Summary
  const summary = {
    users: await prisma.user.count(),
    accountTypes: await prisma.accountType.count(),
    accounts: await prisma.account.count(),
    transactionTypes: await prisma.transactionType.count(),
  };
  
  console.log('📊 Seeding Summary:');
  console.log(`   Users: ${summary.users}`);
  console.log(`   Account Types: ${summary.accountTypes}`);
  console.log(`   Accounts: ${summary.accounts}`);
  console.log(`   Transaction Types: ${summary.transactionTypes}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
