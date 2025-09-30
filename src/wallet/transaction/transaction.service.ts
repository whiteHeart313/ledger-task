import { Injectable, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateTransactionDto} from "../dto/transaction.dto";
import Dinero from 'dinero.js';
import { serviceReturnType, TransactionType } from "src/utils/types";
import { TransactionProviderStrategy } from "./strategies/provider.strategy";
import { Prisma, PrismaClient, Transaction } from "@prisma/client";
import { DefaultArgs } from "@prisma/client/runtime/library";
@Injectable()
export class TransactionService {
    constructor(
        private readonly prisma: PrismaService,
    ) {}


    private async convertToEGP(amount: bigint, fromCurrency: string): Promise<bigint> {
        
        const rates: Record<string, number> = {
            'EGP': 1,
            'USD': 48.17,
            'EUR': 56.55,
        };

        const rate = rates[fromCurrency];
        if (!rate) {
            throw new BadRequestException(`Unsupported currency: ${fromCurrency}`);
        }

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
        
        const validatedAmount = this.validateAmount(
        createTransactionDto.amount, 
        createTransactionDto.type
        );
        return await this.prisma.$transaction(async (prisma) => {
            
            const existing = await this.checkIdempotency(createTransactionDto.idempotencyKey);
            if (existing) return existing;

            
            const transactionType = await this.getActiveTransactionType(
            prisma, 
            createTransactionDto.type
            );
            
            const amountInEGP = await this.convertToEGP(
                validatedAmount, 
                createTransactionDto.currencyCode
            );
            this.validateAccountsAndTransactionType(createTransactionDto);
            
            const transactionStrategy = TransactionProviderStrategy.getStrategy(createTransactionDto.type , this.prisma);
            if(!transactionStrategy) {
                throw new BadRequestException(`No strategy found for transaction type: ${createTransactionDto.type}`);
            }
            const response = await transactionStrategy.processTransaction({...createTransactionDto , amount : validatedAmount} , transactionType , amountInEGP);
            return { message: `${response.message}`, dto: response.dto };
        });
}
    

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

    private validateAmount(amount: bigint, type: TransactionType): bigint {
        if (amount < 0 && type !== TransactionType.WITHDRAWAL) {
            throw new BadRequestException('Negative amounts only allowed for withdrawals');
        }
        return amount < 0 ? BigInt(Math.abs(Number(amount))) : amount;
    }
    private async getActiveTransactionType(prisma: Omit<PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">, type: TransactionType) {
        const transaction = await prisma.transactionType.findFirst({
            where: { name: type, isActive: true }
        });
        if (!transaction) {
            throw new BadRequestException(`Invalid transaction type: ${type}`);
        }
        return transaction;
    }

    private async checkIdempotency(idempotencyKey: string): Promise<serviceReturnType<Transaction> | null> {
        const existingTransaction = await this.getTransactionByIdempotencyKey(idempotencyKey);

            if (existingTransaction) {
                if (existingTransaction.status === 'COMPLETED') {
                    // Return existing completed transaction
                    return { message: "Transaction already completed", dto: existingTransaction  };
                } else if (existingTransaction.status === 'PENDING') {
                    throw new ConflictException('Transaction is already being processed');
                }
            }
        return null;
    }

    private validateAccountsAndTransactionType(createTransactionDto: CreateTransactionDto) {
        if(!createTransactionDto.fromAccountId && !createTransactionDto.toAccountId) {
            throw new BadRequestException('At least one of fromAccountId or toAccountId must be provided');
        }
        if(createTransactionDto.type === TransactionType.TRANSFER) {
            if(!createTransactionDto.fromAccountId || !createTransactionDto.toAccountId) {
                throw new BadRequestException('Both fromAccountId and toAccountId must be provided for transfers');
            }
        }
        if(createTransactionDto.type === TransactionType.DEPOSIT) {
            if(!createTransactionDto.toAccountId) {
                throw new BadRequestException('toAccountId must be provided for deposits , money comes from external source');
            }
            if(createTransactionDto.fromAccountId) {
                throw new BadRequestException('fromAccountId should not be provided for deposits , money comes from external source');
            }
        }
        if(createTransactionDto.type === TransactionType.WITHDRAWAL) {
            if(!createTransactionDto.fromAccountId) {
                throw new BadRequestException('fromAccountId must be provided for withdrawals , money goes to external destination');
            }
            if(createTransactionDto.toAccountId) {
                throw new BadRequestException('toAccountId should not be provided for withdrawals , money goes to external destination');
            }
        }
    }
}