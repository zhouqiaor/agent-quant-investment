import { Controller, Get, Param } from '@nestjs/common'
import { GlossaryService } from './glossary.service'

@Controller('glossary')
export class GlossaryController {
  constructor(private readonly glossary: GlossaryService) {}

  @Get()
  list() {
    return { data: this.glossary.list() }
  }

  @Get(':key')
  get(@Param('key') key: string) {
    const entry = this.glossary.get(key)
    if (!entry) return { data: null }
    return { data: entry }
  }
}