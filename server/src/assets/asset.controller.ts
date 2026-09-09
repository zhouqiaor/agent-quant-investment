import { Controller, Get, HttpCode, Query } from '@nestjs/common';
import { AssetService } from './asset.service';

@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get('overview')
  @HttpCode(200)
  getOverview(@Query('accountId') accountId?: string) {
    return {
      code: 200,
      msg: 'success',
      data: this.assetService.getOverview(accountId),
    };
  }

  @Get('positions')
  @HttpCode(200)
  getPositions(@Query('accountId') accountId?: string) {
    return {
      code: 200,
      msg: 'success',
      data: this.assetService.getPositions(accountId),
    };
  }

  @Get('positions/detail')
  @HttpCode(200)
  getPositionsDetail(@Query('accountId') accountId?: string) {
    return {
      code: 200,
      msg: 'success',
      data: this.assetService.getPositionsDetail(accountId),
    };
  }
}
