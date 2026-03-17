import * as fs from 'fs';
import { extname, join, posix } from 'path';
import { MigrationInterface, QueryRunner } from 'typeorm';

type ItemTypeRow = {
  id: string;
  name: string;
  pictureUrl: string | null;
};

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.gif',
]);

const FOLDER_SUFFIX_WORDS = [
  'chairs',
  'chair',
  'tables',
  'table',
  'tents',
  'tent',
  'sofas',
  'sofa',
  'stools',
  'stool',
  'frames',
  'frame',
  'mixers',
  'mixer',
  'coolers',
  'cooler',
  'equipment',
  'lights',
  'light',
  'flowers',
  'flower',
];

const EXCLUDED_UPLOAD_FOLDERS = new Set([
  'booking-documents',
]);

export class BackfillItemTypePictures2026031700020 implements MigrationInterface {
  name = 'BackfillItemTypePictures2026031700020';

  private readonly uploadRootDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('item_types'))) {
      return;
    }

    if (!fs.existsSync(this.uploadRootDir)) {
      return;
    }

    const itemTypes = await queryRunner.query(`
      SELECT id, name, pictureUrl
      FROM item_types
      WHERE pictureUrl IS NULL OR pictureUrl = ''
    `) as ItemTypeRow[];

    for (const itemType of itemTypes) {
      const pictureUrl = this.resolveSeedPictureUrl(itemType.name);
      if (!pictureUrl) {
        continue;
      }

      await queryRunner.query(
        `
          UPDATE item_types
          SET pictureUrl = ?, updatedAt = CURRENT_TIMESTAMP(6)
          WHERE id = ?
            AND (pictureUrl IS NULL OR pictureUrl = '')
        `,
        [pictureUrl, itemType.id],
      );
    }
  }

  public async down(): Promise<void> {
    return;
  }

  private resolveSeedPictureUrl(typeName: string): string | undefined {
    const folderName = this.resolveTypeImageFolder(typeName);
    if (!folderName) {
      return undefined;
    }

    const folderPath = join(this.uploadRootDir, folderName);
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      return undefined;
    }

    const imageFileName = this.pickImageFileName(folderPath);
    if (!imageFileName) {
      return undefined;
    }

    return posix.join('/uploads', folderName, imageFileName);
  }

  private resolveTypeImageFolder(typeName: string): string | undefined {
    const entries = fs.readdirSync(this.uploadRootDir, { withFileTypes: true });
    const folderNames = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((folderName) => !EXCLUDED_UPLOAD_FOLDERS.has(folderName));

    if (!folderNames.length) {
      return undefined;
    }

    const normalizedFolderMap = new Map<string, string>();
    for (const folderName of folderNames) {
      normalizedFolderMap.set(this.normalizeForPath(folderName), folderName);
    }

    const folderCandidates = this.getTypeFolderCandidates(typeName);
    for (const candidate of folderCandidates) {
      const exactMatch = normalizedFolderMap.get(candidate);
      if (exactMatch) {
        return exactMatch;
      }
    }

    const fullSlug = this.normalizeForPath(typeName);
    for (const [normalizedFolderName, rawFolderName] of normalizedFolderMap) {
      if (
        fullSlug.startsWith(`${normalizedFolderName}-`)
        || normalizedFolderName.startsWith(`${fullSlug}-`)
      ) {
        return rawFolderName;
      }
    }

    return undefined;
  }

  private getTypeFolderCandidates(typeName: string): string[] {
    const fullSlug = this.normalizeForPath(typeName);
    const candidates = new Set<string>([fullSlug]);

    let trimmedSlug = fullSlug;
    for (const suffixWord of FOLDER_SUFFIX_WORDS) {
      const suffix = `-${suffixWord}`;
      if (trimmedSlug.endsWith(suffix)) {
        trimmedSlug = trimmedSlug.slice(0, -suffix.length);
        if (trimmedSlug) {
          candidates.add(trimmedSlug);
        }
      }
    }

    return Array.from(candidates);
  }

  private pickImageFileName(folderPath: string): string | undefined {
    const fileNames = fs.readdirSync(folderPath)
      .filter((fileName) => IMAGE_EXTENSIONS.has(extname(fileName).toLowerCase()))
      .sort((left, right) => left.localeCompare(right));

    return fileNames[0];
  }

  private normalizeForPath(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}