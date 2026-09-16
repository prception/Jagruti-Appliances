/* ==========================================================================
   Jagruti Appliances — Site Script
   Mobile nav, product filter/search, compare tool, FAQ nav, contact→WhatsApp
   ========================================================================== */
(function () {
  "use strict";

  var WA_NUMBER = "919512305922"; // Trade Inquiry (WhatsApp)

  /* ---------------- Smooth scroll (Lenis) ----------------
     The browser moves the page in instant jumps: one wheel notch, one hop.
     Lenis keeps a TARGET position instead and eases the real scroll toward
     it every frame, so a gesture arrives as travel rather than as a step.

     Everything else on the page keeps working unchanged, because Lenis
     still writes window.scrollY — the reveal observers, the sticky header
     and the journey stroke all read the same number they always did.

     `lenis` stays null when the library is absent or the visitor asked for
     reduced motion, and every call site below is guarded, so the page
     degrades to ordinary native scrolling rather than breaking. */
  var lenis = null;

  function initSmoothScroll() {
    if (typeof Lenis === "undefined") return;
    // Animating the scroll is precisely the motion this setting asks us
    // not to invent. Native scrolling is the honest answer here.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    lenis = new Lenis({
      /* How quickly the page catches up to the target. Lower is heavier and
         more floaty; higher snaps. .09 is close to the igel.ua feel without
         the page ever feeling like it is lagging behind the hand. */
      lerp: .09,
      wheelMultiplier: 1,
      /* Touch devices already have momentum scrolling in hardware, and
         doubling it up feels rubbery and slow. Native is better there. */
      smoothWheel: true,
      smoothTouch: false
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  function waLink(message) {
    return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(message);
  }

  /* ---------------- Slide-in menu overlay ----------------
     Mirrors farmminerals.com/promo: one menu for every breakpoint. The button
     opens .menu-side-bar; inside it, each heading with aria-expanded toggles
     its own accordion. All motion lives in CSS — this only manages state. */
  function initSiteMenu() {
    var toggle = document.querySelector(".menu-btn-wrap");
    var panel = document.querySelector(".menu-side-bar");
    if (!toggle || !panel) return;

    var inner = panel.querySelector(".menu-side-bar-inner");
    var scrim = panel.querySelector(".menu-side-bg");
    var closeBtn = panel.querySelector(".close-btn");
    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      panel.hidden = false;
      // Let the browser paint the un-hidden panel before the class lands, or
      // the transform transition is skipped and the panel simply appears.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { panel.classList.add("open"); });
      });
      toggle.setAttribute("aria-expanded", "true");
      document.body.classList.add("menu-open");
      if (closeBtn) closeBtn.focus();
    }

    function close() {
      panel.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      // Re-hide once the slide-out has finished so the panel leaves the
      // accessibility tree and never traps a tab.
      // Collapsing an expanded accordion is deferred to here. Doing it up
      // front reflows the link rows upward while the panel is still sliding
      // out, and that mid-slide jump is what reads as a snap — the open never
      // shows it because nothing is expanded yet at that point.
      var done = function () {
        if (panel.classList.contains("open")) return;
        panel.hidden = true;
        panel.querySelectorAll(".link-item.is-open").forEach(function (item) {
          item.classList.remove("is-open");
          var h = item.querySelector(".menu-link-heading");
          if (h) h.setAttribute("aria-expanded", "false");
        });
      };
      // One listener per close, and it is torn down by whichever of the two
      // paths wins — otherwise a close whose transitionend never fires (the
      // panel was already off-screen, a background tab) leaves its handler
      // attached and the next close runs done() one extra time per leak.
      var timer = 0;
      var finish = function () {
        if (timer) { window.clearTimeout(timer); timer = 0; }
        if (inner) inner.removeEventListener("transitionend", onEnd);
        done();
      };
      var onEnd = function (e) {
        if (e.target !== inner || e.propertyName !== "transform") return;
        finish();
      };
      if (inner) inner.addEventListener("transitionend", onEnd);
      // Close is the open reversed: text out first, then the panel from 280ms
      // over 850ms — 1.13s in total. The fallback only has to outlast that.
      timer = window.setTimeout(finish, 1300);
    }

    toggle.addEventListener("click", function () {
      if (panel.classList.contains("open")) close(); else open();
    });
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (scrim) scrim.addEventListener("click", close);

    document.addEventListener("keydown", function (e) {
      if (!panel.classList.contains("open")) return;
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab") return;
      // Keep tabbing inside the open panel.
      var focusables = panel.querySelectorAll("a[href], button:not([disabled])");
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // Accordions. On a pointer device the reference opens these on hover and
    // the CSS handles it entirely; click is kept for touch and keyboard, where
    // there is no hover to trigger from. Opening one closes the others.
    panel.querySelectorAll("button.menu-link-heading").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".link-item");
        if (!item) return;
        var willOpen = !item.classList.contains("is-open");
        panel.querySelectorAll(".link-item.is-open").forEach(function (other) {
          if (other === item) return;
          other.classList.remove("is-open");
          var h = other.querySelector(".menu-link-heading");
          if (h) h.setAttribute("aria-expanded", "false");
        });
        item.classList.toggle("is-open", willOpen);
        btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });
    });

    // Navigating away from the current page closes the panel first, so a
    // same-page anchor does not leave the overlay covering the target.
    panel.querySelectorAll("a[href]").forEach(function (a) {
      a.addEventListener("click", function () { close(); });
    });
  }

  /* ---------------- Sticky header scroll state ---------------- */
  function initHeaderScroll() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var ticking = false;
    function update() {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
      ticking = false;
    }
    update();
    window.addEventListener("scroll", function () {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
  }

  /* ---------------- Product filter / search ---------------- */
  function initProductFilter() {
    var grid = document.querySelector("[data-product-grid]");
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".product-card"));
    var pills = document.querySelectorAll(".filter-pill[data-filter]");
    var searchInput = document.querySelector("[data-product-search]");
    var noResults = document.querySelector(".no-results");
    var activeFilter = "all";

    function apply() {
      var term = (searchInput && searchInput.value || "").trim().toLowerCase();
      var visible = 0;
      cards.forEach(function (card) {
        var cat = card.getAttribute("data-category") || "";
        var name = (card.getAttribute("data-name") || "").toLowerCase();
        var matchesCat = activeFilter === "all" || cat === activeFilter;
        var matchesTerm = term === "" || name.indexOf(term) !== -1;
        var show = matchesCat && matchesTerm;
        card.style.display = show ? "" : "none";
        if (show) visible++;
      });
      if (noResults) noResults.style.display = visible === 0 ? "block" : "none";
    }

    pills.forEach(function (pill) {
      pill.addEventListener("click", function () {
        pills.forEach(function (p) { p.classList.remove("active"); });
        pill.classList.add("active");
        activeFilter = pill.getAttribute("data-filter");
        apply();
      });
    });
    if (searchInput) searchInput.addEventListener("input", apply);
    apply();
  }

  /* ---------------- Compare tool ---------------- */
  function initCompare() {
    var wrap = document.querySelector("[data-compare-tool]");
    if (!wrap || typeof JAGRUTI_PRODUCTS === "undefined") return;
    var selects = Array.prototype.slice.call(wrap.querySelectorAll(".compare-select"));
    var tableWrap = wrap.querySelector(".compare-table-wrap");

    var options = JAGRUTI_PRODUCTS.filter(function (p) { return p.specs && p.specs.length; });

    selects.forEach(function (sel, i) {
      var blank = document.createElement("option");
      blank.value = ""; blank.textContent = "Select a machine…";
      sel.appendChild(blank);
      options.forEach(function (p) {
        var o = document.createElement("option");
        o.value = p.slug; o.textContent = p.name;
        sel.appendChild(o);
      });
      if (options[i]) sel.value = options[i].slug;
      sel.addEventListener("change", render);
    });

    function attrUnion(products) {
      var seen = {}, order = [];
      products.forEach(function (p) {
        (p.specs || []).forEach(function (row) {
          if (!seen[row[0]]) { seen[row[0]] = true; order.push(row[0]); }
        });
      });
      return order;
    }

    function specValue(p, attr) {
      var row = (p.specs || []).find(function (r) { return r[0] === attr; });
      return row ? row[1] : "—";
    }

    function render() {
      var chosen = selects.map(function (s) { return s.value; })
        .filter(Boolean)
        .map(function (slug) { return options.find(function (p) { return p.slug === slug; }); })
        .filter(Boolean);

      if (!chosen.length) { tableWrap.innerHTML = "<p style='text-align:center;color:var(--ink-500);padding:40px 0;'>Choose machines above to compare their specifications.</p>"; return; }

      var attrs = attrUnion(chosen);
      var html = '<table class="compare-table"><thead><tr><th class="attr-col">Specification</th>';
      chosen.forEach(function (p) {
        html += '<th class="prod-head"><img src="' + p.image + '" alt="' + p.name + '"><strong>' + p.name + '</strong><a class="btn btn-whatsapp btn-sm" style="margin-top:8px;" href="' + waLink("Hi Jagruti Appliances, I'm interested in the " + p.name + ". I'd like to know the current price, availability, warranty and delivery details.") + '" target="_blank" rel="noopener">Get Price</a></th>';
      });
      html += "</tr></thead><tbody>";
      attrs.forEach(function (attr) {
        html += "<tr><td class=\"attr\">" + attr + "</td>";
        chosen.forEach(function (p) { html += "<td>" + specValue(p, attr) + "</td>"; });
        html += "</tr>";
      });
      html += "</tbody></table>";
      tableWrap.innerHTML = html;
    }

    render();
  }

  /* ---------------- FAQ category nav ---------------- */
  function initFaqNav() {
    var nav = document.querySelector(".faq-cat-nav");
    if (!nav) return;
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href");
        if (id && id.charAt(0) === "#") {
          var target = document.querySelector(id);
          if (target) {
            e.preventDefault();
            var top = target.offsetTop - 96;
            // Through Lenis when it owns the scroll, so the anchor glides
            // with the same easing as everything else instead of the
            // browser's animation fighting it for the same pixels.
            if (lenis) lenis.scrollTo(top);
            else window.scrollTo({ top: top, behavior: "smooth" });
          }
        }
      });
    });
  }

  /* ---------------- Contact form → WhatsApp ---------------- */
  function initContactForm() {
    var form = document.querySelector("[data-contact-form]");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var name = data.get("name") || "";
      var phone = data.get("phone") || "";
      var email = data.get("email") || "";
      var product = data.get("product") || "";
      var type = data.get("enquiry_type") || "";
      var message = data.get("message") || "";
      var text = "Hi Jagruti Appliances, my name is " + name + " (" + phone + (email ? ", " + email : "") + ").\n" +
        "Enquiry type: " + type + "\nProduct of interest: " + product + "\nMessage: " + message;
      window.open(waLink(text), "_blank");
    });
  }

  /* ---------------- Scroll reveal ----------------
     Anything marked [data-reveal] starts hidden in CSS and gets .is-revealed
     the first time it scrolls into view; children marked [data-reveal-child]
     are staggered off their own index. One-shot — the observer unhooks each
     element after it fires, so scrolling back up doesn't replay it.
     No IntersectionObserver (or reduced-motion preferred) means everything is
     shown immediately: the content must never depend on the animation. */
  function initScrollReveal() {
    // html.js is set by an inline script in <head> (before first paint), which
    // is what gates the hidden state in CSS. Nothing to do for it here.
    var targets = document.querySelectorAll("[data-reveal]");
    if (!targets.length) return;

    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Posterless reveal videos get their opening frame decoded up front, so the
    // tile shows the clip's own still — not a blank box — through its hold.
    document.querySelectorAll("video[data-reveal-play]:not([poster])").forEach(function (v) {
      primeFirstFrame(v);
    });

    function show(el) {
      var kids = el.querySelectorAll("[data-reveal-child]");
      kids.forEach(function (kid, i) {
        kid.style.transitionDelay = (i * 110) + "ms";
      });
      el.classList.add("is-revealed");

      // Background videos hold off until their tile is on screen, so a large
      // file never competes with the above-the-fold load, and can hold their
      // poster a little longer still (see data-reveal-play). A looping clip
      // is exactly the motion prefers-reduced-motion asks to suppress, so
      // those users keep the poster instead.
      if (!reduced) {
        el.querySelectorAll("video[data-reveal-play]").forEach(function (video) {
          // data-reveal-play may carry a delay in ms: the tile holds on its
          // poster that long after arriving, so the card reads as a still
          // first and the motion starts once the eye has settled on it.
          // These clips ship preload="none" so they cost nothing on the
          // initial load. The tile is on screen now and will want to play in
          // `wait` ms, so start buffering at reveal time — otherwise the hold
          // elapses and playback then stalls waiting on the first bytes.
          warmUp(video);

          var wait = parseInt(video.getAttribute("data-reveal-play"), 10);
          if (!(wait > 0)) { startVideo(video); return; }
          window.setTimeout(function () {
            // Someone can scroll well past the tile during the hold. Starting
            // an off-screen video is wasteful, so in that case wait and start
            // it the next time it scrolls back into view instead. The reveal
            // observer has already released this element by now, so this
            // needs its own one-shot watch.
            if (onScreen(video)) { startVideo(video); return; }
            playWhenVisible(video);
          }, wait);
        });
      }
    }

    // preload="none" means the browser has fetched nothing at all. Flipping
    // the hint and calling load() begins buffering without playing, so the
    // poster stays up while the clip arrives.
    function warmUp(video) {
      if (video.preload !== "none") return;   // already warmed or hinted
      video.preload = "auto";
      try { video.load(); } catch (e) {}
    }

    function startVideo(video) {
      var playing = video.play();
      if (playing && playing.catch) playing.catch(function () {});
    }

    function onScreen(el) {
      var r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < (window.innerHeight || document.documentElement.clientHeight);
    }

    // With no poster, a video paints nothing until it has decoded a frame, so
    // the tile would open on a black box during its hold. Seeking to the very
    // start as soon as metadata lands forces that first frame to render, which
    // gives the card the still it should read as before the motion begins.
    function primeFirstFrame(video) {
      function seek() {
        try { video.currentTime = 0.001; } catch (e) {}
      }
      if (video.readyState >= 1) { seek(); return; }
      video.addEventListener("loadedmetadata", seek, { once: true });
    }

    // Plays the video the next time it is scrolled into view, once.
    function playWhenVisible(video) {
      if (!("IntersectionObserver" in window)) { startVideo(video); return; }
      var watch = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        watch.disconnect();
        startVideo(video);
      });
      watch.observe(video);
    }

    if (reduced || !("IntersectionObserver" in window)) {
      targets.forEach(show);
      return;
    }

    function makeObserver(options) {
      return new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          show(entry.target);
          entry.target._revealObserver.unobserve(entry.target);
        });
      }, options);
    }

    /* The default cue waits until an element is properly on screen: the
       bottom inset holds it back until it has climbed 10% up the viewport. */
    var observer = makeObserver({ threshold: 0.15, rootMargin: "0px 0px -10% 0px" });

    /* An element marked [data-reveal-early] instead cues while it is still
       BELOW the fold — the positive bottom margin extends the root box past
       the viewport edge, so the reveal is already running as the section
       rises into view rather than starting once it has arrived. Its own
       observer keeps this opt-in from shifting every other section's timing. */
    var earlyObserver = makeObserver({ threshold: 0, rootMargin: "0px 0px 22% 0px" });

    targets.forEach(function (el) {
      var obs = el.hasAttribute("data-reveal-early") ? earlyObserver : observer;
      el._revealObserver = obs;
      obs.observe(el);
    });
  }

  /* ---------------- Hero scene sequence ----------------
     Drives the layered hero: scenes advance on a timer and the indicator
     bottom-left doubles as a switcher, so a click jumps straight to that
     scene. The CSS holds the look of each state (.is-current / .is-entering
     / .is-leaving); this owns only which scene is in which state and when.

     Timings mirror the CSS: a scene's own entrance runs ~2.15s, and the
     climb between scenes is 1.2s. HOLD is how long a settled scene stays
     before the next is cued. */
  function initHeroScenes() {
    var stage = document.querySelector(".hero-parallax");
    if (!stage) return;

    var scenes = Array.prototype.slice.call(stage.querySelectorAll(".hero-scene"));
    var copies = Array.prototype.slice.call(stage.querySelectorAll(".hero-copy"));
    var tabs   = Array.prototype.slice.call(stage.querySelectorAll(".hero-dots .hd"));
    var cue    = stage.querySelector(".hero-scrollcue");
    /* The portrait leaf frame sits OUTSIDE the scenes (it is shared by all
       three), so it cannot pick up their state classes by descent. Its own
       copy of them is mirrored on here, which is what lets its corner plates
       replay the same entrance on every scene change - exactly as the
       desktop canvas leaf plane does from inside the scene. */
    var leafframe = stage.querySelector(".hero-leafframe");
    if (scenes.length < 2) return;

    /* A scene is fully settled 1470ms after its cue (1200ms reveal, with the
       machine and clusters landing by +1470). HOLD is measured from cue to
       cue, so it leaves HOLD-1470 of stillness: 3000 gives ~1.5s. */
    var HOLD = 3000;
    var RISE = 1200;      // scene climb duration, must match the CSS
    var current = 0;
    var timer = null;
    var paused = false;

    // A visitor who prefers reduced motion gets the last scene, no movement.
    var quiet = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function apply(next, isFirst) {
      var prev = current;
      scenes.forEach(function (el, i) {
        // A jump can land mid-climb, so drop any pending un-clip first - it
        // would otherwise fire against whatever state this scene is in now.
        clearTimeout(el._enterT);
        el.classList.remove("is-current", "is-entering", "is-leaving", "is-first");
        // The arriving scene must paint above the one it replaces, which a
        // fixed z-index order cannot express once jumps can go backwards.
        el.style.zIndex = i === next ? 2 : (i === prev ? 1 : 0);
      });
      copies.forEach(function (el) { el.classList.remove("is-current", "is-leaving"); });
      tabs.forEach(function (el, i) {
        el.classList.toggle("is-current", i === next);
        el.setAttribute("aria-selected", i === next ? "true" : "false");
      });
      // The sequence loops, so there is always a next scene - the cue stays.

      // Same beat for the frame: clear, reflow, re-add, so the entrance
      // restarts rather than being coalesced away.
      if (leafframe) {
        leafframe.classList.remove("is-current", "is-entering", "is-first");
        void leafframe.offsetWidth;
      }

      if (isFirst) {
        scenes[next].classList.add("is-current", "is-first");
        if (leafframe) leafframe.classList.add("is-current", "is-first");
      } else {
        if (prev !== next) scenes[prev].classList.add("is-leaving");
        // Force a reflow so re-adding the class on the same element restarts
        // its animation rather than being coalesced away.
        void scenes[next].offsetWidth;
        scenes[next].classList.add("is-entering", "is-current");
        if (leafframe) leafframe.classList.add("is-entering", "is-current");
        /* is-entering exists only for the climb: it clips the scene so the
           plate is REVEALED by the window rather than spilling above it.
           Left on after the climb it keeps clipping a scene that has landed,
           cropping its deliberately over-scaled layers - which is invisible
           where the crop falls outside the viewport, but cuts straight
           through the artwork once the portrait layout scales it up. */
        (function (el) {
          clearTimeout(el._enterT);
          el._enterT = setTimeout(function () {
            el.classList.remove("is-entering");
            if (leafframe) leafframe.classList.remove("is-entering");
          }, RISE);
        })(scenes[next]);
      }
      if (copies[prev] && prev !== next) copies[prev].classList.add("is-leaving");
      if (copies[next]) {
        void copies[next].offsetWidth;
        copies[next].classList.add("is-current");
      }
      current = next;
    }

    function schedule() {
      clearTimeout(timer);
      if (paused || quiet) return;
      // Runs continuously: past the last scene it wraps back to the first.
      timer = setTimeout(function () {
        apply((current + 1) % scenes.length, false);
        schedule();
      }, HOLD);
    }

    function goTo(i) {
      if (i === current) return;
      clearTimeout(timer);
      apply(i, false);
      // The loop keeps running after a manual jump - it just restarts its
      // hold from the scene the visitor chose, so their pick gets a full
      // beat on screen before the sequence moves on.
      schedule();
    }

    if (cue) {
      cue.addEventListener("click", function () {
        goTo((current + 1) % scenes.length);
      });
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { goTo(i); });
      tab.addEventListener("keydown", function (e) {
        var j = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1
              : e.key === "ArrowLeft"  || e.key === "ArrowUp"   ? i - 1 : -1;
        if (j < 0 || j >= tabs.length) return;
        e.preventDefault();
        tabs[j].focus();
        goTo(j);
      });
    });

    if (quiet) {
      apply(scenes.length - 1, true);
      return;
    }
    apply(0, true);
    schedule();

    // Nothing to watch while the hero is off screen, and a visitor coming
    // back should not find the sequence already over.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { if (!paused) schedule(); }
          else clearTimeout(timer);
        });
      }, { threshold: 0.2 }).observe(stage);
    }
  }

  /* ---------------- Preloader ----------------
     The hero's layers start at opacity:0 and its artwork is a stack of large
     PNGs, so the page's first painted frame is an empty coloured band. The
     overlay (shown by html.preloading, set before first paint in <head>)
     covers that window and lifts once the FIRST hero scene has decoded.

     Only scene 1 is waited on: it is all the visitor can see, and blocking
     on all three would hold the curtain for artwork that is not due for
     several seconds. Two escape hatches keep this from ever stranding
     anyone: a hard cap, and window.load.

     Timing has a floor as well as a ceiling. On a warm cache the artwork can
     decode in under 200ms, and a curtain that flashes past reads as a glitch
     rather than an intro — so the overlay is held to MIN before it lifts.
     Both bounds are measured from NAVIGATION start, not from this function,
     so they describe what the visitor actually experiences. */
  function initPreloader(onDone) {
    var root = document.documentElement;
    var el = document.getElementById("preloader");

    function finish() {
      if (!root.classList.contains("preloading")) return;   // already lifted
      root.classList.remove("preloading");
      if (el) {
        el.classList.add("is-done");
        // Must outlast the exit in CSS (.55s mark retreat, .6s overlay fade)
        // or the node is torn out mid-gesture; the extra margin keeps a dead
        // full-screen layer out of the tree without clipping the animation.
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 700);
      }
      if (typeof onDone === "function") onDone();
    }

    // The head script's cap may already have lifted the curtain before this
    // file even parsed (slow link). If so there is nothing left to wait for —
    // start the hero immediately rather than holding it for images that are
    // no longer hiding anything.
    if (!el || !root.classList.contains("preloading")) {
      root.classList.remove("preloading");
      if (typeof onDone === "function") onDone();
      return;
    }

    // MIN: the shortest the curtain is allowed to stay up, so a fast load
    // still gets a deliberate-feeling intro instead of a flicker.
    // CAP:  the longest, so a slow one is never held hostage. CAP must stay
    //       above MIN or the ceiling would fire while the floor still blocks.
    var MIN = 2200;
    var CAP = 4000;

    function since() {
      return (window.performance && performance.now) ? performance.now() : 0;
    }

    // The head-armed cap bounds the wait from first paint; take it over here
    // so the full handover — including starting the hero — runs on expiry.
    if (window.__plCap) { clearTimeout(window.__plCap); window.__plCap = null; }
    var capTimer = setTimeout(finish, Math.max(0, CAP - since()));

    // Images may be ready well before MIN; hold the result and release it
    // when the floor is reached rather than lifting the moment they land.
    function done() {
      clearTimeout(capTimer);
      var wait = MIN - since();
      if (wait > 0) { setTimeout(finish, wait); return; }
      finish();
    }

    var first = document.querySelector(".hero-scene");
    if (!first) { done(); return; }

    var imgs = Array.prototype.slice.call(first.querySelectorAll("img"));
    if (!imgs.length) { done(); return; }

    var left = imgs.length;
    function tick() { if (--left <= 0) done(); }

    imgs.forEach(function (img) {
      // decode() resolves when the bitmap is ready to paint, not merely when
      // the bytes have landed — which is the moment that actually matters
      // for a fade-in. Fall back to load/error events where it is missing,
      // and treat a failed image as satisfied: a broken layer must not hold
      // the whole page hostage.
      if (img.complete && img.naturalWidth > 0) { tick(); return; }
      if (img.decode) {
        img.decode().then(tick, tick);
      } else {
        img.addEventListener("load", tick, { once: true });
        img.addEventListener("error", tick, { once: true });
      }
    });

    // Belt and braces: if a decode promise never settles, load still fires.
    // finish() is a no-op once the curtain is already up, so this can never
    // re-show the overlay or double-run the handover.
    window.addEventListener("load", function () { done(); }, { once: true });
  }

  /* ---------------- Year stamp ---------------- */
  function initYear() {
    document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }



  /* ---------------- Featured: fullscreen machine posters ----------------
     A DISCRETE product showcase. There is exactly one piece of state — the
     active product index — and every control (wheel, trackpad, touch, the
     arrows, the dots, the keyboard) does the same thing to it: step it by
     one and run the same short transition.

     Scroll position is NOT the animation progress. The section still pins
     so a machine can own the screen, but a wheel gesture inside the pinned
     window is captured and converted into ONE index step rather than being
     scrubbed pixel by pixel. That single change is what makes the section
     feel fast instead of like a long timeline being dragged through.

     One transition, ~460ms, drives the whole scene at once:

       0   – 150ms   the new machine is already arriving
       125 – 375ms   copy and CTA come in as one block (tiny stagger)
       150 – 335ms   machine settles and sharpens, title becomes readable
       335 – 460ms   final settle — after this NOTHING is still animating

     The old scene leaves over the first half of that window, so the two
     never read as two separate animations. Only transform, opacity and
     filter are written. */
  function initMachinePosters() {
    var root = document.querySelector(".stage");
    if (!root) return;

    var track   = root.querySelector(".stage-track");
    var pin     = root.querySelector(".stage-pin");
    var scenes  = Array.prototype.slice.call(root.querySelectorAll(".stage-scene"));
    var dots    = Array.prototype.slice.call(root.querySelectorAll(".stage-dots button"));
    var prevBtn = root.querySelector(".stage-nav .stage-prev");
    var nextBtn = root.querySelector(".stage-nav .stage-next");
    if (!track || !scenes.length) return;

    /* Stillness is handled entirely by the stylesheet, which unpins the
       section and lays the posters out in a column. Running the engine on
       top of that would fight it, so it never starts. */
    var quiet = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quiet) {
      scenes.forEach(function (s) { s.classList.add("is-live", "is-active"); });
      return;
    }

    /* Split each giant name into per-letter spans once. The letters still
       carry their own offsets, but over a much shorter window than before:
       the name must be READABLE by ~335ms, not still assembling while the
       copy is already waiting. */
    scenes.forEach(function (scene) {
      var word = scene.querySelector(".stage-word");
      if (!word || word.dataset.split) return;
      var text = word.textContent;
      word.textContent = "";
      for (var i = 0; i < text.length; i++) {
        var s = document.createElement("span");
        s.textContent = text[i] === " " ? " " : text[i];
        word.appendChild(s);
      }
      word.dataset.split = "1";
      word.setAttribute("aria-hidden", "true");
    });

    /* The markup is the single source of truth: each scene carries its own
       product name (data-name), its own View Product href and its own
       WhatsApp link, and only the active scene accepts clicks, so both CTAs
       always belong to the machine on screen. The only thing rebuilt here
       is the WhatsApp message, so it is generated from the product name
       rather than hand-maintained in six places. */
    var WA = "919512305922";
    function waHref(name) {
      return "https://wa.me/" + WA + "?text=" + encodeURIComponent(
        "Hi Jagruti Appliances, I'm interested in the " + name +
        ". I'd like to know the current price, availability, warranty and delivery details."
      );
    }
    scenes.forEach(function (scene) {
      var name = scene.getAttribute("data-name") || "";
      var wa = scene.querySelector('.stage-actions a[href*="wa.me"]');
      if (wa && name) wa.setAttribute("href", waHref(name));
    });

    var parts = scenes.map(function (scene) {
      return {
        scene:   scene,
        word:    scene.querySelector(".stage-word"),
        letters: Array.prototype.slice.call(scene.querySelectorAll(".stage-word span")),
        mach:    scene.querySelector(".stage-machine"),
        wash:    scene.querySelector(".stage-wash"),
        props:   Array.prototype.slice.call(scene.querySelectorAll(".stage-prop")),
        copy:    Array.prototype.slice.call(scene.querySelectorAll(".stage-copy > *")),
        /* The CTAs now live INSIDE .stage-copy (the reference puts them
           directly under the spec chips at the lower left), so they are
           already one of the copy children above and enter on that same
           staggered beat. They must not also be driven separately here, or
           the two passes would fight over opacity and transform. */
        tagline: scene.querySelector(".stage-tagline"),
        feats:   Array.prototype.slice.call(scene.querySelectorAll(".stage-feats li")),
        live:    false,
        active:  false
      };
    });

    /* The next machine's image is decoded before it is asked to animate, so
       a scene never arrives late on the first pass through. */
    parts.forEach(function (p) {
      if (p.mach && p.mach.loading === "lazy") p.mach.loading = "eager";
    });
    function preload(i) {
      var p = parts[i];
      if (!p || !p.mach || p.mach.dataset.warm) return;
      p.mach.dataset.warm = "1";
      if (p.mach.decode) p.mach.decode().catch(function () {});
    }

    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
    // Maps v from [a,b] onto 0→1, flat outside.
    function span(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }
    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

    /* Deterministic per-letter offsets — a hash of the index rather than
       Math.random, so a letter drifts from the same place every time. */
    function hash(i) {
      var x = Math.sin(i * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    }

    /* --- Giant-title fitting -------------------------------------------
       Names differ wildly in length, so each is MEASURED at a known size
       and the size that lands it on target of the viewport is solved for. */
    var FIT_PROBE = 100;
    function fitTitles() {
      var vw = document.documentElement.clientWidth;
      var target = vw < 560 ? .94 : vw < 900 ? .92 : .88;
      parts.forEach(function (p) {
        if (!p.word) return;
        var prev = p.word.style.fontSize;
        p.word.style.fontSize = FIT_PROBE + "px";
        var natural = p.word.scrollWidth || 1;
        p.word.style.fontSize = prev;
        var size = Math.floor(FIT_PROBE * (vw * target) / natural);
        var cap = Math.round(window.innerHeight * .46);
        p.word.style.setProperty("--fit", Math.min(size, cap) + "px");
      });
    }

    var VH = window.innerHeight;
    function measure() {
      VH = window.innerHeight;
      /* The track is only tall enough to give the section a pinned window
         to live in while the visitor steps through the products. It is NOT
         a timeline any more — nothing reads a position inside it, beyond the
         ENTER/LEAVE threshold below which only needs a fraction of a screen
         of travel.

         The track must be TALLER than the pin, because sticky travel is
         exactly (track height - pin height): at 1.0 the pin never sticks at
         all and the poster slides past instead of holding the screen while
         the visitor steps through the machines.

         It also has to clear the ENTER threshold below (.18 of a screen) by
         a real margin, or the products mode engages only as the section is
         already leaving. 1.30 gives .30 of a screen of travel — enough for
         the pin to hold and for ENTER to fire well inside it — while still
         being far short of the full second screen that used to leave ~1080px
         of empty ground scrolling past after the poster had finished. */
      /* Sized so the showcase holds the screen long enough to actually be
         watched. The old 1.30 gave only .30 of a screen of sticky travel,
         which was tuned for the wheel-capture engine: gestures were
         preventDefault()ed, so stepping products consumed no scroll and the
         pin only had to survive a few flicks. Autoplay consumes no scroll
         either, but the visitor's does — at .30 of a screen a brisk scroll
         cleared the whole pinned window in well under one hold, so the
         section left before a single machine had changed.

         2.4 gives ~1.4 screens of pin: a normal scroll lingers across
         several holds, and a fast one still sees the showcase change. */
      track.style.height = Math.round(VH * 2.4) + "px";
      fitTitles();
    }

    /* ------------------------------------------------------------------
       ONE state. Everything below reads this and nothing else. */
    var index = 0;
    var last  = parts.length - 1;

    /* ---- drawing ------------------------------------------------------
       `enter` is 0→1 for the scene arriving, `exit` 0→1 for the one
       leaving. A settled scene is simply enter=1, exit=0 — and once it is
       settled nothing writes to it again until it next moves. */
    function drawEnter(p, t) {
      if (!p.live) { p.scene.classList.add("is-live"); p.live = true; }
      p.scene.style.opacity = "1";

      var a = easeOut(span(t, 0, .72));   // the machine is established early

      if (p.wash) p.wash.style.opacity = (.5 * easeOut(span(t, 0, .5))).toFixed(3);

      if (p.mach) {
        var scale = .92 + a * .08;
        var y     = (1 - a) * 34;
        // Sharp well before the end — the machine must not be blurred for
        // most of the transition.
        var blur  = (1 - easeOut(span(t, 0, .45))) * 5;
        p.mach.style.transform =
          "translate3d(-50%, calc(-50% + " + y.toFixed(1) + "px), 0) scale(" + scale.toFixed(3) + ")";
        p.mach.style.opacity = clamp(easeOut(span(t, 0, .3)), 0, 1).toFixed(3);
        p.mach.style.filter = blur > .06
          ? "drop-shadow(0 34px 42px rgba(5,61,87,.26)) blur(" + blur.toFixed(2) + "px)"
          : "drop-shadow(0 34px 42px rgba(5,61,87,.26))";
      }

      // The title travels with the machine and is readable by ~0.8.
      if (p.word) {
        var wy = (1 - a) * 18;
        p.word.style.transform =
          "translate3d(-50%, calc(-50% + " + wy.toFixed(1) + "px), 0) scale(" + (.98 + a * .02).toFixed(3) + ")";
        p.word.style.opacity = "1";
      }
      p.letters.forEach(function (el, i) {
        var d = i / Math.max(p.letters.length - 1, 1);
        // Letters are spread over a SHORT window (0.18 → 0.9 at the very
        // latest) so the name settles quickly instead of assembling slowly.
        var la = easeOut(span(t, .1 + d * .16, .62 + d * .28));
        var dx = (hash(i) - .5) * 46 * (1 - la);
        var dy = (hash(i + 3) - .5) * 34 * (1 - la);
        el.style.transform =
          "translate3d(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px,0) scale(" + (.92 + la * .08).toFixed(3) + ")";
        el.style.opacity = la.toFixed(3);
      });

      // Supporting imagery arrives WITH the product, not seconds later.
      p.props.forEach(function (el, i) {
        var dir = (i % 2 === 0) ? -1 : 1;
        var pa  = easeOut(span(t, .05 + i * .06, .72 + i * .06));
        var px  = dir * (1 - pa) * 70;
        var py  = (1 - pa) * 22;
        el.style.transform =
          "translate3d(" + px.toFixed(1) + "px," + py.toFixed(1) + "px,0) scale(" + (.9 + pa * .1).toFixed(3) + ")";
        el.style.opacity = pa.toFixed(3);
      });

      /* Copy enters as ONE block with only a token stagger — roughly
         0ms / 25ms / 50ms / 75ms at a 460ms transition — starting early
         enough that the text is never the last thing on screen. */
      p.copy.forEach(function (el, i) {
        var c = easeOut(span(t, .27 + i * .055, .8 + i * .055));
        el.style.opacity = c.toFixed(3);
        el.style.transform = "translate3d(0," + ((1 - c) * 10).toFixed(1) + "px,0)";
      });
      /* The CTAs are copy children now, so they already arrived on the
         stagger above — nothing separate to drive here.

         The stacked tagline is furniture rather than product copy: it
         fades in early and barely moves, so it feels printed on the scene
         instead of flying in with the machine. */
      if (p.tagline) {
        var ta = easeOut(span(t, .12, .6));
        p.tagline.style.opacity = (ta * .9).toFixed(3);
        p.tagline.style.transform = "translate3d(0," + ((1 - ta) * 8).toFixed(1) + "px,0)";
      }

      /* The callouts come in last and left-to-right, so the eye finishes on
         them after the name, the machine and the copy have settled. */
      p.feats.forEach(function (el, i) {
        var fa = easeOut(span(t, .5 + i * .05, .9 + i * .05));
        el.style.opacity = fa.toFixed(3);
        el.style.transform = "translate3d(0," + ((1 - fa) * 12).toFixed(1) + "px,0)";
      });
    }

    /* The outgoing scene clears quickly and as a whole — it must be gone
       by roughly the midpoint so the two scenes never overlap visibly. */
    function drawExit(p, t) {
      if (!p.live) return;
      var e = easeOut(clamp(t / .55, 0, 1));
      p.scene.style.opacity = (1 - e).toFixed(3);
      if (p.mach) {
        p.mach.style.transform =
          "translate3d(-50%, calc(-50% + " + (-e * 30).toFixed(1) + "px), 0) scale(" + (1 - e * .07).toFixed(3) + ")";
      }
      if (p.word) {
        p.word.style.transform =
          "translate3d(-50%, calc(-50% + " + (-e * 22).toFixed(1) + "px), 0) scale(" + (1 + e * .02).toFixed(3) + ")";
      }
      if (e >= 1) hide(p);
    }

    function hide(p) {
      if (!p.live) return;
      p.scene.classList.remove("is-live");
      p.scene.style.opacity = "0";
      p.live = false;
    }

    // Park a scene in its finished state and stop touching it.
    function settle(p) {
      drawEnter(p, 1);
    }

    /* ---- the single transition ---------------------------------------
       Both the wheel and the arrows call this. There is no second code
       path, so the two can never drift apart. */
    var DUR   = 460;   // ms — the whole scene arrives inside this
    var busy  = false;
    var raf   = 0;

    function applyChrome() {
      /* The showcase loops, so neither arrow is ever a dead end. */
      if (prevBtn) prevBtn.disabled = false;
      if (nextBtn) nextBtn.disabled = false;
      parts.forEach(function (p, i) {
        var on = i === index;
        if (p.active !== on) {
          p.scene.classList.toggle("is-active", on);
          p.active = on;
        }
      });
      dots.forEach(function (d, i) {
        var on = i === index;
        d.classList.toggle("is-current", on);
        d.setAttribute("aria-current", on ? "true" : "false");
      });
    }

    /* ---- the two section states ---------------------------------------
       ONE variable decides what the section is showing. "intro" is the
       opening identity; "products" is the machine showcase. They are
       mutually exclusive by construction — there is no code path that can
       make both true — and the stylesheet gates BOTH stages from it, so
       the intro never shares a frame with a machine.

       This is a mode rather than a scroll ratio because the wheel inside
       the pinned window is preventDefault()ed: stepping products does not
       move the page, so anything derived from scroll position stayed put
       across every machine. That was the overlap bug.

       The mode flips only at the section boundary (see onScroll), never
       from per-product animation progress, so moving backwards through the
       products cannot bring the intro back. */
    var mode = "";
    function setMode(next) {
      if (mode === next) return;
      mode = next;
      root.classList.toggle("is-intro", next === "intro");
      root.classList.toggle("is-products", next === "products");
    }

    /* Entering the showcase: the intro leaves FIRST, then the product
       transition runs, so the two are never mid-flight together. The first
       product is (re)settled on entry so it arrives clean. */
    function startSequence() {
      if (mode === "products") return;
      setMode("products");
      startAuto();
    }

    function goTo(next, immediate) {
      next = clamp(next, 0, last);
      if (next === index && !immediate) return;
      if (busy) return;

      /* Any real product step retires the intro. The initial settle passes
         immediate=true, so the opening state keeps the intro on screen. */
      if (!immediate) startSequence();

      var from = parts[index];
      var to   = parts[next];
      index = next;

      // Publish the new state immediately: the CTAs, the WhatsApp link and
      // the active dot belong to the incoming product from the very start
      // of the transition, never to the one leaving.
      applyChrome();
      preload(index + 1);
      preload(index - 1);

      if (immediate || from === to) {
        parts.forEach(function (p) { if (p !== to) hide(p); });
        settle(to);
        queueNext();
        return;
      }

      busy = true;
      var start = 0;
      if (raf) cancelAnimationFrame(raf);

      // Anything that is neither leaving nor arriving is simply not here.
      parts.forEach(function (p) { if (p !== to && p !== from) hide(p); });

      drawEnter(to, 0);

      function frame(now) {
        if (!start) start = now;
        var t = clamp((now - start) / DUR, 0, 1);
        drawExit(from, t);
        drawEnter(to, t);
        if (t < 1) {
          raf = requestAnimationFrame(frame);
        } else {
          raf = 0;
          hide(from);
          settle(to);
          busy = false;
          // The machine now owns the screen; time its exit from this moment
          // so every product gets the same hold regardless of transition.
          queueNext();
        }
      }
      raf = requestAnimationFrame(frame);
    }

    /* ---- is the section on screen at all? ------------------------------
       Deliberately LENIENT, where the old pinned() test was strict. That
       test demanded the poster fill the viewport exactly (top <= 1 and
       bottom >= VH - 1), which a fast scroll can skip over entirely between
       two frames — so the section was considered inactive precisely when it
       was flying past. Any meaningful overlap with the viewport counts here,
       which is all the autoplay timer needs to know. */
    function visible() {
      if (!pin) return false;
      var r = pin.getBoundingClientRect();
      return r.top < VH * .75 && r.bottom > VH * .25;
    }

    /* ---- autoplay -----------------------------------------------------
       The showcase advances on a TIMER, not on scroll position. That is the
       whole point of this design: the previous engine converted wheel
       gestures into index steps and preventDefault()ed them, which meant
       stepping a product consumed no scroll at all. A fast scroll therefore
       crossed the short pinned window long before six gestures could land,
       the pin released, and the machines never changed — the section looked
       broken precisely when the visitor moved quickly.

       Now the only input is time. Each machine holds for HOLD ms, then the
       same ~460ms transition runs and the next one takes the screen. The
       sequence loops, so the section is always showing something alive
       whether it is scrolled past slowly, quickly, or simply left on screen.

       The timer runs ONLY while the section is actually visible, so it never
       burns frames or races ahead while the visitor is elsewhere on the page.
       The wheel is no longer captured anywhere: the page always scrolls
       normally through this section, which is what makes fast scrolling
       behave. */
    var HOLD  = 1700;   // ms a machine owns the screen before the next one
    var timer = 0;

    function stopAuto() {
      if (timer) { clearTimeout(timer); timer = 0; }
    }

    function queueNext() {
      stopAuto();
      timer = setTimeout(function () {
        timer = 0;
        if (!visible() || mode !== "products") return;
        // Wrap at the end so the showcase loops instead of dead-ending.
        goTo(index >= last ? 0 : index + 1);
      }, HOLD);
    }

    function startAuto() {
      if (mode !== "products" || !visible()) return;
      queueNext();
    }

    /* ---- touch --------------------------------------------------------
       A swipe is still a shortcut to the next/previous machine, but it no
       longer fights the page: the listener is passive and the gesture also
       scrolls, so a flick can never trap the visitor in the section. */
    var ty = 0, tActive = false;
    window.addEventListener("touchstart", function (e) {
      tActive = visible() && mode === "products" && e.touches.length === 1;
      if (tActive) ty = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener("touchmove", function (e) {
      if (!tActive || busy) return;
      var dy = ty - e.touches[0].clientY;
      if (Math.abs(dy) < 56) return;      // a deliberate swipe, not a graze
      tActive = false;
      goTo(dy > 0 ? (index >= last ? 0 : index + 1) : (index <= 0 ? last : index - 1));
    }, { passive: true });

    window.addEventListener("touchend", function () { tActive = false; }, { passive: true });

    /* ---- keyboard ----------------------------------------------------- */
    root.addEventListener("keydown", function (e) {
      // The arrows are product controls, so they exist only once the
      // showcase does. In the opening state the keys stay the page's.
      if (mode !== "products") return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { goTo(index >= last ? 0 : index + 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { goTo(index <= 0 ? last : index - 1); e.preventDefault(); }
    });

    /* ---- the controls -------------------------------------------------
       Each one is a direct product control: ONE click, ONE product, using
       the very same transition the wheel produces. */
    dots.forEach(function (dot, i) {
      dot.addEventListener("click", function () { goTo(i); });
    });
    if (prevBtn) prevBtn.addEventListener("click", function () {
      goTo(index <= 0 ? last : index - 1);
    });
    if (nextBtn) nextBtn.addEventListener("click", function () {
      goTo(index >= last ? 0 : index + 1);
    });

    /* ---- the section boundary -----------------------------------------
       The ONLY place the mode changes from scrolling. There is a single
       threshold: how far the track has travelled up the screen.

         above it  → INTRO     (the opening identity owns the section)
         below it  → PRODUCTS  (the showcase owns the section)

       Because the mode is a function of the SECTION's position and never
       of the product index, stepping backwards from Dough Kneader all the
       way to Aura Plus leaves it at "products" — the intro returns only
       when the visitor actually scrolls back out above the first product
       and the section itself retreats past the boundary.

       The two thresholds differ on purpose (hysteresis): entering at .18
       and leaving at .10 means a pixel of jitter at the boundary cannot
       flip the mode back and forth, so the intro can never flash. */
    var ENTER = .18, LEAVE = .10;
    var introTicking = false;
    function onScroll() {
      if (introTicking) return;
      introTicking = true;
      requestAnimationFrame(function () {
        introTicking = false;
        var travelled = -track.getBoundingClientRect().top;
        /* The showcase starts as soon as it is genuinely ON SCREEN, not
           only once the track has climbed .18 of a screen. Waiting for the
           travel threshold meant the section could be sitting fully in
           view, held still, with nothing moving until the visitor scrolled
           further — the machines only "woke up" on the next nudge. The
           travel threshold is kept as a second way in (a fast scroll can
           clear the visible band between two frames), but visibility is
           what normally fires it. */
        if (mode !== "products" && (visible() || travelled > VH * ENTER)) {
          startSequence();
        } else if (mode !== "intro" && travelled < VH * LEAVE && !visible()) {
          // Back above the first product: the showcase exits, intro returns.
          setMode("intro");
        }

        /* The timer is a function of visibility, not of scroll position:
           it runs while the showcase is on screen and is parked the moment
           it is not, so the machines never advance unwatched. */
        if (mode === "products" && visible()) {
          if (!timer && !busy) queueNext();
        } else {
          stopAuto();
        }
      });
    }

    measure();
    /* The opening state is the intro, with the showcase not yet on screen.
       The first product is settled underneath so that when the mode does
       flip it is already composed and arrives without a build-up frame. */
    setMode("intro");
    goTo(0, true);
    stopAuto();          // the intro holds until the section is actually entered
    preload(1);
    onScroll();

    /* Scroll events are not the only way this section can come into view:
       it can be in view already on load, after the preloader lifts, after a
       hash jump, or after a resize — and once the visitor stops scrolling
       no further events arrive. An IntersectionObserver gives the engine a
       wake-up in all of those cases, so the showcase never sits frozen
       waiting for one more scroll gesture. */
    if (window.IntersectionObserver) {
      new IntersectionObserver(function () { onScroll(); }, {
        threshold: [0, .1, .25, .5, .75, 1]
      }).observe(pin || root);
    }

    /* Nothing should animate in a background tab: the hold would elapse
       unseen and the showcase would jump several machines on return. */
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stopAuto();
      else startAuto();
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      measure();
      settle(parts[index]);
      onScroll();
    });
  }

  /* ---------------- Journey: "From Grain to Fresh Flour" ----------------
     A serpentine stroke threads the four stages, drawn by scroll position.

     This engine writes exactly ONE value: --draw, which runs 1 → 0 as the
     section travels through the viewport. The stylesheet derives everything
     else from it — the stroke's dashoffset, each dot's fill and scale, the
     numbers colouring in, the copy lifting — so a frame here is a single
     custom-property write and never a per-node loop.

     Both paths declare pathLength="1", so the dash maths is already
     normalised: no getTotalLength(), and nothing to remeasure on resize.

     --draw is a pure function of scroll position, so the line advances and
     retreats exactly with the visitor rather than playing on a timer. */
  /* ---------------- Why Jagruti — replayable reveal + parallax ----------------
     Deliberately NOT the shared [data-reveal] path: that one is one-shot (it
     unobserves after firing) and this section is specified to replay both
     ways. So it keeps its own observer that adds .is-in on entry and removes
     it once the section is fully clear of the viewport — clearing only when
     it is fully clear avoids a re-trigger flicker at the threshold edge.

     The parallax moves the photograph slower than the page: .why-bg is taller
     than the section (inset stretch + overflow clip on the section), so the
     image can travel without ever exposing an edge or cropping the mill. */
  function initWhyReveal() {
    var root = document.querySelector("[data-why]");
    if (!root) return;

    var heading = root.querySelector(".section-head h2");
    var eyebrow = root.querySelector(".section-head .eyebrow");
    var bg      = root.querySelector(".why-bg");
    var product = root.querySelector(".why-product");
    var quiet   = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* The heading reveals a line at a time, which means knowing where the
       browser actually broke it — that depends on the final width, so the
       split is measured from rendered text rather than guessed.

       Each word is measured once, grouped into rows by its offsetTop, and
       each row becomes `.why-line > span`: the outer element clips, the
       inner one slides up out of it. Re-run on resize because a different
       width breaks the line differently. */
    function splitHeading() {
      if (!heading) return;
      // Keep the original wording verbatim to rebuild from on every re-split.
      if (!heading.dataset.text) heading.dataset.text = heading.textContent;
      var text = heading.dataset.text;

      // Lay every word out individually so their positions can be read.
      heading.textContent = "";
      var probes = text.split(/\s+/).map(function (word) {
        var s = document.createElement("span");
        s.textContent = word;
        s.style.display = "inline-block";
        heading.appendChild(s);
        heading.appendChild(document.createTextNode(" "));
        return s;
      });

      // Group by vertical position — same offsetTop means the same line.
      var lines = [];
      var currentTop = null;
      probes.forEach(function (probe) {
        var top = probe.offsetTop;
        if (currentTop === null || top !== currentTop) {
          lines.push([]);
          currentTop = top;
        }
        lines[lines.length - 1].push(probe.textContent);
      });

      // Rebuild as clipped rows.
      heading.textContent = "";
      lines.forEach(function (words) {
        var outer = document.createElement("span");
        outer.className = "why-line";
        var inner = document.createElement("span");
        inner.textContent = words.join(" ");
        outer.appendChild(inner);
        heading.appendChild(outer);
      });
      return lines.length;
    }

    /* Sequences the phases by writing each element's own delay. The
       photograph leads, the eyebrow follows it, and the heading lines
       follow that — so the section assembles in a readable order rather
       than all at once. The cards do not animate; they are always present. */
    function applyTiming() {
      var lineStep = 90;

      if (bg) bg.style.setProperty("--why-delay", "0ms");
      if (product) product.style.setProperty("--why-delay", "120ms");
      if (eyebrow) eyebrow.style.setProperty("--why-delay", "420ms");

      var lines = root.querySelectorAll(".why-line > span");
      lines.forEach(function (line, i) {
        line.style.setProperty("--why-delay", (600 + i * lineStep) + "ms");
      });

      // The cards have no entrance animation, so nothing to time for them.
    }

    // No observer, or stillness preferred: show everything, run nothing.
    if (quiet || !("IntersectionObserver" in window)) {
      root.classList.add("is-in");
      return;
    }

    splitHeading();
    applyTiming();

    /* A re-split rebuilds the heading spans, so the timings must be rewritten
       onto the new nodes. Debounced — resize fires continuously during a
       drag and re-measuring text on every frame is wasteful. */
    var resizeT = 0;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeT);
      resizeT = window.setTimeout(function () {
        splitHeading();
        applyTiming();
        onScroll();
      }, 180);
    });

    /* Replayable both ways, with hysteresis: the cue-in and the clear sit at
       DIFFERENT thresholds on purpose.

       Entry waits for IN_RATIO rather than any intersection. A bare
       `isIntersecting` also fires on the 0-threshold crossing, i.e. the
       instant a one-pixel sliver of the section appears — so approaching
       from below (scrolling up) the 1.4s staggered sequence would start
       while the section was still essentially off screen and be over before
       it was actually in view. Requiring a real ratio means the sequence
       starts when there is something to watch, from either direction.

       The clear is the mirror: it waits for the section to stop intersecting
       altogether instead of testing `ratio === 0`. With several thresholds a
       callback can arrive at the leaving edge with a tiny non-zero ratio,
       which that exact-zero test let through — leaving .is-in set and
       .is-settled cleared, so the next pass never replayed cleanly.

       Two different levels (cue in at IN_RATIO, clear only once fully gone)
       is what keeps a scroll that hovers near the boundary from toggling.

       .is-settled drops the entrance transition off the two parallax layers
       once their entry is over, so the per-frame transform writes below are
       not fighting a 950ms ease. */
    var IN_RATIO = 0.2;
    var settleT = 0;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.intersectionRatio >= IN_RATIO) {
          if (root.classList.contains("is-in")) return;   // already playing
          root.classList.add("is-in");
          window.clearTimeout(settleT);
          // Longest entrance delay plus its duration.
          settleT = window.setTimeout(function () {
            root.classList.add("is-settled");
            onScroll();
          }, 1400);
          return;
        }
        if (!entry.isIntersecting) {
          window.clearTimeout(settleT);
          root.classList.remove("is-in", "is-settled");
          // Hand the layers back to the stylesheet's initial transforms.
          if (bg) bg.style.transform = "";
          if (product) product.style.transform = "";
        }
      });
    }, { threshold: [0, IN_RATIO] }).observe(root);

    /* ---- Parallax ----
       Two rates, so the composition reads as layered: the wall drifts
       slowly, the machine moves against it and lifts a little further. Both
       layers are inset past the section edges, so this travel never pulls a
       bare edge into frame. */
    var ticking = false;

    function update() {
      ticking = false;
      // Until the entrance has settled, the CSS owns these transforms.
      if (!root.classList.contains("is-settled")) return;

      var rect = root.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      if (rect.bottom < 0 || rect.top > vh) return;

      // -1 entering from below, 0 at centre, +1 leaving past the top.
      var progress = (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
      if (progress < -1) progress = -1;
      if (progress > 1) progress = 1;

      if (bg) bg.style.transform = "translate3d(0," + (progress * -3.5).toFixed(2) + "%,0)";
      // The machine travels further and drifts very slightly sideways.
      if (product) {
        product.style.transform =
          "translate3d(" + (progress * 1.6).toFixed(2) + "%," +
          (progress * -7).toFixed(2) + "%,0)";
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  /* ---------------- Journey mosaic ----------------
     Each photograph opens from its top-left corner the first time it
     crosses into view. All the motion lives in CSS; this only flips a
     class once per tile, staggered slightly so the wall assembles rather
     than snapping in all at once. */
  function initJourney() {
    var root = document.querySelector("[data-journey]");
    if (!root) return;

    var tiles = root.querySelectorAll("[data-journey-img]");
    if (!tiles.length) return;

    /* Stillness: the stylesheet already leaves every tile open. */
    var quiet = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quiet || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(tiles, function (t) { t.classList.add("is-open"); });
      return;
    }

    var seen = 0;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        var delay = (seen++ % 4) * 90;
        window.setTimeout(function () { el.classList.add("is-open"); }, delay);
      });
    /* A clipped tile paints NOTHING, and the observer reports an
       intersectionRatio of 0 for it however much of its box is on screen.
       So the threshold has to be 0 — any ratio above it would never trip
       and the tiles would sit closed forever. The negative rootMargin is
       what delays the open until the tile is properly up into the
       viewport, which is the job the threshold would otherwise do. */
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0 });

    Array.prototype.forEach.call(tiles, function (t) { io.observe(t); });
  }

  /* ---------------- Service showcase ----------------
     A pinned horizontal run, after the reference site's Chapter III.

     .services-track is tall; .services-pin sticks to the top of the
     viewport inside it. While the track scrolls past, this translates
     .services-rail LEFT by exactly its own overflow, so scrolling DOWN
     brings each card in from the RIGHT and the last one lands flush with
     the right-hand gutter.

     The wheel is never intercepted. The rail position is a pure function
     of scroll, so Lenis keeps the scroll and nothing can trap the visitor
     inside the section.

     The phone layout and reduced motion are handled entirely in CSS — a
     plain vertical stack — so the engine never starts for either. */
  function initServices() {
    var root = document.querySelector("[data-services]");
    if (!root) return;

    var track = root.querySelector("[data-services-track]");
    var pin   = root.querySelector(".services-pin");
    var rail  = root.querySelector("[data-services-rail]");
    if (!track || !pin || !rail) return;

    var panels = Array.prototype.slice.call(
      rail.querySelectorAll(".services-intro, .service-card")
    );
    if (!panels.length) return;

    var quiet = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var narrow = function () { return window.innerWidth < 768; };
    if (quiet) return;

    /* The intro is sized at half the pin MINUS this, which slides the first
       card's divider left onto the same line as the Two Ranges video edge
       above. Both sides compute to half the screen on paper, yet render a
       little apart; this is an empirical correction, measured off the
       rendered page rather than derived, so re-measure it if that section's
       layout changes. */
    var SPLIT_NUDGE = 12;

    /* Travel is the rail's overflow: how far it has to move for its right
       edge to reach the right edge of the screen. Everything below is
       derived from this one number. */
    var travel = 0;
    var VH = window.innerHeight;

    function measure() {
      if (narrow()) {
        track.style.height = "";
        rail.style.transform = "";
        /* Drop the measured width too, or a desktop -> phone resize leaves a
           half-screen px width on the intro that outranks the stacked
           layout's width:auto. */
        var introNarrow = rail.querySelector(".services-intro");
        if (introNarrow) introNarrow.style.width = "";
        panels.forEach(function (el) { el.classList.add("is-in"); });
        travel = 0;
        return;
      }
      VH = window.innerHeight;
      /* The intro is sized from the PIN, not from 50vw. Both this band and
         the Two Ranges split above are nominally "half the screen", but a
         vw unit is half the viewport INCLUDING the scrollbar, while the
         video's half is measured inside .range-pin, which is overflow:hidden
         and has none. That mismatch left the first card's divider a few px
         off the video's edge. pin.clientWidth excludes the scrollbar, so
         half of it puts the divider on exactly the same line. The CSS
         width:50vw stays as the pre-JS fallback. */
      var introEl = rail.querySelector(".services-intro");
      if (introEl) introEl.style.width = (pin.clientWidth / 2 - SPLIT_NUDGE) + "px";
      travel = Math.max(0, rail.scrollWidth - pin.clientWidth);
      /* A rail only a little wider than the screen gives a run so short it
         reads as a twitch. Below a screen of overflow the section is not
         worth pinning at all, so it falls back to a static band. */
      if (travel < pin.clientWidth * 0.35) travel = 0;
      /* One screen to hold while the rail runs, plus the travel itself.
         Without the extra screen the section unpins the instant the last
         card lands and the run feels cut off. */
      if (travel <= 0) {
        track.style.height = "";
        rail.style.transform = "";
        panels.forEach(function (el) { el.classList.add("is-in"); });
        return;
      }
      track.style.height = Math.round(VH + travel) + "px";
      draw();
    }

    /* p is the pin's progress through its own travel: 0 while the section
       is arriving, 1 once the track has been scrolled by `travel`. */
    function progress() {
      var top = track.getBoundingClientRect().top;
      if (travel <= 0) return 0;
      var p = -top / travel;
      return p < 0 ? 0 : (p > 1 ? 1 : p);
    }

    function draw() {
      if (narrow() || travel <= 0) return;
      var x = progress() * travel;
      rail.style.transform = "translate3d(" + (-x).toFixed(2) + "px, 0, 0)";

      /* A panel is "in" once its left edge has crossed a line set a little
         inside the right-hand edge, so a card announces itself just after it
         appears rather than while it is still a sliver. */
      var edge = pin.getBoundingClientRect().right - 80;
      panels.forEach(function (el) {
        if (el.classList.contains("is-in")) return;
        if (el.getBoundingClientRect().left < edge) el.classList.add("is-in");
      });
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        draw();
      });
    }

    /* The panels visible in the opening frame get a staggered entrance of
       their own — without this they would simply be present, and only the
       later cards would ever animate. */
    function intro() {
      if (narrow() || travel <= 0) return;
      var edge = pin.getBoundingClientRect().right;
      var n = 0;
      panels.forEach(function (el) {
        if (el.classList.contains("is-in")) return;
        if (el.getBoundingClientRect().left >= edge) return;
        var d = n++ * 110;
        window.setTimeout(function () { el.classList.add("is-in"); }, d);
      });
    }

    measure();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          intro();
          obs.unobserve(e.target);
        });
      }, { threshold: 0.12 }).observe(root);
    } else {
      intro();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure, { passive: true });

    /* The cover images decide the rail's width, so a late-decoding image
       would leave `travel` short. Re-measure once they have all landed. */
    window.addEventListener("load", measure);
  }

  /* ---------------- Two Ranges — pinned full-bleed panels ----------------
     Each panel holds still in the viewport while the page scrolls through
     its runway; the copy fades in per character as it arrives, and the
     background clip starts only once its panel is on screen.

     Lenis owns the scroll, so ScrollTrigger has to be driven from the same
     rAF loop rather than the browser's scroll event — otherwise the pin
     lags the smoothed position and the panel visibly slides. `lenis` is
     module-scoped, which is why this lives here and not in a page script.

     No GSAP (CDN blocked, or reduced motion) means the panels simply sit
     there, full-bleed and legible, with the video playing. The section must
     never depend on the animation to be readable. */
  function initTwoRanges() {
    var panels = document.querySelectorAll("[data-range-panel]");
    if (!panels.length) return;

    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";

    // Videos play whenever their panel is on screen, animation or not. They
    // ship preload="none", so nothing is fetched until that moment.
    function playWhenVisible(video) {
      function start() {
        if (video.preload === "none") {
          video.preload = "auto";
          try { video.load(); } catch (e) {}
        }
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      }
      if (reduced) return;                       // looping motion is the thing to suppress
      if (!("IntersectionObserver" in window)) { start(); return; }
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) start();
          else video.pause();                    // off screen: stop decoding
        });
      }, { threshold: 0.25 }).observe(video);
    }

    document.querySelectorAll("[data-range-video]").forEach(playWhenVisible);

    if (!hasGsap || reduced) {
      panels.forEach(function (p) { p.classList.add("is-static"); });
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    // Drive ScrollTrigger off Lenis' own frame, and report Lenis' smoothed
    // position as the scroll position. Guarded: with reduced motion Lenis
    // is null and we never get here, but the page may also ship without it.
    if (lenis) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    }

    // Split a heading into per-character spans so they can be staggered.
    // Word wrappers keep line breaking intact, and the original text stays
    // available to screen readers via aria-label on the heading.
    function splitChars(el) {
      var text = el.textContent;
      el.setAttribute("aria-label", text);
      el.textContent = "";
      var chars = [];
      text.split(/(\s+)/).forEach(function (chunk) {
        if (/^\s+$/.test(chunk)) { el.appendChild(document.createTextNode(" ")); return; }
        var word = document.createElement("span");
        word.className = "range-word";
        word.setAttribute("aria-hidden", "true");
        chunk.split("").forEach(function (ch) {
          var s = document.createElement("span");
          s.className = "range-char";
          s.textContent = ch;
          word.appendChild(s);
          chars.push(s);
        });
        el.appendChild(word);
      });
      return chars;
    }

    panels.forEach(function (panel) {
      var content = panel.querySelector(".range-content-inner");
      var heading = panel.querySelector("[data-range-split]");

      // The hold is CSS position:sticky on .range-pin (see style.css). No
      // ScrollTrigger pin: a pin switches the node to position:fixed and
      // back, and a sticky element resists that — the two mechanisms
      // fighting over one node is what made the handover jump.

      // THE PUSH. --split is the media column's width, scrubbed 100% -> 50%
      // across the first half of the panel's runway while the pin holds the
      // screen. The video therefore arrives full-bleed and is pushed aside
      // as the copy column opens beside it; --flip reverses the side in CSS,
      // so the second panel pushes the other way with no extra JS.
      var pinEl = panel.querySelector(".range-pin");
      if (pinEl) {
        gsap.fromTo(pinEl,
          { "--split": "100vw" },
          {
            "--split": "50vw",
            ease: "none",
            scrollTrigger: {
              trigger: panel,
              // Starts once the panel's top reaches the top of the screen —
              // i.e. the moment sticky engages — and finishes halfway down
              // the runway, leaving the rest of the hold as a settled 50/50.
              start: "top top",
              end: "50% top",
              scrub: true,
              invalidateOnRefresh: true
            }
          });
      }

      // The copy rises and fades as the split opens for it — not on the
      // panel's approach, which would fade the text in over a video still
      // filling the screen. Firing at 40% of the runway puts it just past
      // the midpoint of the push, so the column is already opening.
      var tl = gsap.timeline({
        // Fires as the split opens, on the same range as the push scrub
        // above. An earlier trigger faded the copy in over a video still
        // filling the screen; a later one left it at its pre-paint
        // opacity:0 for the whole hold, which read as no text at all.
        scrollTrigger: { trigger: panel, start: "top top", once: true },
        // Drops the compositor hints once the entrance has played out.
        onComplete: function () { panel.classList.add("is-revealed"); }
      });

      // The heading is animated per character below, so it must be excluded
      // here — tweening the block's autoAlpha AND its characters' means two
      // overlapping visibility flips on the same element, which reads as a
      // flash. Everything else in the block rises and fades as one stagger.
      if (content) {
        var blocks = Array.prototype.filter.call(content.children, function (el) {
          return el !== heading;
        });
        if (blocks.length) {
          tl.fromTo(blocks,
            { autoAlpha: 0, y: 26 },
            { autoAlpha: 1, y: 0, duration: .7, ease: "power2.out", stagger: .09 }, 0);
        }
      }
      if (heading) {
        var chars = splitChars(heading);
        // The heading element itself is unhidden in one step (the CSS above
        // hid it pre-paint); only its characters carry the stagger.
        gsap.set(heading, { autoAlpha: 1 });
        tl.fromTo(chars,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: .35, ease: "power2.out", stagger: { each: .022, from: "random" } }, .12);
      }

    });

    // Late-decoding video metadata changes panel heights, so remeasure.
    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    // First: the showcase's wheel bridge expects `lenis` to already exist.
    initSmoothScroll();
    initSiteMenu();
    initHeaderScroll();
    initProductFilter();
    initCompare();
    initFaqNav();
    initContactForm();
    initYear();
    initScrollReveal();
    initMachinePosters();
    initJourney();
    initWhyReveal();
    initServices();
    initTwoRanges();

    // The hero's opening entrance is the first thing a visitor should see, so
    // it starts only once the curtain is on its way up — otherwise scene 1
    // would play out behind the overlay and be over before the page appears.
    initPreloader(initHeroScenes);
  });
})();
