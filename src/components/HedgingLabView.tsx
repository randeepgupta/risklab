import {Explanation} from './Explanation';
import React, { useState } from 'react';
import {ShieldCheck, Layers, PieChart, Wallet, RefreshCw, Bot, User, Send, ChevronDown} from 'lucide-react';
import {PortfolioPosition, PortfolioRiskMetrics, AiCopilotMessage} from '../types/risk';

const MarkdownReply = React.lazy(() => import('./MarkdownReply').then(module => ({default: module.MarkdownReply})));

const RISK_CATEGORIES = [
  {title: 'Spread your investments', icon: Layers, summary: 'Reduce reliance on one company, sector, or market.',
    how: 'Diversification spreads exposure across investments that do not all move together. Check fund holdings too: several ETFs may own the same companies.',
    tradeoff: 'Diversification cannot prevent losses when markets fall broadly.',
    question: 'Explain diversification and overlapping holdings in my portfolio. Distinguish what the available data shows from what needs fund holdings data.',
    source: 'https://www.investor.gov/introduction-investing/getting-started/asset-allocation'},
  {title: 'Limit concentration', icon: PieChart, summary: 'Keep one position from dominating your risk.',
    how: 'Review both allocation and risk contribution. A small allocation to a volatile holding can contribute a large share of portfolio risk.',
    tradeoff: 'Reducing exposure may limit gains; selling may incur taxes. New contributions can also change the mix without selling.',
    question: 'Which holdings contribute the most modeled risk relative to their allocation? Explain the concentration tradeoffs without recommending trades.',
    source: 'https://syndication.finra.org/content/concentrate-concentration-risk-0'},
  {title: 'Balance asset types', icon: ShieldCheck, summary: 'Explore a mix of stocks, bonds, and cash.',
    how: 'An allocation across different asset types can change the portfolio’s exposure to market movements. The suitable mix depends on goals, time horizon, and risk tolerance.',
    tradeoff: 'Bonds can lose value from interest-rate or credit changes. Stocks and bonds can fall together; lower-risk assets may offer less growth.',
    question: 'Explain the risk tradeoffs of stocks, bonds, and cash for a portfolio like mine. Do not assume any allocation guarantees protection.',
    source: 'https://www.investor.gov/additional-resources/general-resources/publications-research/info-sheets/beginners-guide-asset'},
  {title: 'Keep a cash buffer', icon: Wallet, summary: 'Separate near-term spending from market risk.',
    how: 'Money reserved for near-term expenses can reduce the need to sell investments during a downturn. Cash protects liquidity; it does not offset losses in other holdings.',
    tradeoff: 'Inflation can erode purchasing power, and cash may miss market gains. Cash products differ in liquidity and protection.',
    question: 'Explain how a cash buffer can reduce forced selling, and its inflation and opportunity-cost tradeoffs. Do not prescribe a cash percentage.',
    source: 'https://www.investor.gov/additional-resources/general-resources/publications-research/info-sheets/beginners-guide-asset'},
  {title: 'Rebalance over time', icon: RefreshCw, summary: 'Bring a drifting portfolio back to your chosen mix.',
    how: 'Compare current allocations with your intended targets. Rebalancing can use new contributions or changes to existing holdings.',
    tradeoff: 'Selling may trigger taxes and trading costs. Rebalancing manages exposure; it does not guarantee higher returns.',
    question: 'Explain how rebalancing manages risk and how new contributions can help. I have not supplied target allocations, so do not invent them.',
    source: 'https://www.investor.gov/introduction-investing/getting-started/asset-allocation'},
];

interface HedgingLabViewProps {
  positions: PortfolioPosition[];
  metrics: PortfolioRiskMetrics;
}

export const HedgingLabView: React.FC<HedgingLabViewProps> = ({
  positions,
  metrics,
}) => {
  const [copilotOpen, setCopilotOpen] = useState(false);

  // AI Copilot Chat state
  const [messages, setMessages] = useState<AiCopilotMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      timestamp: 'Just now',
      text: 'Ask about your portfolio’s risk or the tradeoffs behind these categories. I explain the model; I do not execute trades or guarantee protection.',
    },
  ]);

  const [inputQuery, setInputQuery] = useState<string>('');
  const [isLoadingCopilot, setIsLoadingCopilot] = useState<boolean>(false);

  const handleSendMessage = async (queryText?: string) => {
    const text = queryText || inputQuery;
    if (!text.trim() || isLoadingCopilot) return;

    const userMsg: AiCopilotMessage = {
      id: 'user_' + Date.now(),
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text,
    };

    setCopilotOpen(true);
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

The AI explanation service is not available right now. RiskLab will not invent a portfolio-specific answer. You can still use the deterministic risk metrics, stress scenarios, and the educational risk-management categories on this page.`,
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsLoadingCopilot(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Manage risk</p>
        <h2 className="mt-1 text-2xl font-bold text-white">How could I reduce my risk?</h2>
        <p className="mt-2 text-sm text-slate-400">Explore the approaches and their tradeoffs.</p>
        <Explanation label="Risk reduction and hedging">These categories manage exposure, concentration, and liquidity. A direct hedge uses an offsetting position to address a particular risk. None of these approaches guarantees a portfolio value or prevents every loss.</Explanation>
      </section>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {RISK_CATEGORIES.map(category => <article key={category.title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2"><category.icon className="h-5 w-5 text-emerald-400" /><h3 className="text-base font-bold text-white">{category.title}</h3></div>
          <p className="mt-2 text-sm text-slate-400">{category.summary}</p>
          <Explanation label="How it helps and tradeoffs">
            <p><strong className="text-slate-200">How it helps:</strong> {category.how}</p>
            <p className="mt-2"><strong className="text-slate-200">Tradeoff:</strong> {category.tradeoff}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <a href={category.source} target="_blank" rel="noreferrer" className="text-sky-300 underline">Learn more</a>
              <button type="button" disabled={isLoadingCopilot} onClick={() => handleSendMessage(category.question)} className="rounded-md border border-emerald-500/30 px-3 py-2 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50">Ask about my portfolio</button>
            </div>
          </Explanation>
        </article>)}
      </div>

      <details open={copilotOpen} onToggle={event => setCopilotOpen(event.currentTarget.open)} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-white"><ChevronDown className="h-4 w-4" />Ask RiskLab Copilot</summary>
      <div className="mt-4 flex flex-col h-[520px]">
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
                Ask about portfolio risk and tradeoffs.
              </p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono-nums border border-emerald-500/20">
            AI responses show their source
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
            onClick={() => handleSendMessage('If technology stocks fall 40%, how much could I lose?')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
          >
            &ldquo;If tech falls 40%, how much could I lose?&rdquo;
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage("What are the tradeoffs of reducing concentration in my portfolio?")}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
          >
            &ldquo;How can I manage concentration?&rdquo;
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage('Which holding contributes the most modeled risk, and why?')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
          >
            &ldquo;What drives my portfolio risk?&rdquo;
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
      </details>
    </div>
  );
};
