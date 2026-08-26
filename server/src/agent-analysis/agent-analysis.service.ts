import { Injectable } from '@nestjs/common';
import { StockService } from '../stock/stock.service';

interface TechnicalAnalysis {
  score: number; // 0-100
  signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  indicators: {
    name: string;
    value: string;
    signal: 'buy' | 'neutral' | 'sell';
  }[];
  summary: string;
}

interface FundamentalAnalysis {
  score: number;
  signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  metrics: {
    name: string;
    value: string;
    rating: 'excellent' | 'good' | 'fair' | 'poor';
  }[];
  summary: string;
}

interface CapitalFlowAnalysis {
  score: number;
  signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  mainForce: { direction: 'inflow' | 'outflow'; amount: string; percent: number };
  northBound: { direction: 'inflow' | 'outflow'; amount: string };
  margin: { direction: 'increase' | 'decrease'; amount: string };
  summary: string;
}

interface SentimentAnalysis {
  score: number;
  signal: 'bullish' | 'slightly_bullish' | 'neutral' | 'slightly_bearish' | 'bearish';
  news: { title: string; sentiment: 'positive' | 'negative' | 'neutral'; time: string }[];
  summary: string;
}

export interface AgentAnalysisResult {
  symbol: string;
  name: string;
  timestamp: string;
  overallScore: number;
  overallSignal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  technical: TechnicalAnalysis;
  fundamental: FundamentalAnalysis;
  capitalFlow: CapitalFlowAnalysis;
  sentiment: SentimentAnalysis;
  recommendation: string;
  actionPlan: {
    action: 'buy' | 'sell' | 'hold' | 'reduce';
    targetPrice: number;
    stopLoss: number;
    positionSize: number;
    confidence: number;
    reason: string;
  };
}

@Injectable()
export class AgentAnalysisService {
  constructor(private readonly stockService: StockService) {}

  /**
   * 执行多维度 Agent 分析
   */
  async analyze(symbol: string): Promise<AgentAnalysisResult | null> {
    const stock = await this.stockService.getStockQuote(symbol);
    if (!stock) return null;

    const technical = this.analyzeTechnical(stock);
    const fundamental = this.analyzeFundamental(stock);
    const capitalFlow = this.analyzeCapitalFlow(stock);
    const sentiment = this.analyzeSentiment(stock);

    // 综合评分（加权平均）
    const overallScore = Math.round(
      technical.score * 0.35 +
      fundamental.score * 0.25 +
      capitalFlow.score * 0.25 +
      sentiment.score * 0.15,
    );

    const overallSignal = this.scoreToSignal(overallScore);
    const recommendation = this.generateRecommendation(overallScore, technical, fundamental, capitalFlow, sentiment);
    const actionPlan = this.generateActionPlan(stock, overallScore, overallSignal);

    return {
      symbol,
      name: stock.name,
      timestamp: new Date().toISOString(),
      overallScore,
      overallSignal,
      technical,
      fundamental,
      capitalFlow,
      sentiment,
      recommendation,
      actionPlan,
    };
  }

  /**
   * 技术面分析（借鉴 FreqTrade 多指标共振）
   */
  private analyzeTechnical(stock: any): TechnicalAnalysis {
    const price = stock.price;
    const changePercent = stock.changePercent;
    const high52w = stock.high52w;
    const low52w = stock.low52w;
    const position52w = (price - low52w) / (high52w - low52w);

    const indicators: { name: string; value: string; signal: 'buy' | 'neutral' | 'sell' }[] = [];
    let score = 50;

    // MA 分析
    const ma5 = price * (1 - changePercent / 100 * 0.3);
    const ma20 = price * (1 - changePercent / 100 * 1.2);
    const ma60 = price * (1 - changePercent / 100 * 3);
    if (ma5 > ma20 && ma20 > ma60) {
      indicators.push({ name: '均线系统', value: '多头排列', signal: 'buy' as const });
      score += 15;
    } else if (ma5 < ma20 && ma20 < ma60) {
      indicators.push({ name: '均线系统', value: '空头排列', signal: 'sell' as const });
      score -= 15;
    } else {
      indicators.push({ name: '均线系统', value: '交叉震荡', signal: 'neutral' as const });
    }

    // MACD 分析
    const macdSignal = changePercent > 1 ? 'buy' : changePercent < -1 ? 'sell' : 'neutral';
    const macdValue = changePercent > 1 ? '金叉' : changePercent < -1 ? '死叉' : '震荡';
    indicators.push({ name: 'MACD', value: macdValue, signal: macdSignal });
    score += macdSignal === 'buy' ? 10 : macdSignal === 'sell' ? -10 : 0;

    // RSI 分析
    const rsi = 50 + changePercent * 8 + (Math.random() - 0.5) * 10;
    const rsiClamped = Math.max(10, Math.min(90, rsi));
    if (rsiClamped > 70) {
      indicators.push({ name: 'RSI', value: rsiClamped.toFixed(1) + ' 超买', signal: 'sell' as const });
      score -= 10;
    } else if (rsiClamped < 30) {
      indicators.push({ name: 'RSI', value: rsiClamped.toFixed(1) + ' 超卖', signal: 'buy' as const });
      score += 10;
    } else {
      indicators.push({ name: 'RSI', value: rsiClamped.toFixed(1) + ' 中性', signal: 'neutral' as const });
    }

    // BOLL 分析
    if (position52w > 0.8) {
      indicators.push({ name: 'BOLL', value: '触及上轨', signal: 'sell' as const });
      score -= 5;
    } else if (position52w < 0.2) {
      indicators.push({ name: 'BOLL', value: '触及下轨', signal: 'buy' as const });
      score += 5;
    } else {
      indicators.push({ name: 'BOLL', value: '中轨运行', signal: 'neutral' as const });
    }

    // KDJ 分析
    const kdjValue = changePercent > 2 ? '金叉' : changePercent < -2 ? '死叉' : '中性';
    const kdjSignal = changePercent > 2 ? 'buy' : changePercent < -2 ? 'sell' : 'neutral';
    indicators.push({ name: 'KDJ', value: kdjValue, signal: kdjSignal as any });
    score += kdjSignal === 'buy' ? 5 : kdjSignal === 'sell' ? -5 : 0;

    // 52周位置
    if (position52w < 0.3) {
      indicators.push({ name: '52周位置', value: (position52w * 100).toFixed(0) + '% 低位', signal: 'buy' as const });
      score += 5;
    } else if (position52w > 0.7) {
      indicators.push({ name: '52周位置', value: (position52w * 100).toFixed(0) + '% 高位', signal: 'sell' as const });
      score -= 5;
    } else {
      indicators.push({ name: '52周位置', value: (position52w * 100).toFixed(0) + '% 中位', signal: 'neutral' as const });
    }

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      signal: this.scoreToSignal(score),
      indicators,
      summary: `技术面综合评分 ${score}/100，${score >= 60 ? '偏多' : score <= 40 ? '偏空' : '震荡'}信号。`,
    };
  }

  /**
   * 基本面分析
   */
  private analyzeFundamental(stock: any): FundamentalAnalysis {
    const metrics: { name: string; value: string; rating: 'excellent' | 'good' | 'fair' | 'poor' }[] = [];
    let score = 50;

    // PE 分析
    const pe = stock.pe;
    if (pe < 15) {
      metrics.push({ name: '市盈率(PE)', value: pe.toFixed(1), rating: 'excellent' as const });
      score += 15;
    } else if (pe < 25) {
      metrics.push({ name: '市盈率(PE)', value: pe.toFixed(1), rating: 'good' as const });
      score += 8;
    } else if (pe < 40) {
      metrics.push({ name: '市盈率(PE)', value: pe.toFixed(1), rating: 'fair' as const });
      score += 0;
    } else {
      metrics.push({ name: '市盈率(PE)', value: pe.toFixed(1), rating: 'poor' as const });
      score -= 10;
    }

    // PB 分析
    const pb = stock.pb;
    if (pb < 1.5) {
      metrics.push({ name: '市净率(PB)', value: pb.toFixed(2), rating: 'excellent' as const });
      score += 10;
    } else if (pb < 3) {
      metrics.push({ name: '市净率(PB)', value: pb.toFixed(2), rating: 'good' as const });
      score += 5;
    } else if (pb < 8) {
      metrics.push({ name: '市净率(PB)', value: pb.toFixed(2), rating: 'fair' as const });
    } else {
      metrics.push({ name: '市净率(PB)', value: pb.toFixed(2), rating: 'poor' as const });
      score -= 5;
    }

    // ROE 分析
    const roe = stock.roe;
    if (roe > 20) {
      metrics.push({ name: '净资产收益率(ROE)', value: roe.toFixed(1) + '%', rating: 'excellent' as const });
      score += 15;
    } else if (roe > 12) {
      metrics.push({ name: '净资产收益率(ROE)', value: roe.toFixed(1) + '%', rating: 'good' as const });
      score += 8;
    } else if (roe > 6) {
      metrics.push({ name: '净资产收益率(ROE)', value: roe.toFixed(1) + '%', rating: 'fair' as const });
    } else {
      metrics.push({ name: '净资产收益率(ROE)', value: roe.toFixed(1) + '%', rating: 'poor' as const });
      score -= 8;
    }

    // 市值分析
    const marketCap = stock.marketCap;
    const capStr = marketCap >= 1000000000000
      ? (marketCap / 1000000000000).toFixed(1) + '万亿'
      : (marketCap / 100000000).toFixed(0) + '亿';
    if (marketCap > 500000000000) {
      metrics.push({ name: '总市值', value: capStr, rating: 'excellent' as const });
      score += 5;
    } else if (marketCap > 100000000000) {
      metrics.push({ name: '总市值', value: capStr, rating: 'good' as const });
      score += 3;
    } else {
      metrics.push({ name: '总市值', value: capStr, rating: 'fair' as const });
    }

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      signal: this.scoreToSignal(score),
      metrics,
      summary: `基本面评分 ${score}/100，${stock.name}估值${pe < 20 ? '偏低' : pe < 35 ? '合理' : '偏高'}，ROE${roe > 15 ? '优秀' : roe > 10 ? '良好' : '一般'}。`,
    };
  }

  /**
   * 资金面分析（模拟）
   */
  private analyzeCapitalFlow(stock: any): CapitalFlowAnalysis {
    const changePercent = stock.changePercent;

    // 模拟主力资金流向
    const mainForceInflow = changePercent > 0;
    const mainForceAmount = Math.abs(changePercent * stock.volume * stock.price / 100).toFixed(0);
    const mainForcePercent = Math.abs(changePercent * 2.5);

    // 模拟北向资金
    const northInflow = Math.random() > 0.4;
    const northAmount = (Math.random() * 5 + 0.5).toFixed(2);

    // 模拟融资融券
    const marginIncrease = changePercent > 0 ? Math.random() > 0.3 : Math.random() > 0.7;

    let score = 50;
    if (mainForceInflow) score += 15; else score -= 15;
    if (northInflow) score += 10; else score -= 10;
    if (marginIncrease) score += 5; else score -= 5;
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      signal: this.scoreToSignal(score),
      mainForce: {
        direction: mainForceInflow ? 'inflow' : 'outflow',
        amount: mainForceAmount + '万',
        percent: parseFloat(mainForcePercent.toFixed(2)),
      },
      northBound: {
        direction: northInflow ? 'inflow' : 'outflow',
        amount: northAmount + '亿',
      },
      margin: {
        direction: marginIncrease ? 'increase' : 'decrease',
        amount: (Math.random() * 2 + 0.1).toFixed(2) + '亿',
      },
      summary: `资金面评分 ${score}/100，主力${mainForceInflow ? '净流入' : '净流出'}${mainForceAmount}万，北向资金${northInflow ? '净买入' : '净卖出'}${northAmount}亿。`,
    };
  }

  /**
   * 消息面分析（模拟）
   */
  private analyzeSentiment(stock: any): SentimentAnalysis {
    const newsTemplates = [
      { title: `${stock.name}发布最新财报，营收同比增长${(Math.random() * 20 + 5).toFixed(1)}%`, sentiment: 'positive' as const },
      { title: `${stock.industry}行业政策利好，多只个股涨停`, sentiment: 'positive' as const },
      { title: `机构调研${stock.name}，关注未来发展布局`, sentiment: 'positive' as const },
      { title: `${stock.name}获北向资金连续5日净买入`, sentiment: 'positive' as const },
      { title: `${stock.name}面临行业竞争加剧压力`, sentiment: 'negative' as const },
      { title: `市场波动加大，${stock.industry}板块承压`, sentiment: 'negative' as const },
      { title: `${stock.name}高管减持计划公告`, sentiment: 'negative' as const },
      { title: `${stock.name}召开业绩说明会`, sentiment: 'neutral' as const },
      { title: `${stock.industry}行业景气度维持`, sentiment: 'neutral' as const },
    ];

    // 随机选3-5条新闻
    const shuffled = newsTemplates.sort(() => Math.random() - 0.5);
    const selectedNews = shuffled.slice(0, 3 + Math.floor(Math.random() * 3)).map((n) => ({
      ...n,
      time: `${Math.floor(Math.random() * 24)}小时前`,
    }));

    const positiveCount = selectedNews.filter((n) => n.sentiment === 'positive').length;
    const negativeCount = selectedNews.filter((n) => n.sentiment === 'negative').length;

    let score = 50;
    score += (positiveCount - negativeCount) * 10;
    score = Math.max(0, Math.min(100, score));

    const sentimentSignal =
      score >= 70 ? 'bullish' : score >= 55 ? 'slightly_bullish' : score <= 30 ? 'bearish' : score <= 45 ? 'slightly_bearish' : 'neutral';

    return {
      score,
      signal: sentimentSignal,
      news: selectedNews,
      summary: `消息面评分 ${score}/100，近期${positiveCount > negativeCount ? '利好消息偏多' : negativeCount > positiveCount ? '利空消息偏多' : '消息面中性'}。`,
    };
  }

  /**
   * 生成综合建议
   */
  private generateRecommendation(
    score: number,
    technical: TechnicalAnalysis,
    fundamental: FundamentalAnalysis,
    capitalFlow: CapitalFlowAnalysis,
    sentiment: SentimentAnalysis,
  ): string {
    const parts: string[] = [];

    if (score >= 70) {
      parts.push('综合研判：强烈看多');
    } else if (score >= 55) {
      parts.push('综合研判：偏多');
    } else if (score >= 45) {
      parts.push('综合研判：中性观望');
    } else if (score >= 30) {
      parts.push('综合研判：偏空');
    } else {
      parts.push('综合研判：强烈看空');
    }

    parts.push(`技术面${technical.score >= 60 ? '偏多' : technical.score <= 40 ? '偏空' : '震荡'}`);
    parts.push(`基本面${fundamental.score >= 60 ? '扎实' : fundamental.score <= 40 ? '薄弱' : '一般'}`);
    parts.push(`资金面${capitalFlow.score >= 60 ? '流入' : capitalFlow.score <= 40 ? '流出' : '平衡'}`);
    parts.push(`消息面${sentiment.score >= 60 ? '偏正面' : sentiment.score <= 40 ? '偏负面' : '中性'}`);

    return parts.join('，') + '。';
  }

  /**
   * 生成交易行动计划
   */
  private generateActionPlan(stock: any, score: number, signal: string) {
    const price = stock.price;
    let action: 'buy' | 'sell' | 'hold' | 'reduce';
    let targetPrice: number;
    let stopLoss: number;
    let positionSize: number;
    let confidence: number;
    let reason: string;

    if (score >= 70) {
      action = 'buy';
      targetPrice = price * 1.12;
      stopLoss = price * 0.95;
      positionSize = 20;
      confidence = Math.min(95, score + 10);
      reason = '多维度共振看多，技术面与资金面同步向好，建议积极建仓';
    } else if (score >= 55) {
      action = 'buy';
      targetPrice = price * 1.08;
      stopLoss = price * 0.96;
      positionSize = 10;
      confidence = score;
      reason = '综合偏多但信号不够强烈，建议轻仓试探';
    } else if (score >= 45) {
      action = 'hold';
      targetPrice = price;
      stopLoss = price * 0.97;
      positionSize = 0;
      confidence = 50;
      reason = '多空信号交织，建议持仓观望等待方向明确';
    } else if (score >= 30) {
      action = 'reduce';
      targetPrice = price * 0.95;
      stopLoss = price * 1.03;
      positionSize = 0;
      confidence = 100 - score;
      reason = '综合偏空，建议减仓规避风险';
    } else {
      action = 'sell';
      targetPrice = price * 0.88;
      stopLoss = price * 1.05;
      positionSize = 0;
      confidence = Math.min(95, 100 - score + 10);
      reason = '多维度共振看空，建议清仓离场';
    }

    return {
      action,
      targetPrice: parseFloat(targetPrice.toFixed(2)),
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      positionSize,
      confidence,
      reason,
    };
  }

  private scoreToSignal(score: number): 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell' {
    if (score >= 75) return 'strong_buy';
    if (score >= 60) return 'buy';
    if (score >= 40) return 'neutral';
    if (score >= 25) return 'sell';
    return 'strong_sell';
  }
}
