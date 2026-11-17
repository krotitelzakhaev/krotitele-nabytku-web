const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const source = readFileSync(require.resolve('../analytics.js'), 'utf8');
const ID = 'G-2W33CPWDF5';

function fixture({ cookies = {}, url = 'https://krotitelenabytku.cz/kontakt/', pending, oldMarkup = false } = {}) {
  const jar = new Map(Object.entries(cookies)), storage = new Map(), scripts = [], handlers = new Map();
  if (pending) storage.set('kn_form_pending', JSON.stringify(pending));
  const node = () => ({ hidden: true, textContent: '', handlers: {}, addEventListener(t, h) { this.handlers[t] = h; }, focus() { this.focused = true; } });
  const buttons = Object.fromEntries((oldMarkup ? ['accept', 'reject'] : ['accept-all', 'analytics', 'reject']).map(k => [k, node()]));
  const panel = node(), status = node(), opener = node(), form = node(), field = { value: 'Renovace vlastního nábytku' };
  panel.querySelector = s => s === 'button' ? Object.values(buttons)[0] : buttons[s.slice(13, -1)];
  const doc = {
    referrer: 'https://www.google.com/search?q=private',
    get cookie() { return [...jar].map(([k, v]) => k + '=' + v).join('; '); },
    set cookie(s) { const [part, ...attrs] = s.split(';'); const i = part.indexOf('='); const k = part.slice(0, i); if (attrs.some(a => /Max-Age=0/.test(a))) jar.delete(k); else jar.set(k, part.slice(i + 1)); },
    getElementById: id => ({ 'cookie-panel': panel, 'cookie-status': status, duvod: field })[id],
    querySelectorAll: () => [opener], querySelector: () => form,
    addEventListener: (t, h) => handlers.set(t, h), createElement: () => ({}),
    head: { appendChild(s) { scripts.push({ ...s, commands: win.dataLayer.map(a => [...a]) }); } }
  };
  const loc = new URL(url); loc.reload = () => { loc.reloads = (loc.reloads || 0) + 1; };
  let tick;
  const win = { setInterval(h) { tick = h; return 1; }, clearInterval() { tick = null; } };
  runInNewContext(source, { document: doc, location: loc, window: win, URL, URLSearchParams, Date,
    sessionStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) } });
  return {
    jar, storage, scripts, panel, status, win, loc, opener, form, field,
    click: k => buttons[k].handlers.click(), tick: () => tick?.(),
    link(href) { handlers.get('click')({ target: { closest: () => ({ getAttribute: () => href }) } }); },
    commands: () => (win.dataLayer || []).map(a => [...a]),
    events: name => (win.dataLayer || []).filter(a => a[0] === 'event' && (!name || a[1] === name)),
    config: () => win.dataLayer.find(a => a[0] === 'config')[2]
  };
}

test('new visitor and rejection never load Google; accepting later works', () => {
  const f = fixture(); assert.equal(f.scripts.length, 0); assert.equal(f.panel.hidden, false);
  f.link('mailto:private@example.com'); f.form.handlers.submit(); assert.equal(f.events().length, 0); assert.equal(f.storage.size, 0);
  f.click('reject'); assert.equal(f.scripts.length, 0); assert.equal(f.jar.get('kn_consent_v2'), 'denied');
  f.opener.handlers.click(); assert.equal(f.panel.hidden, false);
  f.click('accept-all'); assert.equal(f.scripts.length, 1); assert.equal(f.win['ga-disable-' + ID], false);
  f.click('accept-all'); assert.equal(f.scripts.length, 1); assert.equal(f.events('page_view').length, 1);
});

test('all three choices send only the permissions actually selected, before loading Google', () => {
  for (const choice of ['analytics', 'accept-all']) {
    const f = fixture(); f.click(choice); const commands = f.scripts[0].commands;
    const defaults = commands.find(a => a[0] === 'consent' && a[1] === 'default')[2];
    assert.ok(Object.values(defaults).every(v => v === 'denied'));
    const flags = commands.find(a => a[0] === 'consent' && a[1] === 'update')[2];
    assert.equal(flags.analytics_storage, 'granted'); assert.equal(flags.ad_personalization, 'denied');
    assert.equal(flags.ad_storage, choice === 'accept-all' ? 'granted' : 'denied'); assert.equal(flags.ad_user_data, flags.ad_storage);
    assert.equal(f.config().allow_google_signals, false); assert.equal(f.config().allow_ad_personalization_signals, false);
  }
});

test('legacy acceptance and cached markup never silently grant advertising consent', () => {
  const f = fixture({ cookies: { kn_consent_v1: 'granted' } });
  assert.equal(f.scripts.length, 1); assert.equal(f.panel.hidden, false);
  assert.equal(f.commands().find(a => a[0] === 'consent' && a[1] === 'update')[2].ad_user_data, 'denied');
  const denied = fixture({ cookies: { kn_consent_v1: 'denied' } }); assert.equal(denied.panel.hidden, true); assert.equal(denied.scripts.length, 0);
  const cached = fixture({ oldMarkup: true }); cached.click('accept'); assert.equal(cached.jar.get('kn_consent_v2'), 'analytics');
  const newer = fixture({ cookies: { kn_consent_v1: 'granted', kn_consent_v2: 'denied' } }); assert.equal(newer.scripts.length, 0);
});

test('Google and Seznam campaign labels survive; private fields, fragments and malformed labels do not', () => {
  for (const provider of ['google', 'seznam']) {
    const f = fixture({ cookies: { kn_consent_v2: 'all' }, url: `https://krotitelenabytku.cz/renovace/?utm_source=${provider}&utm_medium=cpc&utm_campaign=Renovace+2.0&gclid=Test_A-1&gbraid=test.B&email=private%40example.com&zprava=tajne#formular` });
    const q = new URL(f.config().page_location); assert.equal(q.searchParams.get('utm_medium'), 'cpc'); assert.equal(q.searchParams.get('utm_source'), provider);
    assert.equal(q.searchParams.get('gclid'), 'Test_A-1'); assert.equal(q.searchParams.get('gbraid'), 'test.B');
    assert.equal(q.hash, ''); assert.equal(q.searchParams.has('email'), false); assert.equal(q.searchParams.has('zprava'), false);
    assert.equal(f.config().campaign_medium, undefined); assert.equal(f.config().page_referrer, 'https://www.google.com/');
  }
  const f = fixture({ cookies: { kn_consent_v2: 'analytics' }, url: 'https://krotitelenabytku.cz/?gclid=click&gbraid=click&wbraid=click&utm_campaign=x%40example.com' });
  assert.equal(f.config().page_location, 'https://krotitelenabytku.cz/');
});

test('withdrawal stops custom events, clears only measurement cookies/storage, and reloads', () => {
  const f = fixture({ cookies: { kn_consent_v2: 'all', _ga: 'x', _ga_2W33CPWDF5: 'y', _gcl_aw: 'ad', unrelated: 'keep' } });
  f.form.handlers.submit(); assert.ok(f.storage.has('kn_form_pending'));
  f.click('reject'); assert.equal(f.loc.reloads, 1); assert.equal(f.win['ga-disable-' + ID], true);
  assert.equal(f.jar.get('unrelated'), 'keep'); assert.equal(f.jar.has('_ga'), false); assert.equal(f.jar.has('_gcl_aw'), false); assert.equal(f.storage.size, 0);
  const before = f.events().length; f.link('https://wa.me/420608207307'); assert.equal(f.events().length, before);
  assert.equal(f.commands().at(-1)[2].ad_user_data, 'denied');
});

test('downgrade and cookie expiry immediately stop existing tracking', () => {
  const f = fixture({ cookies: { kn_consent_v2: 'all' } }); f.click('analytics'); assert.equal(f.loc.reloads, 1);
  assert.equal(f.commands().at(-1)[2].analytics_storage, 'granted'); assert.equal(f.commands().at(-1)[2].ad_storage, 'denied');
  const expired = fixture({ cookies: { kn_consent_v2: 'analytics' } }); expired.jar.clear(); expired.tick(); assert.equal(expired.loc.reloads, 1);
});

test('contacts report method only, not email/phone/message; no false form lead', () => {
  const f = fixture({ cookies: { kn_consent_v2: 'all' } });
  f.link('mailto:private@example.com?body=private'); f.link('https://wa.me/420608207307?text=private'); f.link('tel:+420608207307');
  assert.deepEqual(Array.from(f.events('contact_click'), a => a[2].method), ['email', 'whatsapp', 'phone']);
  assert.ok(!JSON.stringify(f.events()).includes('private')); assert.equal(f.events('generate_lead').length, 0);
  f.form.handlers.submit(); assert.equal(f.events('lead_form_submit').length, 1); assert.equal(JSON.parse(f.storage.get('kn_form_pending')).type, 'renovace');
});

test('thank-you requires a recent pending submit and consumes it once', () => {
  const base = { cookies: { kn_consent_v2: 'all' }, url: 'https://krotitelenabytku.cz/dekujeme/' };
  assert.equal(fixture(base).events('generate_lead').length, 0);
  const f = fixture({ ...base, pending: { type: 'renovace', time: Date.now() - 10000 } });
  assert.equal(f.events('generate_lead').length, 1); assert.equal(f.storage.size, 0); f.click('accept-all'); assert.equal(f.events('generate_lead').length, 1);
  assert.equal(fixture({ ...base, pending: { type: 'renovace', time: Date.now() - 31 * 60000 } }).events('generate_lead').length, 0);
});

test('local previews and non-production hosts never load Google, even after acceptance', () => {
  for (const url of ['http://127.0.0.1:8785/', 'https://example.org/']) {
    const f = fixture({ url }); f.click('accept-all'); f.link('mailto:test@example.com'); assert.equal(f.scripts.length, 0); assert.equal(f.events().length, 0);
  }
});
