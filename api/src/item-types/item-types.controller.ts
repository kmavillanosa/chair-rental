import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile,
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

  @Get()
  findAll() { return this.service.findAll(); }

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
    return this.service.create(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
