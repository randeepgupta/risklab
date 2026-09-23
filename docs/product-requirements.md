# RiskLab Product Requirements — Investor-Friendly MVP

## Product vision

RiskLab helps informed individual investors understand portfolio risk without requiring them to know quantitative-finance terminology.

**Product principle:** quantitative models should power the answers, not become the interface.

## Target user

An informed retail investor who understands stocks, ETFs, diversification, and long-term investing, but does not have institutional risk tools or formal quantitative-finance training.

## Jobs to be done

A user should be able to answer four questions quickly:

1. **How risky is my portfolio?**
2. **What is driving that risk?**
3. **What happens if markets change sharply?**
4. **What could this portfolio become over time?**

## MVP navigation

### Overview
Answers: *How am I positioned?*

- plain-English overall risk level
- biggest risk driver
- diversification quality
- modeled very-bad-day loss estimate
- holdings and allocations
- "what drives my risk" visualization
- "which investments move together" visualization
- advanced risk metrics available on demand

### What If?
Answers: *What could hurt me?*

- natural-language market scenario input
- quick preset scenarios
- estimated portfolio impact
- largest loss driver
- position-level loss attribution
- advanced factor and ticker shock controls hidden by default

### Future
Answers: *What could my portfolio become?*

- multiple possible market paths instead of a single return assumption
- typical, weak, loss, and doubling outcomes
- long-term horizon selection
- visual outcome range
- technical Monte Carlo assumptions hidden behind an explanation control

### Advanced
Optional technical lab for users who intentionally want deeper tools.

- illustrative hedging strategies
- options-model outputs
- AI copilot

This section is not part of the core MVP path.

## UX rules

1. **Answer first, explanation second, technical detail third.**
2. Every quantitative output must answer a plain-English investing question.
3. Technical names such as VaR, CVaR, Euler decomposition, covariance, and GBM should not be required to understand the result.
4. Technical methodology remains accessible for transparency and recruiter/advanced-user inspection.
5. Model estimates must be clearly distinguished from forecasts or guarantees.

## Plain-English terminology map

| Technical term | Default user-facing language |
| --- | --- |
| Portfolio volatility | How bumpy is the ride? / overall risk level |
| Euler risk decomposition | What is driving my risk? |
| Correlation matrix | Which investments move together? |
| Monte Carlo simulation | What could my portfolio become? |
| Value at Risk | Very bad day estimate |
| Expected Shortfall / CVaR | If things get worse than the threshold, how bad might they be? |
| Stress test | What if markets change? |
| Duration | How sensitive are bonds to rates? |
| Hedging | Can I reduce my downside? |

## Non-goals for MVP

- trade recommendations
- automated rebalancing
- brokerage connectivity
- tax optimization
- live option execution
- predictive market timing
- hiding model limitations

## Success criteria

A first-time user with basic investing knowledge should be able to use RiskLab without searching for definitions of quantitative terms and should be able to explain, in their own words:

- whether their portfolio is relatively risky
- which holding drives the most risk
- whether their holdings tend to move together
- what one adverse scenario could do to the portfolio
- what a range of long-term simulated outcomes means
