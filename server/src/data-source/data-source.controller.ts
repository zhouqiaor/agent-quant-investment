import { Controller, Get, HttpCode } from '@nestjs/common';
import { DataSourceService } from './data-source.service';

@Controller('data-sources')
export class DataSourceController {
  constructor(private readonly dataSourceService: DataSourceService) {}

  @Get()
  @HttpCode(200)
  async list() {
    const { sources, updatedAt } = await this.dataSourceService.getDataSources();
    return {
      code: 200,
      msg: 'success',
      data: { sources, updatedAt },
    };
  }
}