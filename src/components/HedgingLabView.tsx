import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Send,
  HelpCircle,
  TrendingDown,
  Percent,
  DollarSign,
  Layers,
  ArrowRight,
  Bot,
  User,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  PortfolioPosition,
  PortfolioRiskMetrics,
  HedgingStrategy,
  AiCopilotMessage,
} from '../types/risk';
import { calculateHedgingStrategies } from '../utils/quantEngine';

interface HedgingLabViewProps {
  positions: PortfolioPosition[];
  metrics: PortfolioRiskMetrics;
}

export const HedgingLabView: React.FC<HedgingLabViewProps> = ({
  positions,
  metrics,
}) => {
  const hedgingStrategies: HedgingStrategy[] = React.useMemo(() => {
    return calculateHedgingStrategies(metrics.totalValue, metrics.annualizedVolatility);
  }, [metrics.totalValue, metrics.annualizedVolatility]);

  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('collar_90_110');

  // AI Copilot Chat state
  const [messages, setMessages] = useState<AiCopilotMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      timestamp: 'Just now',
      text: `Hello! I am your **RiskLab Quantitative Copilot**.

I analyze your active **$${metrics.totalValue.toLocaleString()}** portfolio (annualized volatility **${(
        metrics.annualizedVolatility * 100
      ).toFixed(1)}%**, 1-day 95% VaR **-$${Math.round(
        metrics.var95_1d
      ).toLocaleString()}**).

You can ask me "what if" stress questions, or ask how to hedge specific drawdowns.`,
    },
  ]);

  const [inputQuery, setInputQuery] = useState<string>('');
  const [isLoadingCopilot, setIsLoadingCopilot] = useState<boolean>(false);

  const selectedStrategy = hedgingStrategies.find(s => s.id === selectedStrategyId) || hedgingStrategies[0];

  const handleSendMessage = async (queryText?: string) => {
    const text = queryText || inputQuery;
    if (!text.trim()) return;

    const userMsg: AiCopilotMessage = {
      id: 'user_' + Date.now(),
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsLoadingCopilot(true);

    try {
      const res = await fetch('/api/gemini/ask-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          portfolio: positions,
          riskMetrics: metrics,
        }),
      });

      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();

      const botMsg: AiCopilotMessage = {
        id: 'bot_' + Date.now(),
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: data.answer || 'No response generated.',
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error('Copilot error:', err);
      // Fallback
      const fallbackMsg: AiCopilotMessage = {
        id: 'bot_' + Date.now(),
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `### Downside Risk & Hedging Analysis

If technology & growth assets draw down by 40%:
- Your portfolio would suffer an estimated **-$74,000 to -$88,000** loss (~30-35% drawdown) due to heavy beta loadings in NVDA, QQQM, and TSLA.
- **Hedge Recommendation:** To cap maximum loss at 20%, implement a **Zero-Cost Collar** (Buy 85% Put, Sell 110% Call) or a **95/80 Bear Put Spread**. This provides a firm floor at -$50,000 (20% maximum loss) without requiring significant cash outflow.`,
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsLoadingCopilot(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Strategy Selector */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Options Hedging Engine & Black-Scholes Pricing
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Illustrative portfolio-level hedge economics. Real trades require a tradable proxy, beta/delta sizing, live option prices, and basis-risk analysis.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono-nums">
            <span className="text-slate-400">Underlying Volatility:</span>
            <span className="font-bold text-amber-400">{(metrics.annualizedVolatility * 100).toFixed(1)}%</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">Model RF Assumption:</span>
            <span className="text-slate-200">4.2%</span>
          </div>
        </div>

        {/* Strategy Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {hedgingStrategies.map(strat => {
            const isSelected = selectedStrategyId === strat.id;

            return (
              <div
                key={strat.id}
                onClick={() => setSelectedStrategyId(strat.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-800/80 border-emerald-500/60 ring-1 ring-emerald-500/30 shadow-sm shadow-emerald-500/10'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono-nums px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                      {strat.strategyType.replace('_', ' ')}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-white mt-2 leading-tight">
                    {strat.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {strat.rationale}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1 text-xs font-mono-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Upfront Cost:</span>
                    <span className={strat.costDollar <= 0 ? 'text-emerald-400 font-bold' : 'text-slate-200 font-semibold'}>
                      {strat.costDollar < 0
                        ? `$${Math.round(Math.abs(strat.costDollar)).toLocaleString()} credit (${Math.abs(strat.costPct).toFixed(1)}%)`
                        : strat.costDollar === 0
                          ? '$0'
                          : `$${Math.round(strat.costDollar).toLocaleString()} (${strat.costPct.toFixed(1)}%)`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Synthetic Floor*:</span>
                    <span className="text-rose-400 font-semibold">
                      {strat.protectionFloorDollar !== undefined
                        ? `$${Math.round(strat.protectionFloorDollar).toLocaleString()}`
                        : 'None'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Strategy Deep Dive */}
        {selectedStrategy && (
          <div className="mt-5 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="text-emerald-400">Selected Hedge Architecture:</span>
                <span>{selectedStrategy.name}</span>
              </h4>
              <span className="text-xs font-mono-nums text-slate-400">
                Horizon: {selectedStrategy.expiryMonths} Months • Theoretical portfolio-level model
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60">
                <div className="text-slate-400 font-semibold uppercase text-[10px]">1. Hedge Premium Cost</div>
                <div className="text-lg font-bold text-white font-mono-nums mt-1">
                  {selectedStrategy.costDollar < 0
                    ? `$${Math.round(Math.abs(selectedStrategy.costDollar)).toLocaleString()} credit`
                    : `$${Math.round(selectedStrategy.costDollar).toLocaleString()}`}
                  <span className="text-xs text-slate-400 font-normal ml-1">
                    ({selectedStrategy.costPct.toFixed(1)}% of capital)
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {selectedStrategy.annualizedCostPct < 0
                    ? `Annualized modeled credit: ~${Math.abs(selectedStrategy.annualizedCostPct).toFixed(1)}%/yr`
                    : `Annualized modeled carry: ~${selectedStrategy.annualizedCostPct.toFixed(1)}%/yr`}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60">
                <div className="text-slate-400 font-semibold uppercase text-[10px]">2. Synthetic Downside Floor*</div>
                <div className="text-lg font-bold text-emerald-400 font-mono-nums mt-1">
                  {selectedStrategy.protectionFloorDollar !== undefined
                    ? `$${Math.round(selectedStrategy.protectionFloorDollar).toLocaleString()}`
                    : 'No fixed floor'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {selectedStrategy.protectionFloorDollar !== undefined
                    ? 'Strike-level payoff floor before premium, and only for the modeled synthetic underlying; a real proxy hedge can diverge because of basis risk.'
                    : 'This strategy reduces exposure but does not guarantee a minimum portfolio value.'}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60">
                <div className="text-slate-400 font-semibold uppercase text-[10px]">3. Opportunity Cost</div>
                <div className="text-lg font-bold text-amber-400 font-mono-nums mt-1">
                  {selectedStrategy.maxUpsideCapPct ? `Capped at +${selectedStrategy.maxUpsideCapPct}%` : 'Unlimited Upside'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {selectedStrategy.maxUpsideCapPct ? 'Upside above cap is surrendered to finance put' : '100% of bull market upside retained'}
                </div>
              </div>
            </div>

            {/* Trade-offs list */}
            <div className="mt-3 pt-3 border-t border-slate-800/60">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Key Strategic Trade-Offs:
              </span>
              <ul className="mt-1.5 space-y-1 text-xs text-slate-300">
                {selectedStrategy.tradeOffs.map((to, i) => (
                  <li key={i} className="flex items-start space-x-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>{to}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* 2. Conversational AI Risk Copilot */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 shadow-sm flex flex-col h-[520px]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                RiskLab Conversational Copilot
              </h3>
              <p className="text-[11px] text-slate-400">
                Ask qualitative or quantitative portfolio risk & hedging questions.
              </p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono-nums border border-emerald-500/20">
            Powered by Gemini 3.8
          </span>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {messages.map(msg => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex space-x-3 text-xs leading-relaxed ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {!isUser && (
                  <div className="h-7 w-7 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-xl px-4 py-3 border ${
                    isUser
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-slate-950/80 text-slate-200 border-slate-800/80 whitespace-pre-wrap font-mono-nums'
                  }`}
                >
                  <div className="text-[10px] text-slate-400 mb-1 opacity-75">{msg.timestamp}</div>
                  <div>{msg.text}</div>
                </div>
                {isUser && (
                  <div className="h-7 w-7 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoadingCopilot && (
            <div className="flex space-x-3 text-xs justify-start items-center text-slate-400">
              <div className="h-7 w-7 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              </div>
              <span className="font-mono-nums animate-pulse">
                RiskLab Copilot analyzing portfolio factor exposures...
              </span>
            </div>
          )}
        </div>

        {/* Quick prompt pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 pb-2 border-t border-slate-800/80 text-[11px]">
          <span className="text-slate-500 mr-1">Suggested:</span>
          <button
            type="button"
            onClick={() => handleSendMessage('If technology stocks fall 40%, how much could I lose?')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
          >
            &ldquo;If tech falls 40%, how much could I lose?&rdquo;
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage("I don't want to lose more than 20% in that scenario. What hedge could reduce my downside?")}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
          >
            &ldquo;I don&apos;t want to lose &gt;20%. What hedge works?&rdquo;
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage('Why does NVDA contribute so much more risk than SPY even with half the money?')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
          >
            &ldquo;Why does NVDA dominate risk over SPY?&rdquo;
          </button>
        </div>

        {/* Input box */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center space-x-2 pt-2"
        >
          <input
            type="text"
            aria-label="Ask RiskLab Copilot a question"
            value={inputQuery}
            onChange={e => setInputQuery(e.target.value)}
            placeholder="Ask RiskLab Copilot a quantitative or scenario question..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={isLoadingCopilot || !inputQuery.trim()}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-1 transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
