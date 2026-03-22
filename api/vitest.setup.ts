import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';

const testUploadDir = join(
  tmpdir(),
  'chair-rental-vitest',
  `${process.pid}-${randomUUID()}`,
  'uploads',
);

rmSync(testUploadDir, { recursive: true, force: true });
mkdirSync(testUploadDir, { recursive: true });

process.env.UPLOAD_DIR = testUploadDir;

afterAll(() => {
  rmSync(testUploadDir, { recursive: true, force: true });
});