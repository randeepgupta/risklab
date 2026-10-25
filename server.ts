import {parseExplicitScenario, ScenarioInputError} from './api/scenario-parser';
import {copilotUnavailable} from './api/workers-ai';
import {buildSectorExposure} from './src/utils/sectorExposure';
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

// Accept explicit measurable moves. Qualitative narratives require clarification;
// scenario construction never asks an AI model to invent a market return.
app.post('/api/gemini/parse-scenario', async (req, res) => {
  const {prompt, portfolio} = req.body ?? {};
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 2000) {
    return res.status(400).json({error: 'Enter a scenario between 1 and 2,000 characters.'});
  }
  try {
    return res.json(parseExplicitScenario(prompt, portfolio));
  } catch (error) {
    if (error instanceof ScenarioInputError) return res.status(422).json({code: error.code, error: error.message});
    console.error('Explicit scenario parsing failed.');
    return res.status(500).json({error: 'Scenario service unavailable. Please retry.'});
  }
});

// AI Risk Copilot conversational endpoint
app.post('/api/gemini/ask-copilot', async (req, res) => {
  try {
    const { question, portfolio, riskMetrics, currentScenario, mode } = req.body;
    if (typeof question !== 'string' || !question.trim() || question.length > 2000) {
      return res.status(400).json({ error: 'Enter a question between 1 and 2,000 characters.' });
    }

    if (mode !== undefined && mode !== 'ai' && mode !== 'rule_based') {
      return res.status(400).json({error: 'Invalid Copilot mode.'});
    }
    const ai = mode === 'rule_based' ? null : getGeminiClient();
    if (!ai && mode !== 'rule_based') return res.status(503).json(copilotUnavailable());
    if (mode === 'rule_based') {
      // A deterministic summary is produced only when explicitly requested.
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
        ? riskMetrics.riskContributions.filter((item: any) => item && typeof item.ticker === 'string')
            .sort((a: any, b: any) => Math.abs(b.percentRiskContribution || 0) - Math.abs(a.percentRiskContribution || 0))
            .slice(0, 2)
            .map((item: any) => `${item.ticker} (${((item.percentRiskContribution || 0) * 100).toFixed(1)}% of modeled volatility risk)`)
            .join(', ')
        : '';

      return res.json({
        ai: {provider: 'fallback', reason: 'requested', label: 'Rule-based summary'},
        answer: `### RiskLab Quantitative Copilot

Based on your active **${totalVal}** portfolio:

- **Portfolio Volatility:** **${vol}** annualized.${topRisk ? ` Largest modeled risk contributors: **${topRisk}**.` : ''}
- **1-Day 95% Parametric VaR:** **${var1d}** under the current normal-return assumptions. Losses can exceed VaR in tail events.

#### Exposure note:
The position groups below do not unpack sectors inside mixed ETFs. Unknown tickers remain unclassified. Use **What If** to calculate a scenario; this fallback does not invent sector-specific recommendations.`,
      });
    }

    const context = `
Current Portfolio:
- Total Value: $${riskMetrics?.totalValue?.toLocaleString()}
- Annualized Volatility: ${(riskMetrics?.annualizedVolatility * 100)?.toFixed(1)}%
- 1-Day 95% VaR: $${Math.round(riskMetrics?.var95_1d || 0)?.toLocaleString()}
- 1-Year 95% VaR: $${Math.round(riskMetrics?.var95_1y || 0)?.toLocaleString()}
- Holdings: ${JSON.stringify(portfolio)}
- Position-level sector and asset groups (not ETF look-through): ${JSON.stringify(buildSectorExposure(Array.isArray(portfolio) ? portfolio.filter((p: any) => p && typeof p.ticker === "string" && typeof p.investment === "number").slice(0, 30) : []))}
- Active Stress Scenario: ${JSON.stringify(currentScenario || 'None')}
`;

    const systemInstruction = `You are RiskLab's portfolio risk copilot for regular investors. Explain the user's actual sector exposures and concentration in plain language. Use supplied position-level sector groups rather than generic categories. Mixed-sector funds must not be assigned wholly to one sector; exact underlying sector weights and ETF overlaps require holdings data that is not supplied. Unclassified tickers remain unknown; a risk proxy does not establish an actual sector. Never claim another sector is a guaranteed hedge. Do not invent precise risk reduction from a proposed allocation change. Give short structured answers and explain tradeoffs.
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

    if (!response.text?.trim()) throw new Error('AI returned an empty answer');
    return res.json({answer: response.text.slice(0, 12000),
      ai: {provider: 'gemini', model: 'gemini-3.8-flash', label: 'Gemini · Google AI'}});
  } catch (error: any) {
    const unavailable = copilotUnavailable(error);
    console.error('Copilot AI request failed:', unavailable.reason);
    return res.status(503).json(unavailable);
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
