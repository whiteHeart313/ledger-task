

import { IsString, IsNotEmpty, IsOptional, IsEnum, IsPositive, IsJSON, Length, IsNumberString } from 'class-validator';
import { Transform } from 'class-transformer';
import { TransactionType } from 'src/utils/types';


export class CreateTransactionDto {
    @IsString()
    @IsNotEmpty()
    @Length(1, 255)
    idempotencyKey: string;

    @IsString()
    @IsNotEmpty()
    @Length(1, 100)
    referenceNumber: string;

    @IsString()
    @IsOptional()
    @Length(1, 255)
    externalReference?: string;

    @IsNumberString()
    @IsNotEmpty()
    @IsString()
    @Transform(({ value }) => {
        return BigInt(Math.round(parseFloat(value) * 100));
    })
    amount: bigint;

    @IsString()
    @IsNotEmpty()
    @Length(3, 3)
    currencyCode: string;

    @IsEnum(TransactionType)
    @IsOptional()
    type : TransactionType = TransactionType.TRANSFER;

    @IsNumberString()
    @IsOptional()
    @Transform(({ value }) => value ? BigInt(value) : null)
    fromAccountId?: bigint;

    @IsNumberString()
    @IsOptional()
    @Transform(({ value }) => value ? BigInt(value) : null)
    toAccountId?: bigint;

    @IsString()
    @IsOptional()
    description?: string;

    @IsJSON()
    @IsOptional()
    metadata?: any;

    @IsNumberString()
    @IsNotEmpty()
    @Transform(({ value }) => BigInt(value))
    initiatedBy: bigint;
}

export class TransactionResponseDto {
    id: bigint;
    idempotencyKey: string;
    referenceNumber: string;
    externalReference: string | null;
    transactionTypeId: number;
    amount: bigint;
    currencyCode: string;
    status: string;
    fromAccountId?: bigint | null;
    toAccountId?: bigint | null;
    description?: string | null ;
    metadata?: any;
    initiatedBy?: bigint | null ;
    initiatedAt: Date ;
    completedAt?: Date | null;
    failedAt? : Date | null; 
    createdAt?: Date | null;
    updatedAt: Date;
}