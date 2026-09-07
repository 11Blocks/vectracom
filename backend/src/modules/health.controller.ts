import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  async check() {
    let db = 'up';
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      db = 'down';
    }
    return {
      status: 'ok',
      service: 'vectracom-backend',
      db,
      timestamp: new Date().toISOString(),
    };
  }
}
