import React from 'react';
import type {SavedPortfolio} from '../types/workspace';
import {Activity, ArrowRight, BarChart3, MessageCircle, ShieldAlert, TrendingUp} from 'lucide-react';

interface WelcomePageProps {
  onEnterLab: () => void;
  onUseSample: () => void;
  hasPortfolio: boolean;
  isSampleLoading: boolean;
  error?: string;
  onOpenSaved?: () => void;
  savedPortfolios?: SavedPortfolio[];
  onResumeSaved?: (portfolio:SavedPortfolio) => void;
}

export function WelcomePage({onEnterLab, onUseSample, hasPortfolio, isSampleLoading, error,onOpenSaved,savedPortfolios=[],onResumeSaved}: WelcomePageProps) {
  return <div className="min-h-screen bg-[#0b0f19] text-slate-200 selection:bg-emerald-500/30">
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
      <span className="flex items-center gap-2.5 font-extrabold text-white"><Activity className="h-6 w-6 text-emerald-400" />RiskLab</span>
      <nav aria-label="Welcome navigation" className="flex items-center gap-5 text-sm">
        {onOpenSaved&&<button onClick={onOpenSaved} className="text-slate-300 hover:text-white">Saved portfolios</button>}
        <a href="#why-risklab" className="hidden text-slate-400 hover:text-white sm:block">Why I built it</a>
        <button onClick={onEnterLab} disabled={isSampleLoading} className="flex items-center gap-2 text-emerald-300 hover:text-emerald-200 disabled:opacity-50">Enter the Lab <ArrowRight className="h-4 w-4" /></button>
      </nav>
    </header>

    <main className="mx-auto max-w-6xl px-5 sm:px-8">
      <section className="grid items-center gap-12 pb-16 pt-12 sm:pt-20 lg:grid-cols-[1.4fr_1fr] lg:pb-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">A little more clarity. Before the uncertainty.</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.1] tracking-tight text-white sm:text-6xl">Understand your portfolio <span className="text-emerald-300">before the market tests it.</span></h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">See what drives your risk, explore market scenarios, and compare possible long-term outcomes. Bring your holdings and your questions.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={onEnterLab} disabled={isSampleLoading} className="flex items-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-50">{hasPortfolio ? 'Return to the Lab' : 'Enter the Lab'}<ArrowRight className="h-4 w-4" /></button>
            <button onClick={onUseSample} disabled={isSampleLoading} className="rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:bg-slate-900 disabled:opacity-50">{isSampleLoading ? 'Opening sample…' : 'Try a sample portfolio'}</button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Start with a sample, or enter your own tickers and allocations.</p>
          {!!savedPortfolios.length&&<div className="mt-5 rounded-xl border border-slate-700/70 bg-slate-900/60 p-4"><p className="text-xs font-semibold text-slate-300">Continue a saved portfolio</p><div className="mt-3 flex flex-wrap gap-2">{[...savedPortfolios].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,3).map(portfolio=><button key={portfolio.id} disabled={isSampleLoading} onClick={()=>onResumeSaved?.(portfolio)} className="rounded-lg border border-emerald-500/25 px-3 py-2 text-sm font-semibold text-emerald-300 disabled:opacity-50">Resume {portfolio.name}</button>)}</div><p className="mt-2 text-xs text-slate-500">Saved on this device. Reopening recalculates results from the current model data.</p></div>}
          {error && <p role="alert" className="mt-3 text-sm text-amber-300">{error} You can enter the Lab to retry loading the historical data.</p>}
        </div>
        <div className="relative rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-slate-900/60 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-widest text-slate-500">Inside the Lab</p>
          <p className="mt-5 text-2xl font-bold leading-snug text-white">Better questions.<br />A clearer view of risk.</p>
          <div className="mt-7 space-y-5">
            {['What’s driving my portfolio’s risk?', 'What if technology stocks fall 30%?', 'What could my portfolio become?'].map((question, i) => <div key={question} className="flex items-start gap-3 border-t border-slate-800 pt-4"><span className="font-mono text-xs text-emerald-500">0{i+1}</span><p className="text-sm leading-relaxed text-slate-300">{question}</p></div>)}
          </div>
          <div className="mt-6 flex items-start gap-3 rounded-lg bg-slate-950/60 p-4 text-xs leading-relaxed text-slate-400"><MessageCircle className="h-4 w-4 shrink-0 text-emerald-400" /><p>Copilot is there when you want help understanding your portfolio.</p></div>
        </div>
      </section>

      <section aria-labelledby="explore-heading" className="border-t border-slate-800 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Explore in the Lab</p>
        <h2 id="explore-heading" className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">Three ways to understand your portfolio.</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            {icon: BarChart3, title: 'Understand your risk', view: 'Overview', text: 'See your biggest risk drivers and how your investments move together.'},
            {icon: ShieldAlert, title: 'Ask “What if?”', view: 'What If?', text: 'Describe a market change and see its estimated impact, with an explanation of why.'},
            {icon: TrendingUp, title: 'Explore the future', view: 'Future', text: 'Compare a range of possible outcomes and explore the assumptions behind them.'},
          ].map(({icon: Icon, title, view, text}) => <article key={view} className="rounded-xl border border-slate-800 bg-slate-900/30 p-6"><Icon className="h-5 w-5 text-emerald-400" /><p className="mt-5 text-xs text-slate-500">{view}</p><h3 className="mt-1 text-lg font-bold text-white">{title}</h3><p className="mt-3 text-sm leading-relaxed text-slate-400">{text}</p></article>)}
        </div>
      </section>

      <section id="why-risklab" className="scroll-mt-8 grid gap-6 border-t border-slate-800 py-12 sm:py-16 md:grid-cols-[1fr_2fr]">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">The idea behind RiskLab</p><h2 className="mt-3 text-2xl font-bold text-white">Why I started building it.</h2></div>
        <div className="max-w-2xl space-y-4 text-base leading-relaxed text-slate-400">
          <p>Risk tools often feel like opaque institutional systems or simple dashboards that hide the assumptions behind the numbers. I started RiskLab to make portfolio risk modeling more interactive and inspectable.</p>
          <p>I also wanted to explore a practical role for AI: helping interpret questions and explain results, while a testable quantitative engine handles the calculations. The goal is to make it easier to understand what’s driving a result—and question the assumptions behind it.</p>
          <p className="text-sm text-slate-500">A personal research and engineering project, built around curiosity and transparency.</p>
        </div>
      </section>
    </main>
    <footer className="border-t border-slate-900 px-5 py-6 text-center text-xs leading-relaxed text-slate-500">Historical data and modeled assumptions. Educational analytics only—not investment advice or a prediction.</footer>
  </div>;
}
