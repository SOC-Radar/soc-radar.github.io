(function () {
  // theme: explicit choice on <html data-theme>, remembered per viewer; otherwise the OS setting applies
  var root = document.documentElement;
  try { var saved = localStorage.getItem('cws-theme'); if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved); } catch (e) {}
  var tbtn = document.getElementById('theme-toggle');
  if (tbtn) tbtn.addEventListener('click', function () {
    var dark = root.getAttribute('data-theme') === 'dark' ||
      (!root.getAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var next = dark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('cws-theme', next); } catch (e) {}
  });
  var live = document.getElementById('live');
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '-1000px';
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  function done(btn, ok) {
    var label = btn.textContent;
    btn.textContent = ok ? 'Copied' : 'Copy failed';
    btn.setAttribute('data-state', 'done');
    if (live) live.textContent = ok ? 'Addresses copied to the clipboard.' : 'Copy is not available here; select the addresses in the table instead.';
    setTimeout(function () { btn.textContent = 'Copy list'; btn.removeAttribute('data-state'); }, 1500);
    void label;
  }
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = document.getElementById(btn.getAttribute('data-copy'));
      var ips = Array.prototype.map.call(card.querySelectorAll('td.ip'), function (td) { return td.textContent.trim(); });
      var text = ips.join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(btn, true); }, function () { done(btn, fallbackCopy(text)); });
      } else {
        done(btn, fallbackCopy(text));
      }
    });
  });
  // expandable country sections
  function setOpen(toggle, open) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    var body = document.getElementById(toggle.getAttribute('aria-controls'));
    if (body) body.hidden = !open;
  }
  function syncExpandAll(cardId) {
    var card = document.getElementById(cardId); if (!card) return;
    var toggles = card.querySelectorAll('.acc-toggle');
    var allOpen = toggles.length > 0 && Array.prototype.every.call(toggles, function (t) { return t.getAttribute('aria-expanded') === 'true'; });
    var btn = card.querySelector('[data-expand-all]');
    if (btn) { btn.textContent = allOpen ? 'Collapse all' : 'Expand all'; btn.setAttribute('aria-expanded', allOpen ? 'true' : 'false'); }
  }
  document.querySelectorAll('.acc-toggle').forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      setOpen(toggle, toggle.getAttribute('aria-expanded') !== 'true');
      var card = toggle.closest('.card'); if (card) syncExpandAll(card.id);
    });
  });
  document.querySelectorAll('[data-expand-all]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = document.getElementById(btn.getAttribute('data-expand-all')); if (!card) return;
      var open = btn.getAttribute('aria-expanded') !== 'true';
      card.querySelectorAll('.acc-toggle').forEach(function (t) { setOpen(t, open); });
      syncExpandAll(card.id);
    });
  });
  // lookup: a full IPv4 address answers yes/no; any other text filters both lists by IP prefix, country or city
  var input = document.getElementById('ip-lookup');
  var clearBtn = document.getElementById('lookup-clear');
  var result = document.getElementById('lookup-result');
  var rows = Array.prototype.map.call(document.querySelectorAll('.card tr[data-ip]'), function (tr) {
    var acc = tr.closest('.acc'); var card = tr.closest('.card');
    return { tr: tr, acc: acc, card: card, ip: tr.getAttribute('data-ip'), city: (tr.getAttribute('data-city') || '').toLowerCase(),
             country: (acc.getAttribute('data-country') || '').toLowerCase(), group: card.getAttribute('data-group') };
  });
  var isIPv4 = function (q) { return /^\d{1,3}(\.\d{1,3}){3}$/.test(q); };
  function applyLookup() {
    var q = (input.value || '').trim().toLowerCase();
    if (clearBtn) clearBtn.hidden = !q;
    var counts = {};
    document.querySelectorAll('.card').forEach(function (c) { counts[c.id] = 0; });
    var accHits = {};
    var exact = null;
    rows.forEach(function (r) {
      var hit = !q || r.ip.indexOf(q) === 0 || r.country.indexOf(q) !== -1 || r.city.indexOf(q) !== -1 || (r.country + ' ' + r.city).indexOf(q) !== -1;
      if (q && isIPv4(q)) hit = (r.ip === q);
      if (hit && q && r.ip === q) exact = r;
      r.tr.hidden = !hit;
      if (hit) { counts[r.card.id]++; accHits[r.acc.id] = (accHits[r.acc.id] || 0) + 1; }
    });
    document.querySelectorAll('.acc').forEach(function (acc) {
      var n = accHits[acc.id] || 0; var total = acc.querySelectorAll('tr[data-ip]').length;
      acc.hidden = q ? n === 0 : false;
      var countEl = acc.querySelector('.acc-count');
      if (countEl) countEl.textContent = (q && n !== total) ? (n + ' of ' + total) : String(total);
      if (q && n > 0) { var t = acc.querySelector('.acc-toggle'); if (t) setOpen(t, true); }
    });
    document.querySelectorAll('.card').forEach(function (c) {
      var empty = document.getElementById(c.id + '-empty'); if (empty) empty.hidden = !q || counts[c.id] > 0;
      syncExpandAll(c.id);
    });
    if (!q) { result.hidden = true; result.textContent = ''; return; }
    result.hidden = false; result.classList.remove('is-miss');
    var total = 0; Object.keys(counts).forEach(function (k) { total += counts[k]; });
    // build the summary with text nodes only: nothing the viewer typed is ever parsed as HTML
    function render(strongText, rest) {
      result.textContent = '';
      var b = document.createElement('strong'); b.textContent = strongText;
      result.appendChild(b); result.appendChild(document.createTextNode(rest));
    }
    if (isIPv4(q)) {
      if (exact) {
        render(exact.ip, ' is a SOCRadar scanner address — ' + exact.group.toLowerCase().replace(/s$/, '') + ', ' +
          exact.tr.getAttribute('data-city') + ', ' + exact.acc.getAttribute('data-country') + '.');
      } else {
        result.classList.add('is-miss');
        render(q, ' is not a SOCRadar scanner address. Scanning from it is not part of the Curiosity Wide Scan Project.');
      }
    } else {
      var parts = [];
      document.querySelectorAll('.card').forEach(function (c) { parts.push(c.getAttribute('data-group') + ' ' + counts[c.id]); });
      var shown = input.value.trim(); if (shown.length > 60) shown = shown.slice(0, 60) + '…';
      render(String(total), ' address' + (total === 1 ? '' : 'es') + ' match “' + shown + '” · ' + parts.join(' · '));
    }
  }
  if (input) {
    input.addEventListener('input', applyLookup);
    if (clearBtn) clearBtn.addEventListener('click', function () { input.value = ''; applyLookup(); input.focus(); });
  }
  // a #group-N-cM link in the address opens that section
  if (location.hash) {
    var target = document.getElementById(location.hash.slice(1));
    var t = target && target.querySelector && target.querySelector('.acc-toggle');
    if (t) { setOpen(t, true); var c = t.closest('.card'); if (c) syncExpandAll(c.id); }
  }
})();
