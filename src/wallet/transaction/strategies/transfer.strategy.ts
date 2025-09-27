import { TransactionStrategy } from "src/utils/types";
import { CreateTransactionDto } from "src/wallet/dto/transaction.dto";



export class TransferStrategy implements TransactionStrategy {
    async processTransaction(createTransactionDto: CreateTransactionDto): Promise<any> {
            // Implement deposit-specific transaction processing logic here
            return { message: "Deposit processed", dto: createTransactionDto };
        }
        async validateAccounts(createTransactionDto: CreateTransactionDto): Promise<void> {
            if (!createTransactionDto.toAccountId) {
                throw new Error('Deposit requires toAccountId');
            }
        }
        async processLedgerEntries(
            transaction: any,
            dto: CreateTransactionDto,
            accounts: { toAccount?: BigInt },
            amountInEGP: bigint,
        ): Promise<any[]> {
            // Implement ledger entries processing for deposit
            return [{ message: "Ledger entries for deposit processed", transaction, dto, accounts, amountInEGP }];
    } 
}

