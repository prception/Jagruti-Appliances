# Full-viewport sections

How to make a section exactly as tall as the hero — and when not to.

## The rule

A full-viewport section is **one screen tall, pinned three ways**:

```css
height: 100svh;
min-height: max(100svh, 620px);
max-height: max(100svh, 620px);
```

All three are needed:

- `height: 100svh` sets the box. `svh` (small viewport height) is the *stable*
  unit — a mobile browser's collapsing toolbar can't change it, so two sections
  measured this way can never disagree.
- `min-height`/`max-height` with `max(…, 620px)` stops the box shrinking past the
  hero's floor. The hero declares `min-height: 620px`, so on a short desktop
  window a plain `100svh` box would keep shrinking past it and the two would
  stop matching. The floor has to beat the `100svh` min, hence `max()` rather
  than a second `min-height` declaration.

Verified: hero and `.why-section` both render at exactly 900px in a 900px
viewport, at 1280/1440/1600 wide. Delta 0.0px.

## Use it only when the content fits

**This is opt-in, not a default.** Measured across 7 pages / 34 sections, a
blanket `100svh` would clip 6 sections and leave 370–570px of dead space in 19
others. Only 7 fit naturally.

Content that would clip at one screen:

| Section | Needs | Over by |
|---|---|---|
| `faq.html .section` | 2314px | ~1400px |
| `products/domestic-flour-mill .section` | 2243px | ~1340px |
| `index .services` | 1756px | ~850px |
| `index .stage` | 1306px | ~400px |
| `contact.html .section` | 1167px | ~270px |

`max-height` **hides** the overflow — content disappears with no scrollbar. Never
apply this to FAQ lists, spec tables, long card grids, or anything that grows
with copy.

It works for the hero and `.why-section` because their content is *authored* to
fit: the why-grid is a fixed 4×2 whose rows flex into whatever height is left.
That's the test — **the content must flex to the box, not the box to the
content.**

## Applying it

Add the class to a section whose content is built to fit:

```html
<section class="section section-screen">
```

```css
/* Doubled class on purpose. `.section { padding: 72px 0 }` is a single class,
   so a bare `.section-screen` ties on specificity and loses on source order.
   Same reason `.section.why-section` is doubled. */
.section.section-screen {
  height: 100svh;
  min-height: max(100svh, 620px);
  max-height: max(100svh, 620px);
  padding: calc(var(--header-h) + 26px) 0 34px;
  margin: 0;
  display: flex;
  align-items: stretch;
}

/* Below 1200px, release the lock. Multi-row grids cannot fit one screen at
   tablet width without crushing the copy — the section goes content-driven and
   the page scrolls normally. The desktop three must be cleared explicitly or
   they keep squeezing the rows. */
@media (max-width: 1200px) {
  .section.section-screen {
    height: auto;
    min-height: 0;
    max-height: none;
    align-items: flex-start;
    padding: calc(var(--header-h) + 48px) 0 80px;
  }
}
```

The inner wrapper distributes the fixed height — don't set heights on children:

```css
.section-screen > .container { display: flex; flex-direction: column; height: 100%; }
.section-screen .some-grid   { flex: 1; min-height: 0; }  /* min-height:0 lets it shrink */
```

## Interior padding vs. outer height

Two sections can have identical outer heights and still *look* different,
because padding eats the interior.

Current state — both are 900px boxes, but:

| | padding-top | padding-bottom | usable interior |
|---|---|---|---|
| `.hero` | 76px | 18px | 806px |
| `.why-section` | 102px | 34px | 764px |

The why-section's content sits in a band 42px shorter, starting 26px lower. That
reads as "shorter section" even though the coloured bands match exactly. If you
want the content bands to align too, match the padding:

```css
.section.why-section { padding: var(--header-h) 0 18px; }
```

The hero's `padding-top: var(--header-h)` comes from `style.css:399` — it clears
the fixed header, which overlaps the hero's first 76px because `style.css:398`
zeroes `body { padding-top }` on pages opening with a hero.

## Breakpoints

- **Above 1200px** — the lock holds.
- **Below 1200px** — released everywhere. Don't try to hold one screen here;
  eight cards in two columns can't fit without crushing the copy.
- **Below 900px** — `.hero` itself goes `height: auto` (`style.css:2532`), while
  `.hero-parallax` keeps its own one-screen box (`style.css:2535`). A section
  matched to "the hero" above 1200px is deliberately *not* matched below 900px.

## Verifying

Chromium is at
`C:/Users/viswa/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe`;
a usable `playwright` module is in the npx cache. Pass `executablePath` — the
cached module's own browser registry points at a build that isn't installed.

```js
const { chromium } = require('playwright');  // NODE_PATH=<npx-cache>/node_modules
const b = await chromium.launch({ executablePath: '<path above>' });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto('file:///D:/Jagruthi%20appliance/Jagruti-Appliances/index.html');
await p.evaluate(() => [...document.querySelectorAll('section')].map(s => ({
  cls: s.className,
  box: Math.round(s.getBoundingClientRect().height),
  content: Math.round((s.querySelector('.container') || s).scrollHeight),
})));
```

If `content + padding > box`, that section is clipping.

## The why-grid outside the home page

`.why-grid` is authored for the home page: a fixed 4x2 whose rows divide
`.why-section`'s one-screen box. Reusing it elsewhere went wrong twice, both
times because the fixed `grid-template-rows` and `height` have no viewport box
to divide outside `.why-section`:

- **Five product category pages** reused it with four cards, leaving row two in
  the layout as ~335px of empty space above the footer (798px section against
  536-595px siblings). These no longer use `.why-grid` at all - see the strip
  below.
- **`why-jagruti.html`** reuses it with nine cards, making a third implicit row
  that `repeat(2, 1fr)` does not size, so rows one and two were squeezed to
  151px while three cards needed 166-167px and their last paragraph line sat
  past the glass.

The release, scoped so the home page keeps its lock:

```css
.section:not(.why-section) .why-grid {
  grid-template-rows: none;
  height: auto;
  min-height: 0;
  flex: none;
}
```

`:not(.why-section)` rather than a new class because the home page's grid is
always inside `.why-section` and the others never are. `why-jagruti.html` goes
665px -> 739px and stops clipping; `index.html` is unchanged at 900px / 503px.

## The trust strip

The five product category pages (`commercial-flour-mill`,
`food-processing-machinery`, `kitchen-appliances`, `pulverizer`,
`roti-maker-machine`) now use `.trust-strip` instead of `.why-grid`.

All five carried the identical four cards, and each card's paragraph only
restated its own heading - "ISO 9001:2015 Certified" over "Quality-controlled
manufacturing at every stage". The copy was spending 463px of page to say what
four labels say, so the paragraphs are gone and the four claims are one
horizontal row: icon above label, no card.

**Not a glass card like `.why-item`, on purpose.** Those belong to the home
page's photographic `.why-section`, where the translucency reads against the
image behind it. The category pages sit on flat `--page-bg`, so a
`backdrop-filter` has nothing to blur and would render as a grey box. The strip
carries itself on rhythm and a `--blue-100` hairline instead.

`gap: 0` with the breathing room in each cell's `padding-inline`: the hairline
is the separator, and a column gap on top of it would offset the rule instead
of centring it between two labels. `.trust-strip-head` pulls `.section-head`'s
bottom margin from 44px to 30px - 44px is sized for a block of cards, and left
a single 64px row floating.

Breakpoints: 4 columns, 2 below 860px (the hairline moves to the even child),
1 below 460px (hairlines off, rhythm alone).

Measured 1600/1280/900/700/390: section 345/336/320/405/513px, no clipping and
no horizontal scroll at any width. Was 798px.
