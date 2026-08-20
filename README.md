# Passcode entry

Next.js + TypeScript recreation of the four passcode-entry states from the
Figma source (*Takehome Design Engineering*), combined into one live component
with keyboard interaction and motion.

`PasscodeEntry` stays purely presentational — every state is still forced
through props, so the four artboards can be compared against the design.
`PasscodeField` wraps it with the state machine.

## Run locally

Requires **Node 18.18+** (developed on 24.4). No other tooling, no environment
variables, no services.

```bash
git clone <REPO_URL>
cd passcode-entry
npm install
npm run dev
```

Then open <http://localhost:3000>.

| Script | |
| --- | --- |
| `npm run dev` | dev server on :3000 |
| `npm run build` | production build |
| `npm start` | serve the production build |
| `npm run typecheck` | `tsc --noEmit` |

### Where to look

| Route | |
| --- | --- |
| `/` | the live component — click it, type digits. The passcode is **1234**. |
| `/review` | all four states in Figma order as true 1512 × 982 artboards, with a zoom control |
| `/artboard/empty` · `filling` · `submitting` · `authenticated` | one frame on its own, chrome-free, for 1:1 comparison against a Figma export |

The field autofocuses on load. Type `1234` and it submits on the fourth digit;
type anything else to see the rejection. Enter also submits.

## Interaction

[`PasscodeField`](components/PasscodeEntry/PasscodeField.tsx) is the stateful
controller: it owns the digits, the focused cell, and the submit lifecycle, and
renders `PasscodeEntry` for the visuals. A single transparent `<input>` is laid
over the cells, so focus, tab order, and soft keyboards behave natively while
the cells stay presentational.

| Rule | Where |
| --- | --- |
| digits `0-9` only | `handleKeyDown` swallows every other printable key |
| Enter submits | `submit` action |
| the fourth digit submits on its own | `land()`, inside the same update that writes the digit |
| typing advances focus | `insert` action |
| pasting fills from the focused cell on | `handlePaste` → `insert` |
| Backspace/Delete clears the current cell | `erase` action |
| …and steps back when it is already empty | `erase` action |
| holding clears backwards continuously | falls out of the two `erase` branches under the browser's key auto-repeat |
| passcode `1234`, ~2s verify | `passcode` / `verifyDelayMs` props |

State lives in a `useReducer` rather than separate `useState` calls so that a
held Backspace — which fires keydown faster than React re-renders — always
reads the digits and the focused index from the same snapshot.

**Double submits** are structurally impossible rather than debounced. Every
action that could start one is guarded on `phase === "entry"`, and auto-submit
is evaluated inside `land()` — the same atomic update that writes the digit —
so a burst of inserts cannot each observe an incomplete code and all fire.
Verified by pasting a wrong code and firing eighteen Enter/digit/Backspace
events during the verify window: one submit, one rejection, no digit changes.

With auto-submit on, Enter is effectively unreachable — a full field never sits
idle in `entry` long enough to press it. Both paths are built, as asked; pass
`autoSubmit={false}` to make Enter the only way in.

```tsx
<PasscodeField passcode="1234" verifyDelayMs={2000} autoSubmit />
```

## Motion

Framer Motion. Every timing, spring, and magnitude lives in one exported object
in [`motion.ts`](components/PasscodeEntry/motion.ts) — components hold no
numbers of their own.

| Moment | What moves | Knob |
| --- | --- | --- |
| 1. Digit entry | the cell's content box springs from a peak scale back to rest | `DIGIT_ENTRY` |
| 2. Focus move | one shared `layoutId` element, tweened between cells | `FOCUS_MOVE` |
| 3. Error | container released from `amplitude` back to 0 on a low-damping spring, digits held, then cleared | `ERROR_SHAKE`, `ERROR_HOLD_MS` |
| 4a. Loading | each cell joins an opacity wave, offset by its index | `LOADING_PULSE` |
| 4b. Loading | the mark turns continuously while verifying | `LOADING_SPIN` |
| 5a. Success | the cells resolve out, staggered, as the success row springs in | `SUCCESS` |
| 5b. Success | the tick draws itself along its own centreline | `SUCCESS_DRAW` |

The tick is drawn with `pathLength`, which needs a **stroked** path — a fill
cannot be drawn progressively. The Figma export ships the box and the tick as
one filled compound path, so the tick half is split back out into a real
stroke in [`icons.tsx`](components/PasscodeEntry/icons.tsx). It is not a
redraw: every point on the exported outline sits 1.0 units from the centreline
`M11 17 L14 20 L21 13`, so a 2-wide round-capped stroke along it renders
identically to the fill it replaces. The box subpath is untouched.

Four of these are driven through `useAnimationControls` rather than an
`animate` prop — the digit pop, the loading wave, the mark's rotation, and the
tick. The field sits inside an `AnimatePresence` with `initial={false}`, which suppresses
a child's *first* animation, whether it is written as a target or as keyframes.
Controls are not subject to that, so they are the reliable way to start motion
on a freshly mounted child here.

### How the values were chosen

Tuned against the stated intent, not by eye. Each spring was solved
analytically for damping ratio, overshoot, and settling time, judged at a
0.15px visibility floor — "settled to 0.5% of travel" is a fifth of a pixel and
means nothing to a viewer. The chosen values were then measured back in the
browser:

| Moment | ζ | Predicted | Measured |
| --- | --- | --- | --- |
| `DIGIT_ENTRY` | 1.00 | 135ms, no overshoot | 139ms, scale never dips below 1.0 |
| `FOCUS_MOVE` | 0.90 | 194ms, 0.13px overshoot | — |
| `ERROR_SHAKE` | 0.35 | swings 10 → 3.05 → 0.93px | 10 → 2.93 → 0.93px |
| `SUCCESS` | 0.72 | 241ms, small pop | — |
| `SUCCESS_DRAW` | tween | 320ms after 80ms delay | 0 → 1 in ~320ms, decelerating |

Two relationships worth keeping in mind while adjusting:

- **Damping ratio sets shape, stiffness sets speed** (ζ = damping / 2√stiffness).
  The shake's diminishing-swings character is ζ ≈ 0.35 and nothing else — raise
  stiffness alone to make it snappier without flattening the decay.
- **ζ ≥ 1 is the only way to guarantee no overshoot.** `DIGIT_ENTRY` sits at
  1.002 deliberately; below 1 it will pop past the target however fast it is.

`ERROR_HOLD_MS` is set from the shake rather than independently: the shake rests
at ~340ms, so 600 leaves ~260ms of stillness to read the wrong digits. Much
below 500 and the cells clear while the container is still moving.

`resolveMotion()` turns the raw constants into the spec components consume.
Springs stay pure objects so they can be spread straight into a `transition`;
`amplitude` and `stagger` are lifted out because Framer would not know what to
do with them there.

### Reduced motion

Handled once, in [`MotionProvider`](components/PasscodeEntry/MotionProvider.tsx).
It reads `useReducedMotion()` and hands down an already-resolved spec in which
every transition is `{ duration: 0 }` and every magnitude has collapsed to its
resting value — scale 1, amplitude 0, no stagger. No component branches on the
media query, and no component can forget to.

`ERROR_HOLD_MS` is deliberately *not* zeroed under reduced motion: it is not a
transition, it is the beat that lets you read what you typed before it clears.
Zeroing it would remove information, not motion. One line to change if you
disagree.

### On the added magnitudes

A spring says *how* a value travels but not *how far*, so the magnitudes the
moments need (entry scale, pulse trough, success scale and lift) sit beside the
springs under `AMPLITUDE`. The alternative was hardcoding them in components.

### Decisions not covered by the brief

These are the places the rules ran out. All are one-liners to change:

- **Enter with an incomplete code is ignored.** There is no error state in the
  design, so nothing is shown.
- **A wrong code** shakes, holds the wrong digits for `ERROR_HOLD_MS`, clears
  them, and returns focus to the first cell.
- **The highlight is a focus affordance**: it shows only while the field has
  focus and is accepting input, and is hidden while verifying.
- **The `filling` artboard and rule 2 disagree.** Rule 2 advances focus to the
  *next* cell after typing; the Figma frame shows the highlight on the *last
  filled* cell (`1 2 2` with the third cell highlighted). The live component
  follows the rule; `PasscodeEntry`'s own default still reproduces the frame,
  so the artboard stays faithful. Say which you want and it collapses to one.

## Component API

```tsx
<PasscodeEntry
  status="filling"      // "empty" | "filling" | "submitting" | "authenticated"
  value="122"           // digits to display
  length={4}            // number of cells
  activeIndex={2}       // cell carrying the highlight; null hides it
  label="Verifying..."  // overrides the status row copy
/>
```

`status` drives every default: `filling` puts the highlight on the last
entered digit, `submitting` switches the component to its disabled styling and
floats the spinner row above it, `authenticated` replaces the component with
the success row. Passing `activeIndex` explicitly overrides the default, which
is what makes an arbitrary state renderable for review.

The status row is absolutely positioned above the component, so showing or
hiding it never moves the component itself — it stays pinned to the centre of
the page across all states.

## Tokens

All values live as custom properties in [`app/globals.css`](app/globals.css)
and are consumed by
[`PasscodeEntry.module.css`](components/PasscodeEntry/PasscodeEntry.module.css).
No Tailwind. Motion values live separately, in
[`motion.ts`](components/PasscodeEntry/motion.ts).

### Colour styles

| Token | Value | Applies to |
| --- | --- | --- |
| `--background` | `#FFFFFF` | page |
| `--border` | `#E4E4E4` | passcode entry component border + dividers |
| `--fill` | `#FAFAFA` | passcode entry component fill |
| `--highlight` | `#107A4D` | selected cell, spinner, check mark |
| `--text-color-1` | `#323232` | digits, status label |
| `--text-color-disabled` | `#858585` | digits, submit state |
| `--fill-disabled` | `#F3F2F2` | component fill, submit state |
| `--border-disabled` | `#E4E4E4` | component border, submit state |

### Geometry

| Token | Value |
| --- | --- |
| page | `1512 × 982`, padding `427px 588px` |
| component | `336 × 128`, radius `16`, border `1px` |
| cell | `84 × 128`, divider `1px` |
| selected cell | stroke `3px` inside, radius `4`, shadow `0 4px 4px 0 rgba(0,0,0,0.25)` |
| status icon | `32 × 32` |
| icon → text gap | `8px` |
| status row → component | `16px` |

### Typography

| Token | Value |
| --- | --- |
| digits | Inter Medium (500), `36px`, `normal` style, `normal` line-height, `--text-color-1` |
| status label | Inter Medium (500), `24px`, `--text-color-1` |

Inter is self-hosted through `next/font/google`, so rendering does not depend
on what is installed locally.

## Implementation notes

- The component's 1px border is drawn as an **inset ring** (`box-shadow:
  inset 0 0 0 1px`) rather than a CSS `border`. A real border would consume
  0.5px from the outer cells and leave the cell track at 83.5px; the inset
  ring keeps every cell exactly `84 × 128` while rendering identically.
- The selected cell's stroke is inset (`inset: 0` + `border: 3px`), matching
  Figma's "inside" stroke position, and the cell is raised one stacking level
  so the stroke and its drop shadow read above the component border and the
  neighbouring dividers.
- `font-variant-numeric` on the digits is deliberately left at `normal`.
  Inter's **tabular** `1` carries a foot serif that the proportional `1` does
  not; the design uses the proportional form. Each cell holds a single centred
  digit, so tabular figures buy nothing anyway.
- Both status marks are the exported Figma SVGs, inlined verbatim in
  [`icons.tsx`](components/PasscodeEntry/icons.tsx). The only edit is
  `fill="currentColor"` in place of the baked-in hex, so they scale from the
  `--passcode-status-icon` token and take `--highlight` from the CSS. The
  checkbox export shipped the same path twice (a `#323232` fill fully covered
  by an identical `#107A4D` one); only the visible path is kept.
