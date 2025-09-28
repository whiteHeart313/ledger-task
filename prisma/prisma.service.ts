import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    private static instance: PrismaService;

    constructor() {
        if (PrismaService.instance) {
            return PrismaService.instance;
        }

        super({
            log: ['query', 'info', 'warn', 'error'],
            errorFormat: 'pretty',
            datasources: {
                db: {
                    url: process.env.DATABASE_URL,
                },
            },
        });

        PrismaService.instance = this;
        this.logger.log('PrismaService singleton instance created');
    }

    async onModuleInit() {
        try {
            await this.$connect();
            this.logger.log('Successfully connected to database');
            
            this.logger.log(`Database connection pool established`);
        } catch (error) {
            this.logger.error('Failed to connect to database', error);
            throw error;
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
        this.logger.log('Disconnected from database');
    }

    // Health check method
    async isHealthy(): Promise<boolean> {
        try {
            await this.$queryRaw`SELECT 1`;
            return true;
        } catch (error) {
            this.logger.error('Database health check failed:', error);
            return false;
        }
    }

    // Custom method to handle database transactions with retry logic
    async executeTransaction<T>(
        fn: (prisma: Omit<this, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>) => Promise<T>,
        maxRetries = 3
    ): Promise<T> {
        let lastError: any;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.$transaction(fn);
            } catch (error) {
                lastError = error;
                this.logger.warn(`Transaction attempt ${attempt} failed:`, error.message);
                
                if (attempt === maxRetries) {
                    break;
                }
                
                // Exponential backoff
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        this.logger.error(`Transaction failed after ${maxRetries} attempts:`, lastError);
        throw lastError;
    }

    // Soft delete functionality
    async softDelete(model: string, where: any) {
        const modelDelegate = this[model as keyof this] as any;
        if (!modelDelegate) {
            throw new Error(`Model ${model} not found`);
        }

        return modelDelegate.update({
            where,
            data: {
                deletedAt: new Date(),
                isDeleted: true,
            },
        });
    }

    // Batch operations helper
    async batchOperation(operations: any[], batchSize = 100): Promise<PromiseSettledResult<any>[]> {
        const results: PromiseSettledResult<any>[] = [];
        
        for (let i = 0; i < operations.length; i += batchSize) {
            const batch = operations.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(batch);
            results.push(...batchResults);
        }
        
        return results;
    }
}