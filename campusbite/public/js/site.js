// public/js/site.js — customer website. All data comes from the API; prices
// shown here are for display only (the server recalculates them on checkout).
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const money = (n) => 'R' + Number(n).toFixed(2);
  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    });
    children.forEach((c) => node.append(c));
    return node;
  };

  async function api(path, options) {
    const res = await fetch('/api' + path, { headers: { 'Content-Type': 'application/json' }, ...options });
    const data = res.status === 204 ? null : await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data && data.error) || 'Something went wrong. Please try again.');
    return data;
  }

  const state = { config: null, zones: [], menu: [], cart: {}, category: 'All', slot: null };

  function loadCart() { try { state.cart = JSON.parse(sessionStorage.getItem('campusbite-cart')) || {}; } catch (e) { state.cart = {}; } }
  function saveCart() { try { sessionStorage.setItem('campusbite-cart', JSON.stringify(state.cart)); } catch (e) { /* ignore */ } }

  const dayLabel = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

  // ---------- static bits ----------
  function renderHours() {
    const s = state.config.slots;
    const [h] = s[s.length - 1].split(':').map(Number);
    $('hours-list').replaceChildren(
      el('li', {}, [el('span', { text: 'Every day' }), el('span', { text: `${s[0]} – ${String(h + 1).padStart(2, '0')}:00` })]),
      el('li', {}, [el('span', { text: 'Order ahead' }), el('span', { text: 'today to +2 days' })])
    );
    $('free-del').textContent = state.config.freeDeliveryThreshold;
    $('c-pay').replaceChildren(...state.config.paymentMethods.map((m) => el('option', { value: m, text: m === 'Card' ? 'Card machine' : m })));
  }

  // ---------- menu ----------
  function thumb(p, cls) {
    const img = el('img', { class: cls, src: p.image || '', alt: p.name, loading: 'lazy' });
    img.addEventListener('error', () => {
      img.replaceWith(el('div', { class: cls + ' thumb-fallback', text: p.name, role: 'img', 'aria-label': p.name }));
    }, { once: true });
    return img;
  }

  function renderFilters() {
    const cats = ['All', ...new Set(state.menu.map((p) => p.category))];
    $('filters').replaceChildren(...cats.map((c) => {
      const b = el('button', { class: 'filter-btn' + (c === state.category ? ' active' : ''), type: 'button', text: c, 'aria-pressed': String(c === state.category) });
      b.addEventListener('click', () => { state.category = c; renderFilters(); renderMenu(); });
      return b;
    }));
  }

  function renderMenu() {
    const list = state.menu.filter((p) => state.category === 'All' || p.category === state.category);
    $('catalogue').replaceChildren(...list.map((p) => {
      const btn = el('button', { class: 'add-btn', type: 'button', text: p.available ? 'Add' : 'Sold out' });
      if (p.available) {
        btn.addEventListener('click', () => {
          addToCart(p.id);
          btn.textContent = 'Added'; btn.classList.add('added');
          setTimeout(() => { btn.textContent = 'Add'; btn.classList.remove('added'); }, 900);
        });
      } else { btn.disabled = true; }
      return el('article', { class: 'product-card' + (p.available ? '' : ' soldout') }, [
        thumb(p, 'product-thumb'),
        el('div', { class: 'product-body' }, [
          el('div', { class: 'product-cat', text: p.category }),
          el('div', { class: 'product-name', text: p.name }),
          el('div', { class: 'product-desc', text: p.description || '' }),
          el('div', { class: 'product-foot' }, [el('span', { class: 'product-price', text: money(p.price) }), btn]),
        ]),
      ]);
    }));
  }

  // ---------- cart ----------
  const itemById = (id) => state.menu.find((p) => p.id === Number(id));
  const cartLines = () => Object.entries(state.cart).map(([id, quantity]) => ({ item: itemById(id), quantity })).filter((l) => l.item);
  const selectedZone = () => state.zones.find((z) => z.id === Number($('c-zone').value));

  function totals() {
    const cents = cartLines().reduce((s, l) => s + Math.round(l.item.price * 100) * l.quantity, 0);
    const zone = selectedZone();
    const free = cents === 0 || cents >= state.config.freeDeliveryThreshold * 100;
    const fee = zone && !free ? Math.round(zone.fee * 100) : 0;
    const total = cents + fee;
    const vat = Math.round((total * state.config.vatRate) / (1 + state.config.vatRate));
    return { subtotal: cents / 100, deliveryFee: fee / 100, total: total / 100, vat: vat / 100, hasZone: Boolean(zone) };
  }

  function addToCart(id, delta = 1) {
    const next = (state.cart[id] || 0) + delta;
    if (next <= 0) delete state.cart[id];
    else state.cart[id] = Math.min(next, state.config.maxLineQuantity);
    saveCart(); renderCart();
  }

  function renderCart() {
    const lines = cartLines();
    $('cart-count').textContent = lines.reduce((s, l) => s + l.quantity, 0);
    const body = $('cart-body'); const foot = $('cart-foot');
    if (!lines.length) {
      body.replaceChildren(el('div', { class: 'empty-cart', text: 'Your order is empty.' }));
      foot.replaceChildren();
    } else {
      body.replaceChildren(...lines.map(({ item: p, quantity }) => {
        const minus = el('button', { class: 'qty-btn', type: 'button', 'aria-label': 'Decrease quantity', text: '−' });
        const plus = el('button', { class: 'qty-btn', type: 'button', 'aria-label': 'Increase quantity', text: '+' });
        const rm = el('button', { class: 'remove-link', type: 'button', text: 'Remove' });
        minus.addEventListener('click', () => addToCart(p.id, -1));
        plus.addEventListener('click', () => addToCart(p.id, 1));
        rm.addEventListener('click', () => addToCart(p.id, -quantity));
        return el('div', { class: 'cart-line' }, [
          thumb(p, 'cart-thumb'),
          el('div', { class: 'cart-info' }, [
            el('div', { class: 'name', text: p.name }),
            el('div', { class: 'unit', text: money(p.price) + ' each' }),
            el('div', { class: 'qty-row' }, [minus, el('span', { class: 'qty-val', text: quantity }), plus, rm]),
          ]),
          el('div', { class: 'line-total', text: money(p.price * quantity) }),
        ]);
      }));
      const t = totals();
      const go = el('button', { class: 'btn btn-primary btn-full', type: 'button', text: 'Checkout' });
      go.addEventListener('click', openCheckout);
      foot.replaceChildren(
        el('div', { class: 'totals-row' }, [el('span', { text: 'Food subtotal' }), el('span', { text: money(t.subtotal) })]),
        el('div', { class: 'help', text: 'Delivery fee is added at checkout once you choose where to deliver.' }),
        go
      );
    }
    renderSummary();
  }

  function renderSummary() {
    const lines = cartLines(); const t = totals();
    const row = (k, v, cls = '') => el('div', { class: 'summary-line ' + cls }, [el('span', { text: k }), el('span', { text: v })]);
    $('summary-lines').replaceChildren(
      ...lines.map((l) => row(`${l.item.name} × ${l.quantity}`, money(l.item.price * l.quantity))),
      row('Food subtotal', money(t.subtotal)),
      row('Delivery', !t.hasZone ? '—' : t.deliveryFee === 0 ? 'Free' : money(t.deliveryFee)),
      row('Total to pay', money(t.total), 'grand'),
      el('div', { class: 'help', text: `Includes VAT of ${money(t.vat)}.` })
    );
  }

  function toggleDrawer(open) { $('drawer').classList.toggle('open', open); $('overlay').classList.toggle('open', open); }
  function openCheckout() {
    toggleDrawer(false);
    $('confirmation-section').style.display = 'none';
    $('checkout-section').style.display = 'block';
    $('checkout-section').scrollIntoView({ behavior: 'smooth' });
  }
  $('cart-open').addEventListener('click', () => toggleDrawer(true));
  $('cart-close').addEventListener('click', () => toggleDrawer(false));
  $('overlay').addEventListener('click', () => toggleDrawer(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleDrawer(false); });

  function showMsg(node, text, ok) { node.replaceChildren(text ? el('div', { class: 'alert ' + (ok ? 'alert-ok' : 'alert-error'), text }) : ''); }

  // ---------- zone, day and windows ----------
  function renderZones() {
    $('c-zone').replaceChildren(
      el('option', { value: '', text: 'Choose where to bring it' }),
      ...state.zones.map((z) => el('option', { value: z.id, text: z.areaType === 'Collection' ? `${z.name} (no fee)` : `${z.name} — ${money(z.fee)}` }))
    );
  }
  function onZoneChange() {
    const zone = selectedZone();
    $('address-field').classList.toggle('hidden', Boolean(zone && zone.areaType === 'Collection'));
    renderSummary();
  }
  $('c-zone').addEventListener('change', onZoneChange);

  function renderDays() {
    const days = [];
    for (let i = 0; i <= 2; i += 1) days.push(addDays(state.config.today, i));
    $('c-date').replaceChildren(...days.map((d, i) => el('option', { value: d, text: (i === 0 ? 'Today — ' : i === 1 ? 'Tomorrow — ' : '') + dayLabel(d) })));
  }

  async function loadSlots() {
    const date = $('c-date').value;
    state.slot = null;
    const grid = $('slot-grid'); const help = $('slot-help');
    grid.replaceChildren();
    try {
      const r = await api('/slots?date=' + encodeURIComponent(date));
      const open = r.slots.filter((s) => s.available).length;
      help.textContent = open ? 'Select the hour you want your food.' : 'No windows are open on this day. Please choose another.';
      grid.replaceChildren(...r.slots.map((s) => {
        const b = el('button', { class: 'slot-btn', type: 'button', text: s.time });
        b.disabled = !s.available;
        b.addEventListener('click', () => {
          state.slot = s.time;
          grid.querySelectorAll('.slot-btn').forEach((x) => x.classList.toggle('selected', x === b));
        });
        return b;
      }));
    } catch (err) { help.textContent = err.message; }
  }
  $('c-date').addEventListener('change', loadSlots);

  $('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('c-msg'); const btn = $('c-submit');
    const items = cartLines().map((l) => ({ itemId: l.item.id, quantity: l.quantity }));
    if (!items.length) return showMsg(msg, 'Your order is empty.', false);
    if (!$('c-zone').value) return showMsg(msg, 'Choose where we should bring your food.', false);
    if (!state.slot) return showMsg(msg, 'Choose a time window.', false);
    btn.disabled = true; showMsg(msg, '', true);
    try {
      const r = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName: $('c-name').value, phone: $('c-phone').value, email: $('c-email').value,
          studentNo: $('c-student').value, zoneId: Number($('c-zone').value), address: $('c-address').value,
          date: $('c-date').value, slot: state.slot, paymentMethod: $('c-pay').value, notes: $('c-notes').value, items,
        }),
      });
      state.cart = {}; saveCart(); renderCart();
      $('order-ref').textContent = r.orderRef;
      $('order-when').textContent = `${r.fulfilment === 'Collection' ? 'Ready for collection' : 'Delivery'} on ${dayLabel(r.date)}, ${r.slot} window.`;
      $('order-total').textContent = `Please pay ${money(r.total)} (includes VAT of ${money(r.vatIncluded)}).`;
      $('checkout-section').style.display = 'none';
      $('confirmation-section').style.display = 'block';
      $('checkout-form').reset(); onZoneChange(); loadSlots();
      $('confirmation-section').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      showMsg(msg, err.message, false);
      loadSlots();
    } finally { btn.disabled = false; }
  });

  // ---------- start ----------
  async function init() {
    $('year').textContent = new Date().getFullYear();
    loadCart();
    try {
      const [config, zones, menu] = await Promise.all([api('/config'), api('/zones'), api('/menu')]);
      state.config = config; state.zones = zones; state.menu = menu;
    } catch (err) {
      $('catalogue').replaceChildren(el('div', { class: 'alert alert-error', text: 'Could not load the menu: ' + err.message }));
      return;
    }
    renderHours(); renderZones(); renderDays(); renderFilters(); renderMenu(); renderCart(); loadSlots();
  }
  init();
})();
