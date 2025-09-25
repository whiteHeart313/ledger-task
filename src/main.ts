import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './filter/all-exceptions.filter';

(async () => {
  console.log('Starting ledger-task service...');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    // if there is a client is going to talk to you.
      origin: ['http://localhost:5173', 'http://frontend:5173'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: true,
    });

  console.log('Configuring global validation pipe...')
  app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
  

  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT ?? 3000);
})();
