import { Injectable } from '@nestjs/common';
import { CreateTransactionDto } from '../dto/transaction.dto';
import { TransactionData, TransactionType } from 'src/utils/types';



@Injectable()
export class TransactionFactory {
    
    createTransactionData(
        createTransactionDto: CreateTransactionDto,
        transactionTypeId: number,
        amountInEGP: bigint
    ): TransactionData {
        return {
            idempotencyKey: createTransactionDto.idempotencyKey,
            referenceNumber: createTransactionDto.referenceNumber,
            externalReference: createTransactionDto.externalReference || '',
            transactionTypeId: transactionTypeId,
            amount: amountInEGP,
            currencyCode: 'EGP',
            status: 'PROCESSING',
            fromAccountId: createTransactionDto.fromAccountId || null,
            toAccountId: createTransactionDto.toAccountId || null,
            description: createTransactionDto.description || '',
            metadata: createTransactionDto.metadata || null,
            initiatedBy: createTransactionDto.initiatedBy,
            initiatedAt: new Date(),
        };
    }

    createDepositTransaction(dto: CreateTransactionDto, typeId: number, amount: bigint): TransactionData {
        const baseData = this.createTransactionData(dto, typeId, amount);
        return {
            ...baseData,
            fromAccountId: null,
            description: baseData.description || 'Deposit transaction',
        };
    }

    createWithdrawalTransaction(dto: CreateTransactionDto, typeId: number, amount: bigint): TransactionData {
        const baseData = this.createTransactionData(dto, typeId, amount);
        return {
            ...baseData,
            toAccountId: null, 
            description: baseData.description || 'Withdrawal transaction',
        };
    }

    createTransferTransaction(dto: CreateTransactionDto, typeId: number, amount: bigint): TransactionData {
        const baseData = this.createTransactionData(dto, typeId, amount);
        
        if (!dto.fromAccountId || !dto.toAccountId) {
            throw new Error('Transfer requires both fromAccountId and toAccountId');
        }
        
        return {
            ...baseData,
            description: baseData.description || 'Transfer transaction',
        };
    }

    // Factory method selector based on transaction type
    createByType(
        transactionType: string,
        dto: CreateTransactionDto,
        typeId: number,
        amount: bigint
    ): TransactionData {
        switch (transactionType) {
            case TransactionType.DEPOSIT:
                return this.createDepositTransaction(dto, typeId, amount);
            case TransactionType.WITHDRAWAL:
                return this.createWithdrawalTransaction(dto, typeId, amount);
            case TransactionType.TRANSFER:
                return this.createTransferTransaction(dto, typeId, amount);
            default:
                return this.createTransactionData(dto, typeId, amount);
        }
    }

    returnAccountsInvolved(dto: CreateTransactionDto): bigint[] {
        const accounts = new Set<bigint>();
        if (dto.fromAccountId) accounts.add(dto.fromAccountId);
        if (dto.toAccountId) accounts.add(dto.toAccountId);
        return Array.from(accounts);
    }
}