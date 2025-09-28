import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { TransactionFactory } from './transaction.factory';
import { TransactionProviderStrategy } from './strategies/provider.strategy';
import { DepositStrategy } from './strategies/deposit.strategy';
import { WithdrawStrategy } from './strategies/withdraw.strategy';
import { TransferStrategy } from './strategies/transfer.strategy';

@Module({
  imports: [],
  controllers: [TransactionController],
  providers: [
    TransactionService,
    TransactionFactory,
    TransactionProviderStrategy,
    DepositStrategy,
    WithdrawStrategy,
    TransferStrategy,
  ],
  exports: [
    TransactionService,
    TransactionFactory,
  ],
})
export class TransactionModule {}