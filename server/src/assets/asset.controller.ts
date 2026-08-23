import { Controller, Get, HttpCode } from '@nestjs/common';
import { AssetService } from './asset.service';

@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get('overview')
  @HttpCode(200)
  getOverview() {
    return {
      code: 200,
      msg: 'success',
      data: this.assetService.getOverview(),
    };
  }

  @Get('positions')
  @HttpCode(200)
  getPositions() {
    return {
      code: 200,
      msg: 'success',
      data: this.assetService.getPositions(),
    };
  }

  @Get('positions/detail')
  @HttpCode(200)
  getPositionsDetail() {
    return {
      code: 200,
      msg: 'success',
      data: this.assetService.getPositionsDetail(),
    };
  }
}
