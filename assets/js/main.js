/* ==========================================================================
   Jagruti Appliances — Site Script
   Mobile nav, product filter/search, compare tool, FAQ nav, contact→WhatsApp
   ========================================================================== */
(function () {
  "use strict";

  var WA_NUMBER = "917070705922"; // Customer Care (WhatsApp)

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
            window.scrollTo({ top: target.offsetTop - 96, behavior: "smooth" });
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

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        show(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });

    targets.forEach(function (el) { observer.observe(el); });
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
    if (scenes.length < 2) return;

    var HOLD = 4000;      // matches the 4s beat the scenes were designed on
    var RISE = 1200;      // scene climb duration, must match the CSS
    var current = 0;
    var timer = null;
    var paused = false;

    // A visitor who prefers reduced motion gets the last scene, no movement.
    var quiet = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function apply(next, isFirst) {
      var prev = current;
      scenes.forEach(function (el, i) {
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
      // Nothing left to advance to once the last scene is showing.
      if (cue) cue.hidden = next >= scenes.length - 1;

      if (isFirst) {
        scenes[next].classList.add("is-current", "is-first");
      } else {
        if (prev !== next) scenes[prev].classList.add("is-leaving");
        // Force a reflow so re-adding the class on the same element restarts
        // its animation rather than being coalesced away.
        void scenes[next].offsetWidth;
        scenes[next].classList.add("is-entering", "is-current");
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
      // Stop at the last scene: the sequence plays once, it does not loop.
      if (current >= scenes.length - 1) return;
      timer = setTimeout(function () { apply(current + 1, false); schedule(); }, HOLD);
    }

    function goTo(i) {
      if (i === current) return;
      clearTimeout(timer);
      apply(i, false);
      // A manual jump ends the automatic run - the visitor is steering now.
      paused = true;
    }

    if (cue) {
      cue.addEventListener("click", function () {
        if (current < scenes.length - 1) goTo(current + 1);
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

  /* ---------------- Year stamp ---------------- */
  function initYear() {
    document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initSiteMenu();
    initHeaderScroll();
    initProductFilter();
    initCompare();
    initFaqNav();
    initContactForm();
    initYear();
    initScrollReveal();
    initHeroScenes();
  });
})();
