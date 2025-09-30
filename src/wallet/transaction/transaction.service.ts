import { Injectable, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateTransactionDto, TransactionResponseDto } from "../dto/transaction.dto";
import Dinero from 'dinero.js';
import { TransactionFactory } from "./transaction.factory";
import { serviceReturnType, TransactionStrategy } from "src/utils/types";
import { TransactionProviderStrategy } from "./strategies/provider.strategy";
import { Transaction } from "@prisma/client";
@Injectable()
export class TransactionService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly transactionFactory: TransactionFactory
    ) {}

    private strategies : Map<string, TransactionStrategy> = new Map()

    // Mock currency conversion service
    private async convertToEGP(amount: bigint, fromCurrency: string): Promise<bigint> {
        // Mock conversion rates (in production, use real exchange rates)
        const rates: Record<string, number> = {
            'EGP': 1,
            'USD': 48.17,
            'EUR': 56.55,
        };

        const rate = rates[fromCurrency];
        if (!rate) {
            throw new BadRequestException(`Unsupported currency: ${fromCurrency}`);
        }

        // For Dinero.js v1, amounts are in smallest currency unit (piasters for EGP, cents for USD/EUR)
        let sourceMoney: Dinero.Dinero;

        switch (fromCurrency) {
            case 'USD':
                sourceMoney = Dinero({ amount: Number(amount), currency: 'USD' });
                break;
            case 'EUR':
                sourceMoney = Dinero({ amount: Number(amount), currency: 'EUR' });
                break;
            case 'EGP':
                sourceMoney = Dinero({ amount: Number(amount), currency: 'EGP' });
                break;
            default:
                throw new BadRequestException(`Unsupported currency: ${fromCurrency}`);
        }
        const convertedAmount = sourceMoney.multiply(rate);
        return BigInt(convertedAmount.getAmount());
    }

    async createTransaction(createTransactionDto: CreateTransactionDto):Promise<serviceReturnType<Transaction>> {
        // Use Prisma transaction for atomicity
        return await this.prisma.$transaction(async (prisma) => {
            
            // 1. Check idempotency - prevent duplicate processing
            const existingTransaction = await this.getTransactionByIdempotencyKey(createTransactionDto.idempotencyKey);

            if (existingTransaction) {
                if (existingTransaction.status === 'COMPLETED') {
                    // Return existing completed transaction
                    return { message: "Transaction already completed", dto: existingTransaction  };
                } else if (existingTransaction.status === 'PENDING') {
                    throw new ConflictException('Transaction is already being processed');
                }
            }

            const transactionType = await prisma.transactionType.findFirst({
                where: { name: createTransactionDto.type, isActive: true }
            });

            if (!transactionType) {
                throw new BadRequestException(`Invalid transaction type: ${createTransactionDto.type}`);
            }

            const amountInEGP = await this.convertToEGP(
                createTransactionDto.amount, 
                createTransactionDto.currencyCode
            );

            if(!createTransactionDto.fromAccountId && !createTransactionDto.toAccountId) {
                throw new BadRequestException('At least one of fromAccountId or toAccountId must be provided');
            }
            const transactionStrategy = TransactionProviderStrategy.getStrategy(createTransactionDto.type , this.prisma);
            if(!transactionStrategy) {
                throw new BadRequestException(`No strategy found for transaction type: ${createTransactionDto.type}`);
            }

            const response = await transactionStrategy.processTransaction(createTransactionDto , transactionType , amountInEGP);
            return { message: `${response.message}`, dto: response.dto };
        });
    }

    // Get transaction by idempotency key (for checking duplicates)
    async getTransactionByIdempotencyKey(idempotencyKey: string) {
        return this.prisma.transaction.findUnique({
            where: { idempotencyKey },
            include: {
                transactionType: true,
                fromAccount: true,
                toAccount: true,
                ledgerEntries: true
            }
        });
    }

    private calculateBalance(currentBalance: bigint, amount: bigint, operation: 'add' | 'subtract'): bigint {
        const current = Number(currentBalance);
        const change = Number(amount);
        
        const result = operation === 'add' ? current + change : current - change;
        
        // Ensure no negative balance
        if (result < 0) {
            throw new BadRequestException('Insufficient funds - balance would become negative');
        }
        
        return BigInt(result);
    }
}