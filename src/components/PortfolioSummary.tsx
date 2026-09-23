import React from 'react';
import { AlertTriangle, ArrowRight, Layers3, ShieldCheck, TrendingDown } from 'lucide-react';
import { PortfolioPosition, PortfolioRiskMetrics } from '../types/risk';

interface PortfolioSummaryProps {
  metrics: PortfolioRiskMetrics;
  positions: PortfolioPosition[];
  onOpenStress: () => void;
  onOpenFuture: () => void;
}

function riskLabel(volatility: number) {
  if (volatility >= 0.30) return { label: 'Very high', tone: 'text-rose-300', bg: 'bg-rose-500/10 border-rose-500/20' };
  if (volatility >= 0.22) return { label: 'High', tone: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/20' };
  if (volatility >= 0.14) return { label: 'Moderate', tone: 'text-sky-300', bg: 'bg-sky-500/10 border-sky-500/20' };
  return { label: 'Lower', tone: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' };
}

function diversificationLabel(benefitPct: number) {
  if (benefitPct >= 20) return { label: 'Strong', detail: 'Your holdings offset each other meaningfully in the model.' };
  if (benefitPct >= 10) return { label: 'Moderate', detail: 'You have some diversification, but several holdings still move together.' };
  return { label: 'Limited', detail: 'Your holdings behave similarly enough that diversification provides limited protection.' };
}

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
  metrics,
  positions,
  onOpenStress,
  onOpenFuture,
}) => {
  const risk = riskLabel(metrics.annualizedVolatility);
  const diversification = diversificationLabel(metrics.diversificationBenefitPct);
  const topRisk = [...metrics.riskContributions].sort(
    (a, b) => b.percentRiskContribution - a.percentRiskContribution,
  )[0];
  const topPosition = positions.find((position) => position.ticker === topRisk?.ticker);
  const badDayLoss = metrics.var99_1d;
  const badDayPct = metrics.var99_1d_pct * 100;

  return (
    <section className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Portfolio overview</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-white">
            What should you know about this portfolio?
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400 leading-relaxed">
            RiskLab translates the model into plain English first. You can open the technical metrics when you want the math behind the answer.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenStress}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/15"
          >
            What if markets fall? <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onOpenFuture}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15"
          >
            Explore the future <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <article className={`rounded-xl border p-5 ${risk.bg}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Overall risk level</span>
            <AlertTriangle className={`w-4 h-4 ${risk.tone}`} />
          </div>
          <div className={`mt-3 text-3xl font-black ${risk.tone}`}>{risk.label}</div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Based on modeled portfolio volatility of {(metrics.annualizedVolatility * 100).toFixed(1)}%. Higher means a bumpier ride, not necessarily a worse investment.
          </p>
        </article>

        <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Biggest risk driver</span>
            <TrendingDown className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 text-3xl font-black text-white font-mono-nums">{topRisk?.ticker ?? '—'}</div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            {topRisk ? (
              <>
                {topPosition?.name ?? topRisk.ticker} is {((topRisk.weight || 0) * 100).toFixed(1)}% of your money but contributes about {(topRisk.percentRiskContribution * 100).toFixed(1)}% of modeled portfolio risk.
              </>
            ) : 'Add holdings to see what drives portfolio risk.'}
          </p>
        </article>

        <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Diversification</span>
            <Layers3 className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-3 text-3xl font-black text-white">{diversification.label}</div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            {diversification.detail} The model estimates a {metrics.diversificationBenefitPct.toFixed(1)}% reduction in volatility versus holding the assets independently.
          </p>
        </article>

        <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Very bad day estimate</span>
            <ShieldCheck className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3 text-3xl font-black text-rose-300 font-mono-nums">
            -${Math.round(badDayLoss).toLocaleString()}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Under the current normal-return model, only about 1% of trading days would be expected to lose more than roughly {badDayPct.toFixed(1)}%. This is a model estimate, not a guarantee.
          </p>
        </article>
      </div>
    </section>
  );
};
