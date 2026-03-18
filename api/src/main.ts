import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configuredOrigins = [process.env.FRONTEND_URL, process.env.STAFF_FRONTEND_URL]
    .filter((origin): origin is string => Boolean(origin));
  const devOrigins = [
    'http://127.0.0.1:43171',
    'http://127.0.0.1:43172',
    'http://localhost:43171',
    'http://localhost:43172',
    'http://localhost:5173',
    'http://localhost:5174',
  ];
  const allowedOrigins = [...new Set([...configuredOrigins, ...devOrigins])];
  const vendorDomain = (process.env.VENDOR_DOMAIN || '')
    .replace(/^https?:\/\//i, '')
    .replace(/^\*\./, '')
    .replace(/\/$/, '')
    .toLowerCase();

  const wildcardDomains = new Set<string>();
  if (vendorDomain) {
    wildcardDomains.add(vendorDomain);
  }

  if (process.env.FRONTEND_URL) {
    try {
      const hostname = new URL(process.env.FRONTEND_URL).hostname.toLowerCase();
      wildcardDomains.add(hostname.replace(/^www\./, ''));
    } catch {
      // Ignore invalid FRONTEND_URL values and fall back to exact origin allowlist.
    }
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      try {
        const requestOrigin = new URL(origin);
        const hostname = requestOrigin.hostname.toLowerCase();
        const matchesWildcardDomain = [...wildcardDomains].some((domain) => (
          hostname === domain || hostname.endsWith(`.${domain}`)
        ));

        callback(null, matchesWildcardDomain);
      } catch {
        callback(null, false);
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Ensure uploads dir
  const uploadDir = process.env.UPLOAD_DIR || join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const config = new DocumentBuilder()
    .setTitle('RentalBasic API')
    .setDescription('Multi-tenant event equipment rental API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}`);
  console.log(`📚 Swagger: http://localhost:${port}/api/docs`);
}
bootstrap();
