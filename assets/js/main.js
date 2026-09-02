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

  /* ---------------- Mobile nav ---------------- */
  function initMobileNav() {
    var toggle = document.querySelector(".hamburger");
    var panel = document.querySelector(".mobile-nav");
    var closeBtn = document.querySelector(".mobile-nav-panel .close-btn");
    if (!toggle || !panel) return;

    function open() { panel.classList.add("open"); toggle.classList.add("is-open"); }
    function close() { panel.classList.remove("open"); toggle.classList.remove("is-open"); }

    toggle.addEventListener("click", function () {
      if (panel.classList.contains("open")) close(); else open();
    });
    if (closeBtn) closeBtn.addEventListener("click", close);
    panel.addEventListener("click", function (e) {
      if (e.target === panel) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("open")) close();
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

  /* ---------------- Year stamp ---------------- */
  function initYear() {
    document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMobileNav();
    initHeaderScroll();
    initProductFilter();
    initCompare();
    initFaqNav();
    initContactForm();
    initYear();
  });
})();
