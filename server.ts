import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function safeText(value: unknown, fallback: string, maxLength: number = 800): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return (trimmed || fallback).slice(0, maxLength);
}

function sanitizeScenarioPayload(payload: any) {
  const factor = payload?.factorShocks ?? {};
  const sanitizedImpacts: Record<string, { shockPct: number; reason: string }> = {};

  if (payload?.assetSpecificImpacts && typeof payload.assetSpecificImpacts === 'object') {
    for (const [rawTicker, rawImpact] of Object.entries(payload.assetSpecificImpacts)) {
      const ticker = String(rawTicker).trim().toUpperCase();
      if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker)) continue;
      const impact = rawImpact as any;
      sanitizedImpacts[ticker] = {
        shockPct: clampNumber(impact?.shockPct, -0.99, 0.99, 0),
        reason: safeText(impact?.reason, 'Model-estimated scenario impact.', 240),
      };
    }
  }

  const vulnerabilities = Array.isArray(payload?.vulnerabilities)
    ? payload.vulnerabilities
        .slice(0, 6)
        .map((item: unknown) => safeText(item, '', 240))
        .filter(Boolean)
    : [];

  return {
    scenarioName: safeText(payload?.scenarioName, 'Custom Stress Scenario', 80),
    factorShocks: {
      equityShockPct: clampNumber(factor.equityShockPct, -80, 50, -18),
      rateChangeBps: clampNumber(factor.rateChangeBps, -1000, 1000, 0),
      vixSpikePct: clampNumber(factor.vixSpikePct, 0, 500, 60),
      semiShockPct: clampNumber(factor.semiShockPct, -95, 100, -30),
      techShockPct: clampNumber(factor.techShockPct, -90, 100, -25),
    },
    macroTransmissionExplanation: safeText(
      payload?.macroTransmissionExplanation,
      'Scenario translated into bounded factor shocks for deterministic stress testing.',
      1200
    ),
    assetSpecificImpacts: sanitizedImpacts,
    vulnerabilities,
    suggestedHedgeAction: safeText(
      payload?.suggestedHedgeAction,
      'Consider an illustrative hedge and validate any real trade with live option pricing, beta/delta sizing, and basis-risk analysis.',
      500
    ),
  };
}

// Initialize Gemini client lazily
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return aiClient;
}

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Parse natural language "What-If" scenario into quantitative market factors
app.post('/api/gemini/parse-scenario', async (req, res) => {
  try {
    const { prompt, portfolio } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Fallback deterministic rule-based parsing if no API key is present
      const lower = prompt.toLowerCase();
      let eqShock = -18;
      let rateBps = -150;
      let vixSpike = 60;
      let semiShock = -45;
      let techShock = -30;

      if (lower.includes('bubble') || lower.includes('ai') || lower.includes('semi')) {
        semiShock = -45;
        techShock = -32;
        eqShock = -18;
      }
      if (lower.includes('rate') || lower.includes('cut') || lower.includes('fed')) {
        rateBps = lower.includes('hike') ? 150 : -150;
      }
      if (lower.includes('crash') || lower.includes('panic') || lower.includes('2008')) {
        eqShock = -35;
        vixSpike = 120;
      }

      const fallbackImpactCandidates: Record<string, { shockPct: number; reason: string }> = {
        NVDA: { shockPct: semiShock / 100, reason: 'Rule-based semiconductor factor mapping' },
        QQQM: { shockPct: techShock / 100, reason: 'Rule-based technology factor mapping' },
        SPY: { shockPct: eqShock / 100, reason: 'Rule-based broad equity factor mapping' },
        TSLA: { shockPct: Math.min(-0.1, techShock / 100), reason: 'Rule-based high-beta growth mapping' },
      };
      const activeTickers = Array.isArray(portfolio)
        ? new Set(portfolio.map((p: any) => String(p?.ticker || '').toUpperCase()).filter(Boolean))
        : null;
      const fallbackImpacts = Object.fromEntries(
        Object.entries(fallbackImpactCandidates).filter(([ticker]) => !activeTickers || activeTickers.has(ticker))
      );

      return res.json({
        scenarioName: prompt.slice(0, 60),
        factorShocks: {
          equityShockPct: eqShock,
          rateChangeBps: rateBps,
          vixSpikePct: vixSpike,
          semiShockPct: semiShock,
          techShockPct: techShock,
        },
        macroTransmissionExplanation: `Rule-based fallback mapped the narrative to broad equity (${eqShock}%), technology (${techShock}%), semiconductor (${semiShock}%), rates (${rateBps} bps), and volatility (+${vixSpike}%) scenario inputs. These are bounded heuristics, not market forecasts.`,
        assetSpecificImpacts: fallbackImpacts,
        vulnerabilities: [
          'High-beta and sector-concentrated holdings may experience larger losses than the broad equity shock.',
          'Diversification can weaken during broad risk-off periods even when normal-period correlations are lower.',
        ],
        suggestedHedgeAction: 'Illustratively compare a protective put, 95/85 put spread, or collar. Any executable hedge should be sized to a tradable proxy using live option prices and portfolio beta/delta.',
      });
    }

    const portfolioSummary = Array.isArray(portfolio)
      ? portfolio.map((p: any) => `${p.ticker}: $${p.investment?.toLocaleString()} (${(p.weight * 100).toFixed(1)}%)`).join(', ')
      : 'SPY $100K, QQQM $70K, NVDA $50K, TSLA $30K';

    const systemInstruction = `You are an elite quantitative portfolio risk strategist at RiskLab.
A user will provide a narrative "what if" macroeconomic or market stress scenario (e.g. "AI bubble bursts and Fed cuts rates 150 bps", or "Geopolitical shock spikes crude oil to $130 and causes stagflation").
Translate this qualitative narrative into estimated quantitative factor shocks and asset price drawdowns.
The user's active portfolio holdings are: ${portfolioSummary}.

You MUST respond with valid JSON matching the following structure:
{
  "scenarioName": "Concise 3-6 word title for the scenario",
  "factorShocks": {
    "equityShockPct": number (e.g. -20 for 20% drop),
    "rateChangeBps": number (e.g. -150 for 150 bps cut, or +100 for 100 bps hike),
    "vixSpikePct": number (e.g. 75 for 75% spike in VIX),
    "semiShockPct": number (e.g. -45 for 45% drop in semiconductor equities),
    "techShockPct": number (e.g. -30 for 30% drop in broad tech)
  },
  "macroTransmissionExplanation": "A 2-3 sentence rigorous explanation of how this shock cascades through the financial system.",
  "assetSpecificImpacts": {
    "TICKER": { "shockPct": number between -0.99 and +0.99, "reason": "1-sentence driver" }
  },
  "vulnerabilities": ["Specific vulnerability 1", "Specific vulnerability 2"],
  "suggestedHedgeAction": "1-2 sentence recommendation on optimal options hedging strategy (protective put, put spread, or collar)."
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Scenario: "${prompt}"\nPortfolio: ${portfolioSummary}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    return res.json(sanitizeScenarioPayload(parsed));
  } catch (error: any) {
    console.error('Error in parse-scenario:', error);
    return res.status(500).json({ error: error.message || 'Failed to parse scenario' });
  }
});

// AI Risk Copilot conversational endpoint
app.post('/api/gemini/ask-copilot', async (req, res) => {
  try {
    const { question, portfolio, riskMetrics, currentScenario } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Deterministic portfolio-specific response if Gemini is not configured.
      const totalVal = Number.isFinite(riskMetrics?.totalValue)
        ? `$${Math.round(riskMetrics.totalValue).toLocaleString()}`
        : 'Unavailable';
      const vol = Number.isFinite(riskMetrics?.annualizedVolatility)
        ? `${(riskMetrics.annualizedVolatility * 100).toFixed(1)}%`
        : 'Unavailable';
      const var1d = Number.isFinite(riskMetrics?.var95_1d)
        ? `$${Math.round(riskMetrics.var95_1d).toLocaleString()}`
        : 'Unavailable';
      const topRisk = Array.isArray(riskMetrics?.riskContributions)
        ? [...riskMetrics.riskContributions]
            .sort((a: any, b: any) => Math.abs(b.percentRiskContribution || 0) - Math.abs(a.percentRiskContribution || 0))
            .slice(0, 2)
            .map((item: any) => `${item.ticker} (${((item.percentRiskContribution || 0) * 100).toFixed(1)}% of modeled volatility risk)`)
            .join(', ')
        : '';

      return res.json({
        answer: `### RiskLab Quantitative Copilot

Based on your active **${totalVal}** portfolio:

- **Portfolio Volatility:** **${vol}** annualized.${topRisk ? ` Largest modeled risk contributors: **${topRisk}**.` : ''}
- **1-Day 95% Parametric VaR:** **${var1d}** under the current normal-return assumptions. Losses can exceed VaR in tail events.

#### Hedge Modeling Note:
RiskLab's hedge cards are **illustrative portfolio-level economics**, not executable trade tickets. A real implementation needs a tradable index/ETF proxy, portfolio beta, option delta, live implied volatility, contract multiplier, and basis-risk analysis.`,
      });
    }

    const context = `
Current Portfolio:
- Total Value: $${riskMetrics?.totalValue?.toLocaleString()}
- Annualized Volatility: ${(riskMetrics?.annualizedVolatility * 100)?.toFixed(1)}%
- 1-Day 95% VaR: $${Math.round(riskMetrics?.var95_1d || 0)?.toLocaleString()}
- 1-Year 95% VaR: $${Math.round(riskMetrics?.var95_1y || 0)?.toLocaleString()}
- Holdings: ${JSON.stringify(portfolio)}
- Active Stress Scenario: ${JSON.stringify(currentScenario || 'None')}
`;

    const systemInstruction = `You are RiskLab's institutional Financial Engineering & Risk Copilot.
You advise portfolio managers and individual investors on portfolio risk, Value at Risk (VaR), Conditional VaR (CVaR), factor exposures, Monte Carlo forecasts, Black-Scholes option pricing, and hedging strategies (protective puts, put spreads, collars).
Always respond with clarity, quantitative precision, and structured markdown. Use bolding and concise bullet points.
Explain trade-offs: Hedge Cost vs Downside Protection vs Opportunity Cost.
Treat hedge outputs as illustrative unless live option-chain data and a tradable proxy are provided. Do not describe a fixed-strike collar as "zero-cost" unless the put and call premiums actually offset, and do not claim a guaranteed portfolio floor when basis risk exists.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Context:\n${context}\n\nUser Question:\n"${question}"`,
      config: {
        systemInstruction,
      },
    });

    return res.json({
      answer: response.text || 'Unable to generate analysis at this time.',
    });
  } catch (error: any) {
    console.error('Error in ask-copilot:', error);
    return res.status(500).json({ error: error.message || 'Failed to query Risk Copilot' });
  }
});

// Vite middleware setup
async function startServer() {
  const server = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server },
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist', 'client');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`RiskLab server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
