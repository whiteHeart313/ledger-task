import { BadRequestException, Body, ConflictException, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { logger } from "src/utils/logger";
import { TransactionService } from "./transaction.service";
import { Transaction } from "@prisma/client";
import { CreateTransactionDto, TransactionResponseDto } from "../dto/transaction.dto";
import { PrismaService } from "../../../prisma/prisma.service";



@Controller('v1/transactions')

export class TransactionController {

    constructor(
        private transactionService: TransactionService,
        private prisma: PrismaService
    ) {}

    @Get("health/db")
    @HttpCode(HttpStatus.OK)
    async testDatabaseConnection() {
        try {
            const result = await this.prisma.$queryRaw`SELECT 1 as test`;
            
            const userCount = await this.prisma.user.count();
            const accountCount = await this.prisma.account.count();
            const transactionTypeCount = await this.prisma.transactionType.count();
            const transactionCount = await this.prisma.transaction.count();
            
            logger.info("Database connection test successful");
            
            return {
                status: "healthy",
                database: "connected",
                timestamp: new Date().toISOString(),
                stats: {
                    users: userCount,
                    accounts: accountCount,
                    transactionTypes: transactionTypeCount,
                    transactions: transactionCount
                },
                message: "All database tables are accessible"
            };
        } catch (error) {
            logger.error("Database connection test failed", error);
            
            return {
                status: "unhealthy",
                database: "disconnected",
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    @Post("add-transaction")
    @HttpCode(HttpStatus.CREATED)
    async createTransaction(@Body() createTransactionDto: CreateTransactionDto) : Promise<{ message: string, dto: Transaction  }> {
        try {
       return this.transactionService.createTransaction(createTransactionDto);
        } catch (error) {
            if (error instanceof BadRequestException || error instanceof ConflictException) {
                throw error;
            }
            throw error;
        }
    }
}

