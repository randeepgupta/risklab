# Scenario slider repair (v0.2.0)

## Problem

`StressTestingView` stored the selected scenario, individual ticker shocks, and five
market values separately. Every slider change also replaced `activeScenario`.
An effect depending on that object immediately copied the original values back
into the inputs. Sliders appeared stuck or snapped back.

Even without that reset, copying a preset's fixed ticker shocks into a factor
scenario kept overriding the market controls. A third issue was a volatility
slider for a value the deterministic price-impact engine intentionally does not
use.

## Behavior after the repair

- One reducer owns the editable scenario. No effect copies presets over user edits.
- Selecting or resetting a template restores that exact scenario.
- The first market edit switches from fixed preset holding changes to modeled
  factor impacts. This behavior is stated next to the controls.
- A direct holding edit is an explicit, labeled **Manual** override. It affects
  only that holding and survives subsequent market edits until reset.
- **Reset** beside a holding returns it to its applicable preset/model estimate.
- **Use market assumptions for all** clears fixed/manual overrides.
- Holding sliders show the impact actually passed through the existing engine,
  not an unrelated zero or a stale preset value.
- An all-manual message explains why market sliders cannot move the result until
  at least one holding override is reset.
- The volatility spike remains read-only context. It is not invented as another
  independent source of price losses.
- Signed outputs now distinguish a loss, a gain, and no change. Attribution bars
  divide by gross losses, so offsets cannot generate shares above 100%.
- Native ranges have associated labels, keyboard support, visible focus, scoped
  track/thumb styling, and a single-column layout on narrow screens.

The financial engine and its model assumptions are unchanged. This repair does
not add market data, change expected returns, or constitute a new risk model.

## Files

- `src/components/StressTestingView.tsx`
- `src/utils/scenarioControls.ts` (new)
- `src/index.css`
- `tests/scenarioControls.test.ts` (new)
- `tests/quantEngine.test.ts` (imports the new regression checks)
- `docs/scenario-slider-fix.md` (this note)

There are no new npm dependencies.

## Validation performed

1. Strict TypeScript compilation of the quantitative engine, reducer, and tests.
2. All 22 new reducer/real-engine regression cases passed, along with the existing
   quantitative correctness suite.
3. Syntax-transpilation checks for all 20 non-declaration TS/TSX files under
   `src` and `tests` passed.
4. An isolated Chromium component harness reproduced both original slider resets
   and passed 12 repaired-component checks: keyboard input, pointer dragging,
   persistence after parent rerenders, all four market controls, explicit holding
   overrides, single/all resets, zero/gain labels, mocked generated scenarios,
   narrow-screen overflow, and absence of JavaScript page errors.
5. The patch was dry-run/applied to clean source and checked for complete new-file
   inclusion and relative import resolution.

### Scope of browser verification

The isolated harness rendered the actual TSX component and quantitative engine
using locally available React 18.2 and Tailwind 4.1.10. Icons were stubbed and the
scenario API was mocked; no user data or AI requests were sent externally. This
checks the component's interactions, not the entire React 19 / Vite / Express app
or the live Gemini service. A full dependency install/production build could not
be completed because the package registry was unreachable in this environment.

Run the complete project checks locally with your installed dependencies:

```bash
npm run check
npm run build
```

Then run `npm run dev` and verify:

1. Choose **Broad market crash** and open **Advanced scenario controls**.
2. Move **Stock market**; the value persists and the portfolio result changes.
3. Set NVDA to -50%; it is labeled **Manual** and stays fixed while other market
   assumptions change.
4. Reset NVDA, then reset the scenario; the expected model and preset values return.

No additional Node upgrade or dependency reinstall is required for this patch.

## Implementation reference

React's guidance on avoiding redundant state and effect-driven state resets:

- https://react.dev/learn/choosing-the-state-structure
- https://react.dev/learn/you-might-not-need-an-effect
