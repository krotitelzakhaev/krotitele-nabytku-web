/* GA4 basic consent: no Google request before affirmative consent. */
(() => {
  'use strict';
  const ID = 'G-2W33CPWDF5';
  const KEY = 'kn_consent_v2';
  const LEGACY = 'kn_consent_v1';
  const PENDING = 'kn_form_pending';
  const DAYS = 180;
  const production = ['krotitelenabytku.cz', 'www.krotitelenabytku.cz'].includes(location.hostname);
  let active = false;
  let started = false;
  let startedWith = '';
  let expiryTimer;
  let returnFocus;
  const panel = document.getElementById('cookie-panel');
  const status = document.getElementById('cookie-status');

  function cookie(key) {
    const value = document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith(key + '='));
    return value ? value.slice(key.length + 1) : '';
  }
  function consent() {
    const value = cookie(KEY);
    if (['all', 'analytics', 'denied'].includes(value)) return value;
    // An earlier analytics-only consent never grants advertising consent.
    return cookie(LEGACY) === 'granted' ? 'analytics' : cookie(LEGACY) === 'denied' ? 'denied' : '';
  }
  function analyticsAllowed() { return ['all', 'analytics'].includes(consent()); }
  function signals(value) {
    return {
      analytics_storage: ['all', 'analytics'].includes(value) ? 'granted' : 'denied',
      ad_storage: value === 'all' ? 'granted' : 'denied',
      ad_user_data: value === 'all' ? 'granted' : 'denied',
      ad_personalization: 'denied'
    };
  }
  function describe(value) {
    return value === 'all' ? 'Analytika a měření reklam jsou povolené.' :
      value === 'analytics' ? 'Povolená je pouze analytika, měření reklam je odmítnuté.' :
      value === 'denied' ? 'Volitelné cookies jsou odmítnuté.' : 'Volitelné cookies zatím nejsou povolené.';
  }
  function pageLocation() {
    const url = new URL(location.origin + location.pathname);
    const query = new URLSearchParams(location.search);
    // Keep campaign labels, never form fields, arbitrary query keys or fragments.
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_content', 'utm_term']) {
      const value = query.get(key);
      if (value && /^[\p{L}\p{N} ._~+()\-]{1,150}$/u.test(value)) url.searchParams.set(key, value);
    }
    // Google Ads auto-tagging must survive page_location sanitization, but only
    // for visitors who explicitly allowed advertising measurement.
    if (consent() === 'all') {
      for (const key of ['gclid', 'gbraid', 'wbraid']) {
        const value = query.get(key);
        if (value && /^[A-Za-z0-9._~\-]{1,512}$/.test(value)) url.searchParams.set(key, value);
      }
    }
    return url.href;
  }
  function clearAnalytics() {
    for (const part of document.cookie.split(';')) {
      const name = part.trim().split('=')[0];
      if (!/^_(?:ga(?:_|$)|gcl_)/.test(name)) continue;
      for (const domain of ['', location.hostname, 'krotitelenabytku.cz']) {
        document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Lax' + (domain ? '; Domain=' + domain : '');
      }
    }
    try { sessionStorage.removeItem(PENDING); } catch (_) { /* Storage may be blocked. */ }
  }
  function emit(name, params = {}) {
    if (active && analyticsAllowed()) window.gtag('event', name, params);
  }
  function leadType() {
    const field = document.getElementById('duvod');
    const types = {
      'Renovace vlastního nábytku': 'renovace',
      'Louhování nábytku': 'louhovani',
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
          ['renovace', 'louhovani', 'vykup', 'koupe', 'hledani', 'ostatni'].includes(pending.type)) {
        emit('generate_lead', { lead_type: pending.type, method: 'form' });
      }
    } catch (_) { /* A direct visit or unavailable storage is not a lead. */ }
  }
  function start() {
    if (started || !production || !analyticsAllowed()) return;
    started = true;
    startedWith = consent();
    active = true;
    window['ga-disable-' + ID] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', signals('denied'));
    window.gtag('consent', 'update', signals(startedWith));
    window.gtag('set', 'ads_data_redaction', true);
    window.gtag('js', new Date());
    let referrer = '';
    try { referrer = new URL(document.referrer).origin + '/'; } catch (_) { /* Direct visit. */ }
    const config = {
      send_page_view: false,
      page_location: pageLocation(),
      page_referrer: referrer,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: DAYS * 86400,
      cookie_update: false,
      cookie_flags: 'SameSite=Lax;Secure'
    };
    // GA4 reads the retained UTM labels, including the actual paid medium (cpc).
    // Keep the historical default only for known profiles without utm_medium.
    const campaign = new URL(config.page_location).searchParams;
    const source = campaign.get('utm_source');
    if (!campaign.has('utm_medium') && ['firmy.cz', 'firmy', 'google_business', 'instagram', 'facebook'].includes(source)) {
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
      if (consent() !== startedWith) stop();
    }, 1000);
  }
  function stop() {
    active = false;
    window['ga-disable-' + ID] = true;
    window.clearInterval(expiryTimer);
    if (started) window.gtag('consent', 'update', signals(consent()));
    clearAnalytics();
    // Unload Google's runtime too, so no automatic events survive withdrawal.
    if (started) location.reload();
  }
  function choose(value) {
    document.cookie = KEY + '=' + value + '; Max-Age=' + DAYS * 86400 + '; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    document.cookie = LEGACY + '=; Max-Age=0; Path=/; SameSite=Lax';
    panel.hidden = true;
    if (status) status.textContent = describe(value);
    if (started && value !== startedWith) stop();
    else if (analyticsAllowed()) start(); else stop();
    returnFocus?.focus();
  }
  document.querySelectorAll('[data-cookie-open]').forEach(button => button.addEventListener('click', () => {
    returnFocus = button;
    panel.hidden = false;
    panel.querySelector('button').focus();
  }));
  panel.querySelector('[data-cookie-accept-all]')?.addEventListener('click', () => choose('all'));
  panel.querySelector('[data-cookie-analytics]')?.addEventListener('click', () => choose('analytics'));
  // Cached old HTML promises only analytics: its old Accept button keeps that scope.
  panel.querySelector('[data-cookie-accept]')?.addEventListener('click', () => choose('analytics'));
  panel.querySelector('[data-cookie-reject]')?.addEventListener('click', () => choose('denied'));
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
    if (!active || !analyticsAllowed()) return;
    const type = leadType();
    emit('lead_form_submit', { lead_type: type });
    try { sessionStorage.setItem(PENDING, JSON.stringify({ time: Date.now(), type })); } catch (_) { /* Do not interfere with submission. */ }
  });
  const value = consent();
  panel.hidden = ['all', 'analytics', 'denied'].includes(cookie(KEY)) || value === 'denied';
  if (status) status.textContent = describe(value);
  if (analyticsAllowed()) start(); else clearAnalytics();
})();
