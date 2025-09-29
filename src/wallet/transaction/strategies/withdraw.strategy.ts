import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { CreateTransactionDto } from "../../dto/transaction.dto";
import Dinero from 'dinero.js';
import { EGP } from '@dinero.js/currencies';
import { serviceReturnType, TransactionStrategy } from "src/utils/types";
import { Account, TransactionType as prismaTransactionType, Transaction } from "@prisma/client";
import { TransactionFactory } from "../transaction.factory";

@Injectable()
export class WithdrawStrategy implements TransactionStrategy {
    constructor(
        private readonly prisma: PrismaService,
        private readonly transactionFactory: TransactionFactory
    ) {}

    /**
     * Withdrawals are money going OUT of the system to external destinations
     * Examples: ATM withdrawals, cash withdrawals, external transfers, wire transfers out
     * NO toAccount needed - money goes to external destination
     */
    async processTransaction(createTransactionDto: CreateTransactionDto, transactionType: prismaTransactionType, amountInEGP: bigint): Promise<serviceReturnType<Transaction>> {
        // Find the source account
        const fromAccount = await this.prisma.account.findUnique({
            where: { id: createTransactionDto.fromAccountId, status: 'ACTIVE' }
        });
        
        if (!fromAccount) {
            throw new BadRequestException('From account not found or inactive');
        }

        // Validate sufficient funds
        const withdrawAmount = Dinero({ amount: Number(amountInEGP), currency: 'EGP' });
        const availableBalance = Dinero({ amount: Number(fromAccount.availableBalance), currency: 'EGP' });

        if (withdrawAmount.greaterThan(availableBalance)) {
            throw new BadRequestException('Insufficient funds for withdrawal');
        }

        // Create transaction data using factory
        const transactionData = this.transactionFactory.createByType(
            createTransactionDto.type,
            createTransactionDto,
            transactionType.id,
            amountInEGP
        );

        // Create the transaction
        const transaction = await this.prisma.transaction.create({
            data: transactionData
        });

        // Process ledger entries
        await this.processLedgerEntries(transaction, createTransactionDto, fromAccount, amountInEGP);

        // Mark transaction as completed and return full transaction data
        const completedTransaction = await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: {
                status: 'COMPLETED',
                completedAt: new Date()
            },
            include: {
                transactionType: true,
                fromAccount: true,
                ledgerEntries: true
            }
        });

        return { 
            message: "Withdrawal processed successfully", 
            dto: completedTransaction 
        };
    }

    async processLedgerEntries(
        transaction: Transaction,
        dto: CreateTransactionDto,
        fromAccount: Account,
        amountInEGP: bigint,
    ): Promise<void> {
        // Calculate new balances using Dinero for precision
        const currentBalance = Dinero({ amount: Number(fromAccount.balance), currency: 'EGP' });
        const currentAvailableBalance = Dinero({ amount: Number(fromAccount.availableBalance), currency: 'EGP' });
        const withdrawAmount = Dinero({ amount: Number(amountInEGP), currency: 'EGP' });

        // Subtract withdrawal from both balances
        const newBalance = currentBalance.subtract(withdrawAmount);
        const newAvailableBalance = currentAvailableBalance.subtract(withdrawAmount);
        
        const newBalanceValue = BigInt(newBalance.getAmount());
        const newAvailableBalanceValue = BigInt(newAvailableBalance.getAmount());

        // Update account balance (money is now out of the account)
        await this.prisma.account.update({
            where: { id: fromAccount.id },
            data: {
                balance: newBalanceValue,
                availableBalance: newAvailableBalanceValue,
                updatedAt: new Date()
            }
        });

        // Create DEBIT ledger entry (money leaves the system)
        // In double-entry bookkeeping, withdrawals debit the customer account
        await this.prisma.ledgerEntry.create({
            data: {
                transactionId: transaction.id,
                accountId: fromAccount.id,
                entryType: 'DEBIT', // Money going out = Debit
                amount: amountInEGP,
                currencyCode: 'EGP',
                balanceAfter: newBalanceValue,
                description: `WITHDRAWAL - ${dto.description || 'External withdrawal (ATM/Cash/Transfer)'}`,
            }
        });
    }
}