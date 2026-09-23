import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ScreenerService } from './screener.service';
import {
  FIELD_DEFINITIONS,
  SCREENER_FIELDS,
  ScreenerRequestSchema,
  ScreenerResponse,
} from './schema';

/**
 * 条件选股器 controller
 *
 * 路由：
 * - GET  /api/stock/screener/fields  暴露字段字典给前端
 * - POST /api/stock/screener        提交选股请求（body 由 ScreenerRequestSchema 校验）
 *
 * 关键决策：
 * - Schema 校验失败直接抛 BadRequestException(400)，错误数组透传给前端便于表单定位。
 * - Schema 校验通过后，service 异常不再向上抛 —— 返回空结果集（结构完整），避免 500 雪崩。
 *   ScreenerService 内部已 try/catch 兜底；这里再 catch 一次防御 controller 层未捕获的 panic。
 * - 字段字典返回精简结构：`fields`（12 个 FieldDefinition）+ `sort`（前端用于构建排序下拉）。
 *   不返回枚举常量（FILTER_OPS/SCREENER_COMBINATORS），前端表单已内化，避免冗余。
 */
@Controller('stock/screener')
export class ScreenerController {
  constructor(private readonly screener: ScreenerService) {}

  @Post()
  @HttpCode(200)
  async evaluate(
    @Body() body: unknown,
  ): Promise<{ code: number; msg: string; data: ScreenerResponse }> {
    const parsed = ScreenerRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    try {
      const data = await this.screener.evaluate(parsed.data);
      return { code: 200, msg: 'success', data };
    } catch {
      // 兜底：service 抛出的异常不应让 controller 5xx
      const empty: ScreenerResponse = {
        items: [],
        total: 0,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        combinator: parsed.data.combinator,
      };
      return { code: 200, msg: 'success', data: empty };
    }
  }

  @Get('fields')
  @HttpCode(200)
  listFields(): {
    code: number;
    msg: string;
    data: { fields: typeof FIELD_DEFINITIONS; sort: typeof SCREENER_FIELDS };
  } {
    return {
      code: 200,
      msg: 'success',
      data: { fields: FIELD_DEFINITIONS, sort: SCREENER_FIELDS },
    };
  }
}
