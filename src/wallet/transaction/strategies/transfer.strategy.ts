import { BadRequestException, Injectable } from "@nestjs/common";
import { Account , LedgerEntry, TransactionType as prismaTransactionType, Transaction  } from "@prisma/client";
import { TransactionStrategy } from "src/utils/types";
import { CreateTransactionDto } from "src/wallet/dto/transaction.dto";
import { TransactionFactory } from "../transaction.factory";
import { PrismaService } from "prisma/prisma.service";
import { dinero } from 'dinero.js';
import { EGP } from '@dinero.js/currencies';



@Injectable()
export class TransferStrategy implements TransactionStrategy {
    constructor(private prisma: PrismaService, private transactionFactory: TransactionFactory) {}
    async processTransaction(createTransactionDto: CreateTransactionDto , transactionType: prismaTransactionType , amountInEGP: bigint): Promise<any> {
        const fromAccount = await this.prisma.account.findUnique({
            where: { id: createTransactionDto.fromAccountId, status: 'ACTIVE' }
        });
        const toAccount = await this.prisma.account.findUnique({
            where: { id: createTransactionDto.toAccountId, status: 'ACTIVE' }
        });
        if(!fromAccount) {
            throw new BadRequestException('From account not found or inactive');
        }
        if(!toAccount) {
            throw new BadRequestException('To account not found or inactive');
        }
        const fromBalance = dinero({ amount: Number(fromAccount.availableBalance), currency: EGP });
        const transferAmount = dinero({ amount: Number(amountInEGP), currency: EGP });

        if (fromBalance.lessThan(transferAmount)) {
            throw new BadRequestException('Insufficient funds for transfer');
        }
        const transactionData = this.transactionFactory.createByType(
                    createTransactionDto.type,
                    createTransactionDto,
                    transactionType.id,
                    amountInEGP
                );
    
        const transaction = await this.prisma.transaction.create({
                data: transactionData
            });
        await this.processLedgerEntries(transaction, createTransactionDto, [toAccount,  fromAccount] , amountInEGP);
        return { message: "Withdraw processed", dto: createTransactionDto };
    }

    async processLedgerEntries(
        transaction: Transaction,
        dto: CreateTransactionDto,
        accounts: Account[],
        amountInEGP: bigint,
    ): Promise<void> {
        const [toAccount, fromAccount] = accounts;
        const ledgerEntries: LedgerEntry[] = [];

        // Validate sufficient funds using Dinero for precision
        const fromBalance = dinero({ amount: Number(fromAccount.availableBalance), currency: EGP });
        const transferAmount = dinero({ amount: Number(amountInEGP), currency: EGP });

        if (fromBalance.lessThan(transferAmount)) {
            throw new BadRequestException('Insufficient funds for transfer');
        }

        // Calculate new balances for FROM account (source)
        const currentFromBalance = dinero({ amount: Number(fromAccount.balance), currency: EGP });
        const currentFromAvailableBalance = dinero({ amount: Number(fromAccount.availableBalance), currency: EGP });
        
        const newFromBalance = currentFromBalance.subtract(transferAmount);
        const newFromAvailableBalance = currentFromAvailableBalance.subtract(transferAmount);
        
        const newFromBalanceValue = BigInt(newFromBalance.getAmount());
        const newFromAvailableBalanceValue = BigInt(newFromAvailableBalance.getAmount());

        // Calculate new balances for TO account (destination)
        const currentToBalance = dinero({ amount: Number(toAccount.balance), currency: EGP });
        const currentToAvailableBalance = dinero({ amount: Number(toAccount.availableBalance), currency: EGP });
        
        const newToBalance = currentToBalance.add(transferAmount);
        const newToAvailableBalance = currentToAvailableBalance.add(transferAmount);
        
        const newToBalanceValue = BigInt(newToBalance.getAmount());
        const newToAvailableBalanceValue = BigInt(newToAvailableBalance.getAmount());

        // Update FROM account balance (debit)
        await this.prisma.account.update({
            where: { id: fromAccount.id },
            data: {
                balance: newFromBalanceValue,
                availableBalance: newFromAvailableBalanceValue,
                updatedAt: new Date()
            }
        });

        // Update TO account balance (credit)
        await this.prisma.account.update({
            where: { id: toAccount.id },
            data: {
                balance: newToBalanceValue,
                availableBalance: newToAvailableBalanceValue,
                updatedAt: new Date()
            }
        });

        // Create DEBIT ledger entry for FROM account (money leaving)
        const debitEntry = await this.prisma.ledgerEntry.create({
            data: {
                transactionId: transaction.id,
                accountId: fromAccount.id,
                entryType: 'DEBIT',
                amount: amountInEGP,
                currencyCode: 'EGP',
                balanceAfter: newFromBalanceValue,
                description: `TRANSFER OUT - ${dto.description || `Transfer to account ${toAccount.accountNumber}`}`,
            }
        });

        // Create CREDIT ledger entry for TO account (money arriving)
        const creditEntry = await this.prisma.ledgerEntry.create({
            data: {
                transactionId: transaction.id,
                accountId: toAccount.id,
                entryType: 'CREDIT',
                amount: amountInEGP,
                currencyCode: 'EGP',
                balanceAfter: newToBalanceValue,
                description: `TRANSFER IN - ${dto.description || `Transfer from account ${fromAccount.accountNumber}`}`,
            }
        });

        ledgerEntries.push(debitEntry, creditEntry);
        
        // Optional: Log the successful transfer
        console.log(`Transfer completed: ${amountInEGP} EGP from ${fromAccount.accountNumber} to ${toAccount.accountNumber}`);
    }
}

