import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from '../wallet/transaction/transaction.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { CreateTransactionDto } from '../wallet/dto/transaction.dto';
import { TransactionType } from '../utils/types';
import { TransactionFactory } from '../wallet/transaction/transaction.factory';
import { DepositStrategy } from '../wallet/transaction/strategies/deposit.strategy';
import { WithdrawStrategy } from '../wallet/transaction/strategies/withdraw.strategy';
import { TransferStrategy } from '../wallet/transaction/strategies/transfer.strategy';
import { PrismaClient } from '@prisma/client';
import Dinero from 'dinero.js';

describe('TransactionService', () => {
  let service: TransactionService;
  let prisma: PrismaService;
  let testUserId: bigint;
  let testDepositAccount: any;
  let testWithdrawalAccount: any;
  let depositTransactionTypeId: number;
  let withdrawalTransactionTypeId: number;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService, 
        PrismaService, 
        TransactionFactory,
        DepositStrategy,
        WithdrawStrategy,
        TransferStrategy
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    prisma = module.get<PrismaService>(PrismaService);

    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset account balances before each test
    await prisma.account.update({
      where: { id: testDepositAccount.id },
      data: { 
        balance: BigInt(50000), // 500 EGP
        availableBalance: BigInt(50000) 
      }
    });

    await prisma.account.update({
      where: { id: testWithdrawalAccount.id },
      data: { 
        balance: BigInt(100000), // 1000 EGP
        availableBalance: BigInt(100000) 
      }
    });
  });

  async function setupTestData() {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'test.user@example.com',
        firstName: 'Test',
        lastName: 'User',
        status: 'ACTIVE',
        kycStatus: 'VERIFIED'
      }
    });
    testUserId = user.id;

    // Get account types
    const checkingAccountType = await prisma.accountType.findFirst({
      where: { name: 'CHECKING' }
    });

    // Create test accounts
    testDepositAccount = await prisma.account.create({
      data: {
        accountNumber: 'TEST_DEPOSIT_001',
        userId: testUserId,
        accountTypeId: checkingAccountType!.id,
        balance: BigInt(50000), // 500 EGP initial balance
        availableBalance: BigInt(50000),
        status: 'ACTIVE'
      }
    });

    testWithdrawalAccount = await prisma.account.create({
      data: {
        accountNumber: 'TEST_WITHDRAWAL_001',
        userId: testUserId,
        accountTypeId: checkingAccountType!.id,
        balance: BigInt(100000), // 1000 EGP initial balance
        availableBalance: BigInt(100000),
        status: 'ACTIVE'
      }
    });

    // Get transaction types
    const depositTransactionType = await prisma.transactionType.findFirst({
      where: { name: 'DEPOSIT' }
    });
    const withdrawalTransactionType = await prisma.transactionType.findFirst({
      where: { name: 'WITHDRAWAL' }
    });

    depositTransactionTypeId = depositTransactionType!.id;
    withdrawalTransactionTypeId = withdrawalTransactionType!.id;
  }

  async function cleanupTestData() {
    // Clean up in reverse order due to foreign key constraints
    await prisma.ledgerEntry.deleteMany({
      where: {
        account: {
          userId: testUserId
        }
      }
    });
    await prisma.transaction.deleteMany({
      where: { initiatedBy: testUserId }
    });
    await prisma.account.deleteMany({
      where: { userId: testUserId }
    });
    await prisma.user.deleteMany({
      where: { id: testUserId }
    });
  }

  describe('Deposit Transactions', () => {
    it('should increase balance when depositing money', async () => {
      // Arrange
      const initialBalance = BigInt(50000); // 500 EGP
      const depositAmount = BigInt(25000); // 250 EGP
      const expectedFinalBalance = BigInt(75000); // 750 EGP

      const depositDto: CreateTransactionDto = {
        idempotencyKey: 'deposit-test-001',
        referenceNumber: 'DEP-TEST-001',
        amount: depositAmount,
        currencyCode: 'EGP',
        type: TransactionType.DEPOSIT,
        toAccountId: testDepositAccount.id,
        initiatedBy: testUserId,
        description: 'Test deposit transaction'
      };

      // Act
      const result = await service.createTransaction(depositDto);

      // Assert
      expect(result.message).toBeDefined();
      expect(result.dto.status).toBe('COMPLETED');
      expect(result.dto.amount).toBe(depositAmount);
      expect(result.dto.currencyCode).toBe('EGP');

      // Verify account balance increased
      const updatedAccount = await prisma.account.findUnique({
        where: { id: testDepositAccount.id }
      });
      expect(updatedAccount!.balance).toBe(expectedFinalBalance);
      expect(updatedAccount!.availableBalance).toBe(expectedFinalBalance);

      // Verify ledger entry was created
      const ledgerEntry = await prisma.ledgerEntry.findFirst({
        where: { 
          transactionId: result.dto.id,
          accountId: testDepositAccount.id
        }
      });
      expect(ledgerEntry).toBeTruthy();
      expect(ledgerEntry!.entryType).toBe('CREDIT');
      expect(ledgerEntry!.amount).toBe(depositAmount);
      expect(ledgerEntry!.balanceAfter).toBe(expectedFinalBalance);
    });

    it('should convert USD to EGP when depositing foreign currency', async () => {
      const usdAmount = BigInt(10000); // $100 (in cents)
      const expectedEgpAmount = BigInt(481700); // $100 * 48.17 rate * 100 cents

      const depositDto: CreateTransactionDto = {
        idempotencyKey: 'deposit-usd-001',
        referenceNumber: 'DEP-USD-001',
        amount: usdAmount,
        currencyCode: 'USD',
        type: TransactionType.DEPOSIT,
        toAccountId: testDepositAccount.id,
        initiatedBy: testUserId,
        description: 'USD deposit test'
      };

      const result = await service.createTransaction(depositDto);

      expect(result.dto.currencyCode).toBe('EGP');
      expect(result.dto.amount).toBe(expectedEgpAmount);

      // Verify balance conversion
      const updatedAccount = await prisma.account.findUnique({
        where: { id: testDepositAccount.id }
      });
      const expectedBalance = BigInt(50000) + expectedEgpAmount; // Initial + converted amount
      expect(updatedAccount!.balance).toBe(expectedBalance);
    });

    it('should reject deposit with invalid fromAccountId', async () => {
      const depositDto: CreateTransactionDto = {
        idempotencyKey: 'deposit-invalid-001',
        referenceNumber: 'DEP-INVALID-001',
        amount: BigInt(10000),
        currencyCode: 'EGP',
        type: TransactionType.DEPOSIT,
        fromAccountId: testDepositAccount.id, // Should not have fromAccountId
        toAccountId: testDepositAccount.id,
        initiatedBy: testUserId
      };

      await expect(service.createTransaction(depositDto))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  describe('Withdrawal Transactions', () => {
    it('should decrease balance when withdrawing money', async () => {
      // Arrange
      const initialBalance = BigInt(100000); // 1000 EGP
      const withdrawalAmount = BigInt(30000); // 300 EGP
      const expectedFinalBalance = BigInt(70000); // 700 EGP

      const withdrawalDto: CreateTransactionDto = {
        idempotencyKey: 'withdrawal-test-001',
        referenceNumber: 'WD-TEST-001',
        amount: withdrawalAmount,
        currencyCode: 'EGP',
        type: TransactionType.WITHDRAWAL,
        fromAccountId: testWithdrawalAccount.id,
        initiatedBy: testUserId,
        description: 'Test withdrawal transaction'
      };

      // Act
      const result = await service.createTransaction(withdrawalDto);

      // Assert
      expect(result.message).toBeDefined();
      expect(result.dto.status).toBe('COMPLETED');
      expect(result.dto.amount).toBe(withdrawalAmount);

      // Verify account balance decreased
      const updatedAccount = await prisma.account.findUnique({
        where: { id: testWithdrawalAccount.id }
      });
      expect(updatedAccount!.balance).toBe(expectedFinalBalance);
      expect(updatedAccount!.availableBalance).toBe(expectedFinalBalance);

      // Verify ledger entry was created
      const ledgerEntry = await prisma.ledgerEntry.findFirst({
        where: { 
          transactionId: result.dto.id,
          accountId: testWithdrawalAccount.id
        }
      });
      expect(ledgerEntry).toBeTruthy();
      expect(ledgerEntry!.entryType).toBe('DEBIT');
      expect(ledgerEntry!.amount).toBe(withdrawalAmount);
      expect(ledgerEntry!.balanceAfter).toBe(expectedFinalBalance);
    });

    it('should fail withdrawal if it would make balance negative', async () => {
      // Arrange - Try to withdraw more than available
      const availableBalance = BigInt(100000); // 1000 EGP
      const excessiveAmount = BigInt(150000); // 1500 EGP (more than available)

      const withdrawalDto: CreateTransactionDto = {
        idempotencyKey: 'withdrawal-overdraft-001',
        referenceNumber: 'WD-OVERDRAFT-001',
        amount: excessiveAmount,
        currencyCode: 'EGP',
        type: TransactionType.WITHDRAWAL,
        fromAccountId: testWithdrawalAccount.id,
        initiatedBy: testUserId,
        description: 'Overdraft test - should fail'
      };

      // Act & Assert
      await expect(service.createTransaction(withdrawalDto))
        .rejects
        .toThrow(BadRequestException);

      // Verify balance remained unchanged
      const unchangedAccount = await prisma.account.findUnique({
        where: { id: testWithdrawalAccount.id }
      });
      expect(unchangedAccount!.balance).toBe(availableBalance);
      expect(unchangedAccount!.availableBalance).toBe(availableBalance);

      // Verify no ledger entry was created
      const ledgerEntry = await prisma.ledgerEntry.findFirst({
        where: { 
          accountId: testWithdrawalAccount.id,
          description: { contains: 'Overdraft test' }
        }
      });
      expect(ledgerEntry).toBeNull();
    });

    it('should fail withdrawal with exact balance plus one piaster', async () => {
      // Test edge case: try to withdraw exactly balance + 1 piaster
      const exactBalance = BigInt(100000); // 1000.00 EGP
      const onePiasterMore = BigInt(100001); // 1000.01 EGP

      const withdrawalDto: CreateTransactionDto = {
        idempotencyKey: 'withdrawal-edge-001',
        referenceNumber: 'WD-EDGE-001',
        amount: onePiasterMore,
        currencyCode: 'EGP',
        type: TransactionType.WITHDRAWAL,
        fromAccountId: testWithdrawalAccount.id,
        initiatedBy: testUserId,
        description: 'Edge case withdrawal test'
      };

      await expect(service.createTransaction(withdrawalDto))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should succeed withdrawal with exact available balance', async () => {
      // Test edge case: withdraw exactly the available balance
      const exactBalance = BigInt(100000); // 1000.00 EGP

      const withdrawalDto: CreateTransactionDto = {
        idempotencyKey: 'withdrawal-exact-001',
        referenceNumber: 'WD-EXACT-001',
        amount: exactBalance,
        currencyCode: 'EGP',
        type: TransactionType.WITHDRAWAL,
        fromAccountId: testWithdrawalAccount.id,
        initiatedBy: testUserId,
        description: 'Exact balance withdrawal test'
      };

      const result = await service.createTransaction(withdrawalDto);

      expect(result.message).toBeDefined();
      expect(result.dto.status).toBe('COMPLETED');

      // Verify balance is exactly zero
      const updatedAccount = await prisma.account.findUnique({
        where: { id: testWithdrawalAccount.id }
      });
      expect(updatedAccount!.balance).toBe(BigInt(0));
      expect(updatedAccount!.availableBalance).toBe(BigInt(0));
    });

    it('should reject withdrawal with invalid toAccountId', async () => {
      const withdrawalDto: CreateTransactionDto = {
        idempotencyKey: 'withdrawal-invalid-001',
        referenceNumber: 'WD-INVALID-001',
        amount: BigInt(10000),
        currencyCode: 'EGP',
        type: TransactionType.WITHDRAWAL,
        fromAccountId: testWithdrawalAccount.id,
        toAccountId: testDepositAccount.id, // Should not have toAccountId
        initiatedBy: testUserId
      };

      await expect(service.createTransaction(withdrawalDto))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  describe('Transaction Immutability', () => {
    it('should create append-only ledger entries', async () => {
      const depositDto: CreateTransactionDto = {
        idempotencyKey: 'immutable-test-001',
        referenceNumber: 'IMM-TEST-001',
        amount: BigInt(20000), // Use BigInt format
        currencyCode: 'EGP',
        type: TransactionType.DEPOSIT,
        toAccountId: testDepositAccount.id.toString(),
        initiatedBy: testUserId
      };

      // First transaction
      const result1 = await service.createTransaction(depositDto);
      
      // Attempt same transaction again with same idempotency key
      const result2 = await service.createTransaction(depositDto);
      
      // Should return the same transaction (append-only principle)
      expect(result1.dto.id).toBe(result2.dto.id);
      expect(result1.dto.amount).toBe(result2.dto.amount);
      expect(result1.dto.idempotencyKey).toBe(result2.dto.idempotencyKey);
      
      // Verify only ONE ledger entry exists (not duplicated)
      const ledgerEntries = await prisma.ledgerEntry.findMany({
        where: { transactionId: result1.dto.id }
      });
      expect(ledgerEntries.length).toBe(1);
      
      expect(ledgerEntries[0].createdAt).toBeDefined();
      expect(ledgerEntries[0].entryType).toBe('CREDIT');
      expect(ledgerEntries[0].amount).toBe(BigInt(20000)); 
    });

    it('should maintain audit trail in ledger entries', async () => {
      const depositDto: CreateTransactionDto = {
        idempotencyKey: 'audit-test-001',
        referenceNumber: 'AUDIT-TEST-001',
        amount: BigInt(15000),
        currencyCode: 'EGP',
        type: TransactionType.DEPOSIT,
        toAccountId: testDepositAccount.id,
        initiatedBy: testUserId,
        description: 'Audit trail test'
      };

      const result = await service.createTransaction(depositDto);

      // Verify complete audit trail
      const ledgerEntry = await prisma.ledgerEntry.findFirst({
        where: { transactionId: result.dto.id },
        include: {
          transaction: true,
          account: true
        }
      });

      expect(ledgerEntry).toBeTruthy();
      expect(ledgerEntry!.description).toContain('DEPOSIT');
      expect(ledgerEntry!.createdAt).toBeDefined();
      expect(ledgerEntry!.transaction.referenceNumber).toBe('AUDIT-TEST-001');
      expect(ledgerEntry!.account.accountNumber).toBe(testDepositAccount.accountNumber);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid currency codes', async () => {
      const invalidDto: CreateTransactionDto = {
        idempotencyKey: 'invalid-currency-001',
        referenceNumber: 'INV-CURR-001',
        amount: BigInt(10000),
        currencyCode: 'INVALID',
        type: TransactionType.DEPOSIT,
        toAccountId: testDepositAccount.id,
        initiatedBy: testUserId
      };

      await expect(service.createTransaction(invalidDto))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should handle non-existent accounts', async () => {
      const invalidDto: CreateTransactionDto = {
        idempotencyKey: 'invalid-account-001',
        referenceNumber: 'INV-ACC-001',
        amount: BigInt(10000),
        currencyCode: 'EGP',
        type: TransactionType.DEPOSIT,
        toAccountId: BigInt(999999), // Non-existent account
        initiatedBy: testUserId
      };

      await expect(service.createTransaction(invalidDto))
        .rejects
        .toThrow(BadRequestException);
    });
  });
});