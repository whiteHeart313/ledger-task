import { Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { logger } from "src/utils/logger";



@Controller('v1/transactions')

export class TransactionsController {

    constructor(private authService: null) {}

    @Post("add-transaction")
    @HttpCode(HttpStatus.CREATED)
    createTransaction() {
        logger.info("Creating a new transaction...");
        // auth check 
        // balance 
        return { message: "Transaction created successfully" };
    }
}