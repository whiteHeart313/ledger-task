import { Account, TransactionStatus } from "@prisma/client";
import { CreateTransactionDto } from "src/wallet/dto/transaction.dto";
import { TransactionType as prismaTransactionType } from "@prisma/client";

export interface TransactionData {
    idempotencyKey: string;
    referenceNumber: string;
    externalReference?: string;
    transactionTypeId: number;
    amount: bigint;
    currencyCode: string;
    status: TransactionStatus;
    fromAccountId: bigint | null;
    toAccountId: bigint | null;
    description?: string;
    metadata?: any;
    initiatedBy: bigint;
    initiatedAt: Date;
}
export interface AccountsInvolved {
    fromAccount?: BigInt;
    toAccount?: BigInt;
}
export interface TransactionStrategy {
    processTransaction(createTransactionDto: CreateTransactionDto , transactionType: prismaTransactionType , amountInEGP: bigint): Promise<any>;
    processLedgerEntries(
        transaction: any,
        dto: CreateTransactionDto,
        accounts: Account,
        amountInEGP: bigint,
    ): Promise<void>;
}

export enum TransactionType {
    TRANSFER = 'TRANSFER',
    DEPOSIT = 'DEPOSIT',
    WITHDRAWAL = 'WITHDRAWAL',
    PAYMENT = 'PAYMENT',
    REFUND = 'REFUND',
    FEE = 'FEE',
    ADJUSTMENT = 'ADJUSTMENT',
}