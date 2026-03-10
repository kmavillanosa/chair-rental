import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  findAll() {
    return this.usersRepo.find();
  }

  findById(id: string) {
    return this.usersRepo.findOne({ where: { id } });
  }

  findByEmail(email: string) {
    return this.usersRepo.findOne({ where: { email } });
  }

  findByGoogleId(googleId: string) {
    return this.usersRepo.findOne({ where: { googleId } });
  }

  async findOrCreate(profile: { googleId: string; email: string; name: string; avatar: string }) {
    let user = await this.findByGoogleId(profile.googleId);
    if (!user) {
      user = await this.findByEmail(profile.email);
    }
    if (!user) {
      user = this.usersRepo.create({
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
        role: UserRole.CUSTOMER,
      });
      await this.usersRepo.save(user);
    } else if (!user.googleId) {
      user.googleId = profile.googleId;
      await this.usersRepo.save(user);
    }
    return user;
  }

  async updateRole(id: string, role: UserRole) {
    await this.usersRepo.update(id, { role });
    return this.findById(id);
  }

  async setActive(id: string, isActive: boolean) {
    await this.usersRepo.update(id, { isActive });
    return this.findById(id);
  }
}
