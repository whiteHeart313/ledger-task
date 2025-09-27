import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { CreateTransactionDto } from "../../dto/transaction.dto";
import { dinero } from 'dinero.js';
import { EGP } from '@dinero.js/currencies';
import { TransactionStrategy } from "src/utils/types";
import { Account, TransactionType as prismaTransactionType } from "@prisma/client";
import { TransactionFactory } from "../transaction.factory";


@Injectable()
export class WithdrawStrategy implements TransactionStrategy {
    constructor(private readonly prisma: PrismaService , private readonly transactionFactory: TransactionFactory) {}

    /**
     * Withdrawals are money going OUT of the system to external destinations
     * Examples: ATM withdrawals, cash withdrawals, external transfers, wire transfers out
     * NO toAccount needed - money goes to external destination
     */

    async processTransaction(createTransactionDto: CreateTransactionDto , transactionType: prismaTransactionType , amountInEGP: bigint): Promise<any> {
            // Implement deposit-specific transaction processing logic here
            const toAccount = await this.prisma.account.findUnique({
                        where: { id: createTransactionDto.toAccountId, status: 'ACTIVE' }
                });
            if(!toAccount) {
                throw new BadRequestException('To account not found or inactive');
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
            await this.processLedgerEntries(transaction, createTransactionDto, toAccount , amountInEGP);
            return { message: "Withdraw processed", dto: createTransactionDto };
        }

    async processLedgerEntries(
            transaction: any,
            dto: CreateTransactionDto,
            toAccount : Account,
            amountInEGP: bigint,
        ): Promise<void> {
    
            // Calculate new balance using Dinero for precision
            const currentBalance = dinero({ amount: Number(toAccount.balance), currency: EGP });
            const currentAvailableBalance = dinero({ amount: Number(toAccount.availableBalance), currency: EGP });
            const withdrawAmount = dinero({ amount: Number(amountInEGP), currency: EGP });

            // Subtract withdrawal from both balances
            const newBalance = currentBalance.subtract(withdrawAmount);
            const newAvailableBalance = currentAvailableBalance.subtract(withdrawAmount);

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
                    entryType: 'DEBIT', // Money going out = Debit
                    amount: amountInEGP,
                    currencyCode: 'EGP',
                    balanceAfter: newBalanceValue,
                    description: `WITHDRAWAL - ${dto.description || 'External withdrawal (ATM/Cash/Transfer)'}`,
                }
            });
    
            await this.prisma.transaction.update({
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
        }
}