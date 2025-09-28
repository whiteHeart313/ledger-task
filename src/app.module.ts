import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionModule } from './wallet/transaction/transaction.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Make PrismaService truly global with @Global decorator
@Global()
@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService, // Global singleton database service
  ],
  exports: [PrismaService], // Export to make available to all modules
})
export class DatabaseModule {}

@Module({
  imports: [
    DatabaseModule, // Import the global database module
    TransactionModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}