import {Explanation} from './Explanation';
import React, { useState } from 'react';
import {RefreshCw, Bot, User, Send} from 'lucide-react';
import {PortfolioPosition, PortfolioRiskMetrics, AiCopilotMessage} from '../types/risk';
import {buildSectorExposure} from '../utils/sectorExposure';

const MarkdownReply = React.lazy(() => import('./MarkdownReply').then(module => ({default: module.MarkdownReply})));

interface HedgingLabViewProps {
  positions: PortfolioPosition[];
  metrics: PortfolioRiskMetrics;
}

export const HedgingLabView: React.FC<HedgingLabViewProps> = ({
  positions,
  metrics,
}) => {
  const copilotRef = React.useRef<HTMLElement>(null);
  const feedRef = React.useRef<HTMLDivElement>(null);
  const exposureGroups = React.useMemo(() => buildSectorExposure(positions), [positions]);
  const topRisk = [...metrics.riskContributions].sort((a, b) => b.percentRiskContribution - a.percentRiskContribution)[0];

  // AI Copilot Chat state
  const [messages, setMessages] = useState<AiCopilotMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      timestamp: 'Just now',
      text: 'What would you like to understand about your portfolio? Ask about sector concentration, holdings that move together, or ways to reduce exposure.',
    },
  ]);

  const [inputQuery, setInputQuery] = useState<string>('');
  const [isLoadingCopilot, setIsLoadingCopilot] = useState<boolean>(false);

  React.useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages, isLoadingCopilot]);

  const handleSendMessage = async (queryText?: string) => {
    const text = queryText || inputQuery;
    if (!text.trim() || isLoadingCopilot) return;

    if (queryText) copilotRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});

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
        ai: data.ai ?? {provider: 'fallback', label: 'Legacy copilot service'},
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error('Copilot error:', err);
      // Fallback
      const fallbackMsg: AiCopilotMessage = {
        id: 'bot_' + Date.now(),
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `### Copilot unavailable

The AI explanation service is not available right now. RiskLab will not invent a portfolio-specific answer. You can still use the deterministic risk metrics, stress scenarios, and the sector and asset-group breakdown below.`,
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsLoadingCopilot(false);
    }
  };

  return (
    <div className="space-y-6">
      <section ref={copilotRef} aria-label="RiskLab Conversational Copilot" className="rounded-xl border border-emerald-500/30 bg-slate-900/70 p-5 shadow-sm">
      <div className="flex flex-col h-[520px]">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-white">
                RiskLab Conversational Copilot
              </h2>
              <p className="text-[11px] text-slate-400">
                ${Math.round(metrics.totalValue).toLocaleString()} portfolio · {(metrics.annualizedVolatility * 100).toFixed(1)}% modeled volatility
              </p>
            </div>
          </div>
          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono-nums border border-emerald-500/20">
            AI responses show their source
          </span>
        </div>

        {/* Message Feed */}
        <div ref={feedRef} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
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
                      : 'bg-slate-950/80 text-slate-200 border-slate-800/80 min-w-0'
                  }`}
                >
                  <div className="text-[10px] text-slate-400 mb-1 opacity-75">{msg.timestamp}</div>
                  {msg.ai && <div className="mb-2 text-sm font-semibold text-emerald-300">
                    {msg.ai.label}{msg.ai.provider === 'fallback' && msg.ai.reason === 'unavailable' ? ' · AI unavailable right now' : ''}
                  </div>}
                  {isUser ? <div className="whitespace-pre-wrap">{msg.text}</div> : <React.Suspense fallback={<p className="text-slate-400">Formatting response…</p>}><MarkdownReply text={msg.text} /></React.Suspense>}
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
            onClick={() => handleSendMessage('Review my known technology and semiconductor positions, plus possible overlap through mixed ETFs. Use the supplied sector groups; do not invent fund look-through percentages.')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
          >
            &ldquo;Technology & semiconductor exposure&rdquo;
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage("Compare healthcare, utilities, and consumer staples with my current exposures. Explain diversification tradeoffs without claiming they will always offset losses or recommending an allocation.")}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
          >
            &ldquo;Compare healthcare, utilities & staples&rdquo;
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage('Which holding contributes the most modeled risk, and why?')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
          >
            &ldquo;My biggest risk driver&rdquo;
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
            maxLength={2000}
            value={inputQuery}
            onChange={e => setInputQuery(e.target.value)}
            placeholder="e.g. How exposed am I to technology, and what could diversify it?"
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
      </section>

      <section aria-label="Portfolio sector and asset exposure" className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-white">Your sectors and exposures</h3>
          <p className="mt-1 text-xs text-slate-400">Position-level groups · Mixed funds are shown separately</p>
          {topRisk && <p className="mt-2 text-sm text-slate-300">Biggest modeled risk driver: <strong className="text-white">{topRisk.ticker}</strong> · {(topRisk.percentRiskContribution * 100).toFixed(1)}% of portfolio risk</p>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {exposureGroups.map(group => <article key={group.label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider text-slate-500">{group.kind === 'sector' ? 'Mapped sector positions' : group.kind === 'fund' ? 'Mixed-sector funds' : group.kind === 'asset' ? 'Asset group' : 'Sector data needed'}</p><h4 className="mt-1 font-semibold text-white">{group.label}</h4></div><span className="text-xl font-bold text-emerald-300">{group.percent.toFixed(1)}%</span></div>
            <p className="mt-2 text-xs text-slate-400">{group.tickers.join(', ')}</p>
            <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400/70" style={{width: `${group.percent}%`}} /></div>
            <button type="button" disabled={isLoadingCopilot} onClick={() => handleSendMessage(`Review the risk in my ${group.label} positions (${group.tickers.join(', ')}), which represent ${group.percent.toFixed(1)}% of invested money. Compare with my other mapped exposures and explain diversification tradeoffs. Do not invent sectors for unclassified positions, ETF look-through percentages, or guaranteed protection.`)} className="mt-3 text-xs font-semibold text-emerald-300 hover:text-emerald-100 disabled:opacity-50">Ask Copilot about this exposure →</button>
          </article>)}
        </div>
        <Explanation label="How these groups are calculated">Percentages use the amounts entered for your actual tickers, not their risk proxies. Known companies and sector-specific funds have curated sector labels. Mixed funds such as SPY and QQQM are not assigned entirely to technology or another sector. Their underlying sector weights and overlap need fund holdings data. Unknown tickers stay unclassified. This breakdown does not measure all underlying sector exposure. Labels checked October 8, 2026. <a href="https://www.ssga.com/us/en/intermediary/capabilities/equities/sector-investing/sector-and-industry-etfs" target="_blank" rel="noreferrer" className="text-sky-300 underline">Sector reference</a></Explanation>
      </section>
    </div>
  );
};
