import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { logger } from "src/utils/logger";
import { TransactionService } from "./transaction.service";
import { Transaction } from "@prisma/client";
import { CreateTransactionDto, TransactionResponseDto } from "../dto/transaction.dto";



@Controller('v1/transactions')

export class TransactionController {

    constructor(private transactionService: TransactionService) {}

    @Post("add-transaction")
    @HttpCode(HttpStatus.CREATED)
    async createTransaction(@Body() createTransactionDto: CreateTransactionDto) : Promise<TransactionResponseDto> {
       return this.transactionService.createTransaction(createTransactionDto);
    }
}