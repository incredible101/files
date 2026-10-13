// public/js/admin.js — kitchen dashboard. Every request carries a JWT; the
// server enforces access, this page only presents the data.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const money = (n) => 'R' + Number(n).toFixed(2);
  const el = (tag, props = {}, children = []) => {
    const n = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v); });
    children.forEach((c) => n.append(c));
    return n;
  };

  let token = null;
  try { token = sessionStorage.getItem('campusbite-token'); } catch (e) { /* ignore */ }

  async function api(path, options = {}) {
    const res = await fetch('/api' + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    });
    const data = res.status === 204 ? null : await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/auth/login') { logout(); throw new Error('Your session expired. Please sign in again.'); }
    if (!res.ok) throw new Error((data && data.error) || 'Request failed.');
    return data;
  }

  const flash = (text, ok) => $('msg').replaceChildren(text ? el('div', { class: 'alert ' + (ok ? 'alert-ok' : 'alert-error'), text }) : '');

  function showDash(on) {
    $('login-view').classList.toggle('hidden', on);
    $('dash-view').classList.toggle('hidden', !on);
    $('logout').classList.toggle('hidden', !on);
  }
  function logout() {
    token = null;
    try { sessionStorage.removeItem('campusbite-token'); } catch (e) { /* ignore */ }
    showDash(false);
  }
  $('logout').addEventListener('click', logout);

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: $('l-user').value, password: $('l-pass').value }) });
      token = r.token;
      try { sessionStorage.setItem('campusbite-token', token); } catch (err) { /* ignore */ }
      $('l-pass').value = ''; $('l-msg').replaceChildren();
      await start();
    } catch (err) { $('l-msg').replaceChildren(el('div', { class: 'alert alert-error', text: err.message })); }
  });

  // ---------- orders ----------
  async function loadStats() {
    const s = await api('/orders/stats');
    $('s-orders').textContent = s.orders; $('s-placed').textContent = s.placed;
    $('s-preparing').textContent = s.preparing; $('s-revenue').textContent = money(s.revenue);
  }

  const NEXT = { Placed: 'Preparing', Preparing: 'Ready', Ready: 'Delivered' };
  const NEXT_LABEL = (o) => ({ Placed: 'Start preparing', Preparing: 'Mark ready', Ready: o.areaType === 'Collection' ? 'Mark collected' : 'Mark delivered' });

  async function changeOrder(id, status) {
    try { await api('/orders/' + id, { method: 'PATCH', body: JSON.stringify({ status }) }); flash('', true); await refreshOrders(); }
    catch (err) { flash(err.message, false); }
  }

  function orderRow(o) {
    const actions = el('div', { class: 'row-actions' });
    if (NEXT[o.status]) {
      const b = el('button', { class: 'admin-btn confirm', type: 'button', text: NEXT_LABEL(o)[o.status] });
      b.addEventListener('click', () => changeOrder(o.id, NEXT[o.status]));
      actions.append(b);
    }
    if (['Placed', 'Preparing', 'Ready'].includes(o.status)) {
      const c = el('button', { class: 'admin-btn cancel', type: 'button', text: 'Cancel' });
      c.addEventListener('click', () => { if (confirm('Cancel this order?')) changeOrder(o.id, 'Cancelled'); });
      actions.append(c);
    }
    const where = o.areaType === 'Collection' ? 'Collection' : `${o.zone}: ${o.address}`;
    return el('div', { class: 'order-row' }, [
      el('div', { class: 'order-head' }, [
        el('div', { class: 'row-when' }, [el('strong', { text: o.slot }), el('span', { text: o.date })]),
        el('div', { style: 'flex:1;min-width:220px' }, [
          el('div', { class: 'row-name', text: `${o.ref} — ${o.customerName}` }),
          el('div', { class: 'row-meta', text: `${o.phone}${o.studentNo ? ' · ' + o.studentNo : ''} · ${where} · pays by ${o.paymentMethod}` }),
          ...(o.notes ? [el('div', { class: 'row-meta', text: 'Note: ' + o.notes })] : []),
        ]),
        el('span', { class: 'status-badge status-' + o.status.toLowerCase(), text: o.status }),
        actions,
      ]),
      el('ul', { class: 'order-items' }, [
        ...o.items.map((i) => el('li', {}, [el('span', { text: `${i.quantity} × ${i.name}` }), el('span', { text: money(i.unitPrice * i.quantity) })])),
        ...(o.deliveryFee ? [el('li', {}, [el('span', { text: 'Delivery' }), el('span', { text: money(o.deliveryFee) })])] : []),
        el('li', {}, [el('strong', { text: 'Total (incl. VAT)' }), el('strong', { text: money(o.total) })]),
      ]),
    ]);
  }

  async function refreshOrders() {
    const q = new URLSearchParams();
    if ($('f-date').value) q.set('date', $('f-date').value);
    if ($('f-status').value) q.set('status', $('f-status').value);
    const [rows] = await Promise.all([api('/orders' + (q.toString() ? '?' + q : '')), loadStats()]);
    $('orders').replaceChildren(...(rows.length ? rows.map(orderRow) : [el('div', { class: 'empty-state', text: 'No orders to show.' })]));
  }
  const reload = () => refreshOrders().catch((e) => flash(e.message, false));
  $('f-date').addEventListener('change', reload);
  $('f-status').addEventListener('change', reload);
  $('f-all').addEventListener('click', () => { $('f-date').value = ''; reload(); });

  // ---------- menu availability ----------
  async function refreshMenu() {
    const rows = await api('/admin/menu');
    $('menu-list').replaceChildren(...rows.map((m) => {
      const b = el('button', { class: 'admin-btn ' + (m.available ? 'cancel' : 'confirm'), type: 'button', text: m.available ? 'Mark sold out' : 'Back on sale' });
      b.addEventListener('click', async () => {
        try { await api('/admin/menu/' + m.id, { method: 'PATCH', body: JSON.stringify({ available: !m.available }) }); flash('', true); await refreshMenu(); }
        catch (err) { flash(err.message, false); }
      });
      return el('div', { class: 'menu-row' }, [
        el('div', {}, [el('strong', { text: m.name }), el('span', { class: 'help', text: ` · ${m.category} · ${money(m.price)}` })]),
        el('div', { class: 'row-actions' }, [
          ...(m.available ? [] : [el('span', { class: 'sold-tag', text: 'Sold out' })]), b,
        ]),
      ]);
    }));
  }

  // ---------- tabs ----------
  function tab(which) {
    $('tab-orders').classList.toggle('active', which === 'orders');
    $('tab-menu').classList.toggle('active', which === 'menu');
    $('panel-orders').classList.toggle('hidden', which !== 'orders');
    $('panel-menu').classList.toggle('hidden', which !== 'menu');
    flash('', true);
    (which === 'orders' ? refreshOrders() : refreshMenu()).catch((e) => flash(e.message, false));
  }
  $('tab-orders').addEventListener('click', () => tab('orders'));
  $('tab-menu').addEventListener('click', () => tab('menu'));

  async function start() {
    showDash(true);
    try {
      const cfg = await fetch('/api/config').then((r) => r.json());
      $('f-date').value = cfg.today;
      await refreshOrders();
    } catch (err) { flash(err.message, false); }
  }
  if (token) start();
})();
