import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown fields
      forbidNonWhitelisted: true, // throws error for extra fields
      transform: true, // auto-transform payloads
    }),
  );

  // cors enabled
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Matoshree API')
    .setDescription(
      `
        This API powers a silent study space with multiple labs and seats, designed for managing students, memberships, seat allocations, and payments efficiently.

        Core capabilities include:
        - Student onboarding and profile management
        - Monthly membership handling (Fixed Seat, Full Time, Half Time)
        - Seat management across multiple labs with shift-based allocation
        - Daily seat assignment for non-fixed members
        - Automatic membership expiry and seat release
        - Manual payment tracking (registration + monthly fees)
        - Admin-only operations (no public access)

        All endpoints are intended for internal/admin use only.
        `,
    )
    .addBearerAuth()
    .setVersion('1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
