import { TransactionStrategy, TransactionType } from "../../../utils/types";
import { DepositStrategy } from "./deposit.strategy";
import { WithdrawStrategy } from "./withdraw.strategy";
import { TransferStrategy } from "./transfer.strategy";
import { PrismaService } from "prisma/prisma.service";
import { TransactionFactory } from "../transaction.factory";


export class TransactionProviderStrategy {


    static getStrategy(transactionType: TransactionType , prisma: PrismaService): TransactionStrategy | null {
        const strategy = {
            [TransactionType.DEPOSIT]: () => new DepositStrategy(prisma, new TransactionFactory()),
            [TransactionType.WITHDRAWAL]: () => new WithdrawStrategy(prisma, new TransactionFactory()),
            [TransactionType.TRANSFER]: () => new TransferStrategy(prisma, new TransactionFactory()),
        };

        return strategy[transactionType] ? strategy[transactionType]() : null;
    }

}