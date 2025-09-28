import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Ledger Task API is running! 💰';
  }

  getApiInfo() {
    return {
      name: 'Ledger Task API',
      description: 'Financial ledger service with transaction management',
      version: '1.0.0',
      features: [
        'Double-entry bookkeeping',
        'Multi-currency support',
        'Transaction strategies (Deposit, Withdrawal, Transfer)',
        'Atomic operations',
        'Idempotency support'
      ]
    };
  }
}
