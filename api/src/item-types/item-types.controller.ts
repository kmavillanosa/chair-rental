import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ItemTypesService } from './item-types.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('item-types')
@Controller('item-types')
export class ItemTypesController {
  constructor(private readonly service: ItemTypesService) {}

  private normalizeTagList(input: unknown): string[] | undefined {
    if (input === undefined || input === null) return undefined;

    if (Array.isArray(input)) {
      return input
        .map((value: unknown) => String(value).trim().toLowerCase())
        .filter(Boolean);
    }

    if (typeof input === 'string') {
      const normalizedValue = input.trim();
      if (!normalizedValue) return [];

      try {
        const parsed = JSON.parse(normalizedValue);
        if (Array.isArray(parsed)) {
          return parsed
            .map((value) => String(value).trim().toLowerCase())
            .filter(Boolean);
        }
      } catch {
        // Fall through to comma-separated parsing.
      }

      return normalizedValue
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
    }

    return undefined;
  }

  private normalizeBody(body: any) {
    if (body.defaultRatePerDay !== undefined) {
      const parsed = Number(body.defaultRatePerDay);
      body.defaultRatePerDay = Number.isFinite(parsed) ? parsed : 0;
    }

    if (body.isActive !== undefined) {
      const normalized = String(body.isActive).trim().toLowerCase();
      body.isActive = ['1', 'true', 'yes', 'on'].includes(normalized);
    }

    if (body.eventTags !== undefined) {
      body.eventTags = this.normalizeTagList(body.eventTags);
    }

    if (body.setTags !== undefined) {
      body.setTags = this.normalizeTagList(body.setTags);
    }

    return body;
  }

  @Get()
  findAll(
    @Query('eventTag') eventTag?: string,
    @Query('setTag') setTag?: string,
  ) {
    return this.service.findAll(false, { eventTag, setTag });
  }

  @Get('sets')
  findSetTags() { return this.service.findSetTags(false); }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get('admin/all')
  findAllAdmin(
    @Query('eventTag') eventTag?: string,
    @Query('setTag') setTag?: string,
  ) {
    return this.service.findAll(true, { eventTag, setTag });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get('admin/sets')
  findSetTagsAdmin() { return this.service.findSetTags(true); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findById(id); }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Post()
  @UseInterceptors(FileInterceptor('picture', {
    storage: diskStorage({
      destination: process.env.UPLOAD_DIR || './uploads',
      filename: (_, file, cb) => cb(null, `${Date.now()}${extname(file.originalname)}`),
    }),
  }))
  create(@Body() body: any, @UploadedFile() file?: Express.Multer.File) {
    if (file) body.pictureUrl = `/uploads/${file.filename}`;
    this.normalizeBody(body);
    return this.service.create(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Patch(':id')
  @UseInterceptors(FileInterceptor('picture', {
    storage: diskStorage({
      destination: process.env.UPLOAD_DIR || './uploads',
      filename: (_, file, cb) => cb(null, `${Date.now()}${extname(file.originalname)}`),
    }),
  }))
  update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) body.pictureUrl = `/uploads/${file.filename}`;
    this.normalizeBody(body);
    return this.service.update(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
