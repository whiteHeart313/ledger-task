import { Injectable, BadRequestException } from "@nestjs/common";
import {  PrismaService } from "../../../../prisma/prisma.service";
import { CreateTransactionDto } from "../../dto/transaction.dto";
import { dinero } from 'dinero.js';
import { EGP } from '@dinero.js/currencies';
import { AccountsInvolved, serviceReturnType, TransactionStrategy } from "src/utils/types";
import { Account, Transaction } from "@prisma/client";
import { TransactionFactory } from "../transaction.factory";
// Import or define prismaTransactionType
import { TransactionType as prismaTransactionType } from "@prisma/client";



@Injectable()
export class DepositStrategy implements TransactionStrategy {
    constructor(
        private readonly prisma: PrismaService ,
        private readonly transactionFactory: TransactionFactory
        ) {}

    /**
     * Deposits are money coming INTO the system from external sources
     * Examples: ATM deposits, bank transfers, cash deposits, check deposits
     * NO fromAccount needed - money comes from outside the ledger system
     */

    async processTransaction(createTransactionDto: CreateTransactionDto, transactionType: prismaTransactionType, amountInEGP: bigint): Promise<serviceReturnType<Transaction>> {
        // Find the destination account
        const toAccount = await this.prisma.account.findUnique({
            where: { id: createTransactionDto.toAccountId, status: 'ACTIVE' }
        });
        
        if (!toAccount) {
            throw new BadRequestException('To account not found or inactive');
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
        await this.processLedgerEntries(transaction, createTransactionDto, toAccount, amountInEGP);

        // Mark transaction as completed and return full transaction data
        const completedTransaction = await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: {
                status: 'COMPLETED',
                completedAt: new Date()
            },
            include: {
                transactionType: true,
                toAccount: true,
                ledgerEntries: true
            }
        });

        return { 
            message: "Deposit processed successfully", 
            dto: completedTransaction 
        };
    }
 
    async processLedgerEntries(
        transaction: Transaction,
        dto: CreateTransactionDto,
        toAccount: Account,
        amountInEGP: bigint,
    ): Promise<void> {
        // Calculate new balance using Dinero for precision
        const currentBalance = dinero({ amount: Number(toAccount.balance), currency: EGP });
        const currentAvailableBalance = dinero({ amount: Number(toAccount.availableBalance), currency: EGP });
        const depositAmount = dinero({ amount: Number(amountInEGP), currency: EGP });

        // Add deposit to both balances
        const newBalance = currentBalance.add(depositAmount);
        const newAvailableBalance = currentAvailableBalance.add(depositAmount);
        
        const newBalanceValue = BigInt(newBalance.getAmount());
        const newAvailableBalanceValue = BigInt(newAvailableBalance.getAmount());

        // Update account balance (money is now in the account)
        await this.prisma.account.update({
            where: { id: toAccount.id },
            data: {
                balance: newBalanceValue,
                availableBalance: newAvailableBalanceValue,
                updatedAt: new Date()
            }
        });

        // Create CREDIT ledger entry (money enters the system)
        // In double-entry bookkeeping, deposits credit the customer account
        await this.prisma.ledgerEntry.create({
            data: {
                transactionId: transaction.id,
                accountId: toAccount.id,
                entryType: 'CREDIT', // Money coming in = Credit
                amount: amountInEGP,
                currencyCode: 'EGP',
                balanceAfter: newBalanceValue,
                description: `DEPOSIT - ${dto.description || 'External deposit (ATM/Bank/Cash)'}`,
            }
        });
    }
}