import { Injectable } from '@nestjs/common'

export interface GlossaryEntry {
  term: string
  short: string
  detail: string
  formula?: string
  example?: string
}

const ENTRIES: Record<string, GlossaryEntry> = {
  sharpe: {
    term: 'Sharpe Ratio',
    short: '每承担一单位总风险，能获得多少超额收益。',
    detail:
      '将「平均收益率」与「收益率波动（标准差）」做比较，再按 √periods_per_year 年化。值越高，单位风险带来的回报越优。一般认为 Sharpe > 1 是合格的策略，> 2 是优秀的策略。',
    formula: 'Sharpe = mean(rate) / std(rate) × √periods_per_year',
    example: '日级数据：日均 +0.1%，日波动 0.5% → Sharpe ≈ 0.1/0.5 × √252 ≈ 3.17',
  },
  sortino: {
    term: 'Sortino Ratio',
    short: 'Sharpe 的"只算下行风险"升级版。',
    detail:
      '与 Sharpe 类似，但分母只取「亏损时的波动」（下行偏差）。同样回报下，回撤越小 Sortino 越高。它更贴合投资者"只怕跌不怕涨"的真实感受。',
    formula: 'Sortino = mean(rate) / downsideStd × √periods_per_year',
    example: '上行波动大但回撤小的策略：Sortino 显著高于 Sharpe。',
  },
  maxdd: {
    term: '最大回撤 (MaxDD)',
    short: '历史上从高点最多跌了多少。',
    detail:
      '一路滚动的「累计收益」相对历史最高点的最大跌幅。值越接近 0 越稳，越负越剧烈。-10% 算浅、-30% 算深、超过 -50% 通常被视为灾难性回撤。',
    formula: 'MaxDD = min_i (equity_i − max_{j≤i} equity_j) / max_{j≤i} equity_j',
    example: '账户从 100 万涨到 130 万，回撤到 95 万 → MaxDD ≈ -26.9%',
  },
  calmar: {
    term: 'Calmar Ratio',
    short: '年化收益除以最大回撤，越高越能扛。',
    detail:
      '把"赚得多"和"扛得住"放在一把尺上比。Calmar 越高，意味着策略在承担相回撤的情况下能赚到更多收益。一般 Calmar > 1 是合格的、> 3 是优秀的。',
    formula: 'Calmar = annualReturn / |MaxDD|',
    example: '年化 +18%，MaxDD -6% → Calmar = 18 / 6 = 3.0',
  },
  momentum: {
    term: '动量 (Momentum)',
    short: '追涨杀跌：涨得多的继续买，跌得多的继续卖。',
    detail:
      '假设资产收益在短期内会延续。买入过去 N 日涨幅最高的资产，卖出（或做空）跌幅最大的。简单粗暴，在趋势市场有效，震荡市容易被反复打脸。',
    example: 'N=20，买入过去 20 日涨幅前 10%，调仓周期 30 日。',
  },
  ma_cross: {
    term: '均线金叉死叉 (MA Cross)',
    short: '短均线上穿长均线为金叉（买入信号），下穿为死叉（卖出信号）。',
    detail:
      '经典趋势跟踪指标。常用 5/20、10/60 等组合。优点是规则明确、参数少；缺点是滞后——金叉出现时往往已经涨了一段，死叉出现时已经跌了一段。',
    example: 'MA5 上穿 MA20 → 买入；MA5 下穿 MA20 → 卖出。',
  },
  breakout: {
    term: '突破 (Breakout)',
    short: '价格突破近期高点或低点时入场。',
    detail:
      '认为"突破"代表新趋势起点。优点是能在起点上车；缺点是大量假突破（"假突破-真陷阱"），需要配合成交量或波动率过滤才靠谱。',
    example: '突破 20 日最高价买入，跌破 20 日最低价卖出。',
  },
  reversal: {
    term: '反转 (Reversal)',
    short: '跌多了反弹：超卖时买入，超买时卖出。',
    detail:
      '与动量相反。假设价格"过分下跌"会均值回归。常用 RSI、布林带下轨等指标。震荡市有效，单边下跌市会被一路套牢。',
    example: 'RSI < 30 买入，RSI > 70 卖出。',
  },
  trend_follow: {
    term: '趋势跟随 (Trend Follow)',
    short: '突破 + 均线 等多种信号加权投票，信号越强仓位越重。',
    detail:
      '本质是"信号融合"——单信号可能假，多信号共振则更可信。本系统用 5 个子信号（动量、均线、突破、波动率过滤、相关性惩罚）加权打分，得到 -1..1 的 trend_score。',
    example: 'trend_score > 0.3 满仓买入；-0.3..0.3 观望；< -0.3 满仓卖出。',
  },
}

@Injectable()
export class GlossaryService {
  list(): GlossaryEntry[] {
    return Object.values(ENTRIES)
  }

  get(key: string): GlossaryEntry | null {
    return ENTRIES[key] ?? null
  }
}