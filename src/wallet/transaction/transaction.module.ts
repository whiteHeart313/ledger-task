import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { PrismaService } from 'prisma/prisma.service';
import { TransactionFactory } from './transaction.factory';

@Module({
  imports: [

  ],
  controllers: [TransactionController],
  providers: [TransactionService , PrismaService ,TransactionFactory],
  exports: [TransactionService,  PrismaService, TransactionFactory],
})
export class TransactionModule{}