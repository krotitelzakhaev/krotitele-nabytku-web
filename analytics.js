/* GA4 basic consent: no Google request before affirmative consent. */
(() => {
  'use strict';
  const ID = 'G-2W33CPWDF5';
  const KEY = 'kn_consent_v1';
  const PENDING = 'kn_form_pending';
  const DAYS = 180;
  const production = ['krotitelenabytku.cz', 'www.krotitelenabytku.cz'].includes(location.hostname);
  let active = false;
  let started = false;
  let expiryTimer;
  let returnFocus;
  const panel = document.getElementById('cookie-panel');
  const status = document.getElementById('cookie-status');

  function consent() {
    const value = document.cookie.split('; ').find(item => item.startsWith(KEY + '='));
    return value ? value.slice(KEY.length + 1) : '';
  }
  function clearAnalytics() {
    for (const part of document.cookie.split(';')) {
      const name = part.trim().split('=')[0];
      if (!/^_ga(?:_|$)/.test(name)) continue;
      for (const domain of ['', location.hostname, 'krotitelenabytku.cz']) {
        document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Lax' + (domain ? '; Domain=' + domain : '');
      }
    }
    try { sessionStorage.removeItem(PENDING); } catch (_) { /* Storage may be blocked. */ }
  }
  function emit(name, params = {}) {
    if (active && consent() === 'granted') window.gtag('event', name, params);
  }
  function leadType() {
    const field = document.getElementById('duvod');
    const types = {
      'Renovace vlastního nábytku': 'renovace',
      'Nabízím nábytek k výkupu nebo odvozu': 'vykup',
      'Chci koupit / rezervovat kus z nabídky': 'koupe',
      'Sháním konkrétní kus': 'hledani',
      'Něco jiného': 'ostatni'
    };
    return types[field?.value] || 'ostatni';
  }
  function completedForm() {
    if (location.pathname !== '/dekujeme/' || !active) return;
    try {
      const pending = JSON.parse(sessionStorage.getItem(PENDING));
      sessionStorage.removeItem(PENDING);
      if (pending && Date.now() - pending.time >= 0 && Date.now() - pending.time < 30 * 60 * 1000 &&
          ['renovace', 'vykup', 'koupe', 'hledani', 'ostatni'].includes(pending.type)) {
        emit('generate_lead', { lead_type: pending.type, method: 'form' });
      }
    } catch (_) { /* A direct visit or unavailable storage is not a lead. */ }
  }
  function start() {
    if (started || !production || consent() !== 'granted') return;
    started = true;
    active = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied'
    });
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('js', new Date());
    let referrer = '';
    try { referrer = new URL(document.referrer).origin + '/'; } catch (_) { /* Direct visit. */ }
    const config = {
      send_page_view: false,
      page_location: location.origin + location.pathname,
      page_referrer: referrer,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: DAYS * 86400,
      cookie_update: false,
      cookie_flags: 'SameSite=Lax;Secure'
    };
    // Only recognized campaign labels; never forward arbitrary query parameters.
    const source = new URLSearchParams(location.search).get('utm_source');
    if (['firmy.cz', 'firmy', 'google_business', 'google', 'instagram', 'facebook'].includes(source)) {
      config.campaign_source = source;
      config.campaign_medium = ['instagram', 'facebook'].includes(source) ? 'social' : 'referral';
    }
    window.gtag('config', ID, config);
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(script);
    emit('page_view', { page_location: config.page_location, page_referrer: referrer });
    completedForm();
    expiryTimer = window.setInterval(() => {
      if (consent() !== 'granted') stop();
    }, 1000);
  }
  function stop() {
    active = false;
    window['ga-disable-' + ID] = true;
    window.clearInterval(expiryTimer);
    clearAnalytics();
    // Unload Google's runtime too, so no automatic events survive withdrawal.
    if (started) location.reload();
  }
  function choose(value) {
    document.cookie = KEY + '=' + value + '; Max-Age=' + DAYS * 86400 + '; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    panel.hidden = true;
    if (status) status.textContent = value === 'granted' ? 'Analytické cookies jsou povolené.' : 'Analytické cookies jsou odmítnuté.';
    if (value === 'granted') start(); else stop();
    returnFocus?.focus();
  }
  document.querySelectorAll('[data-cookie-open]').forEach(button => button.addEventListener('click', () => {
    returnFocus = button;
    panel.hidden = false;
    panel.querySelector('button').focus();
  }));
  panel.querySelector('[data-cookie-accept]').addEventListener('click', () => choose('granted'));
  panel.querySelector('[data-cookie-reject]').addEventListener('click', () => choose('denied'));
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    let method;
    if (href.startsWith('tel:')) method = 'phone';
    else if (href.startsWith('mailto:')) method = 'email';
    else if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href)) method = 'whatsapp';
    if (method) emit('contact_click', { method, page_path: location.pathname });
    else if (href.startsWith('/renovace/')) emit('view_renovation_click', { page_path: location.pathname });
  });
  const form = document.querySelector('form.formular');
  form?.addEventListener('submit', () => {
    if (!active || consent() !== 'granted') return;
    const type = leadType();
    emit('lead_form_submit', { lead_type: type });
    try { sessionStorage.setItem(PENDING, JSON.stringify({ time: Date.now(), type })); } catch (_) { /* Do not interfere with submission. */ }
  });
  const value = consent();
  panel.hidden = value === 'granted' || value === 'denied';
  if (status) status.textContent = value === 'granted' ? 'Analytické cookies jsou povolené.' : value === 'denied' ? 'Analytické cookies jsou odmítnuté.' : 'Analytické cookies zatím nejsou povolené.';
  if (value === 'granted') start(); else clearAnalytics();
})();
