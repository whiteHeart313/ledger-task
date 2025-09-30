import { BadRequestException, Injectable } from "@nestjs/common";
import { Account , LedgerEntry, TransactionType as prismaTransactionType, Transaction  } from "@prisma/client";
import { serviceReturnType, TransactionStrategy } from "src/utils/types";
import { CreateTransactionDto } from "src/wallet/dto/transaction.dto";
import { TransactionFactory } from "../transaction.factory";
import { PrismaService } from "../../../../prisma/prisma.service";
import Dinero from 'dinero.js';
import { EGP } from '@dinero.js/currencies';



@Injectable()
export class TransferStrategy implements TransactionStrategy {
    constructor(private prisma: PrismaService, private transactionFactory: TransactionFactory) {}
    async processTransaction(createTransactionDto: CreateTransactionDto, transactionType: prismaTransactionType, amountInEGP: bigint): Promise<serviceReturnType<Transaction>> {
        // Find both accounts
        const fromAccount = await this.prisma.account.findUnique({
            where: { id: createTransactionDto.fromAccountId, status: 'ACTIVE' }
        });
        const toAccount = await this.prisma.account.findUnique({
            where: { id: createTransactionDto.toAccountId, status: 'ACTIVE' }
        });
        
        if (!fromAccount) {
            throw new BadRequestException('From account not found or inactive');
        }
        if (!toAccount) {
            throw new BadRequestException('To account not found or inactive');
        }

        // Validate sufficient funds
        const fromBalance = Dinero({ amount: Number(fromAccount.availableBalance), currency: 'EGP' });
        const transferAmount = Dinero({ amount: Number(amountInEGP), currency: 'EGP' });

        if (fromBalance.lessThan(transferAmount)) {
            throw new BadRequestException('Insufficient funds for transfer');
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
        await this.processLedgerEntries(transaction, createTransactionDto, [toAccount, fromAccount], amountInEGP);

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
                toAccount: true,
                ledgerEntries: true
            }
        });

        return { 
            message: "Transfer processed successfully", 
            dto: completedTransaction 
        };
    }

    async processLedgerEntries(
        transaction: Transaction,
        dto: CreateTransactionDto,
        accounts: Account[],
        amountInEGP: bigint,
    ): Promise<void> {
        const [toAccount, fromAccount] = accounts;

        // Calculate new balances for FROM account (source)
        const currentFromBalance = Dinero({ amount: Number(fromAccount.balance), currency: 'EGP' });
        const currentFromAvailableBalance = Dinero({ amount: Number(fromAccount.availableBalance), currency: 'EGP' });
        const transferAmount = Dinero({ amount: Number(amountInEGP), currency: 'EGP' });

        const newFromBalance = currentFromBalance.subtract(transferAmount);
        const newFromAvailableBalance = currentFromAvailableBalance.subtract(transferAmount);
        
        const newFromBalanceValue = BigInt(newFromBalance.getAmount());
        const newFromAvailableBalanceValue = BigInt(newFromAvailableBalance.getAmount());

        // Calculate new balances for TO account (destination)
        const currentToBalance = Dinero({ amount: Number(toAccount.balance), currency: 'EGP' });
        const currentToAvailableBalance = Dinero({ amount: Number(toAccount.availableBalance), currency: 'EGP' });

        const newToBalance = currentToBalance.add(transferAmount);
        const newToAvailableBalance = currentToAvailableBalance.add(transferAmount);
        
        const newToBalanceValue = BigInt(newToBalance.getAmount());
        const newToAvailableBalanceValue = BigInt(newToAvailableBalance.getAmount());

        // Update FROM account balance (debit)
         await Promise.all
         ([
            this.updateAccount(fromAccount.id, newFromBalanceValue, newFromAvailableBalanceValue),
            this.updateAccount(toAccount.id, newToBalanceValue, newToAvailableBalanceValue)
         ]);

        await Promise.all([
            this.createLedgerEntry({
                transactionId: transaction.id,
                accountId: fromAccount.id,
                entryType: 'DEBIT',
                amount: amountInEGP,
                currencyCode: 'EGP',
                balanceAfter: newFromBalanceValue,
                description: `TRANSFER OUT - ${dto.description || `Transfer to account ${toAccount.accountNumber}`}`
            }), 
            this.createLedgerEntry({
                transactionId: transaction.id,
                accountId: toAccount.id,
                entryType: 'CREDIT',
                amount: amountInEGP,
                currencyCode: 'EGP',
                balanceAfter: newToBalanceValue,
                description: `TRANSFER IN - ${dto.description || `Transfer from account ${fromAccount.accountNumber}`}`,
            }), 

         ])

        // Log the successful transfer
        console.log(`Transfer completed: ${amountInEGP} EGP from ${fromAccount.accountNumber} to ${toAccount.accountNumber}`);
    }

    async updateAccount(accountId: bigint, balance: bigint, availableBalance: bigint): Promise<void> {
        await this.prisma.account.update({
            where: { id: accountId },
            data: {
                balance,
                availableBalance,
                updatedAt: new Date()
            }
        });
    }

    async createLedgerEntry(entry: Partial<LedgerEntry>): Promise<void> {
        await this.prisma.ledgerEntry.create({
            data: {
                transactionId: entry.transactionId!,
                accountId: entry.accountId!,
                entryType: entry.entryType!,
                amount: entry.amount!,
                currencyCode: entry.currencyCode!,
                balanceAfter: entry.balanceAfter!,
                description: entry.description!
            }
        });
    }
}
