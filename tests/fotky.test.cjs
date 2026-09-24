const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { File } = require('node:buffer');
const source = readFileSync(require.resolve('../fotky.js'), 'utf8');

function fixture({ supported = true, files = [] } = {}) {
  const handlers = new Map();
  const inputHandlers = new Map();
  const form = {
    addEventListener(type, handler) { handlers.set(type, handler); }
  };
  if (supported) form.onformdata = null;
  const status = { textContent: 'Jedna fotka; více e-mailem nebo přes WhatsApp.' };
  const input = {
    form, name: 'attachment', files, multiple: false, validityMessage: '', attrs: {},
    addEventListener(type, handler) { inputHandlers.set(type, handler); },
    setCustomValidity(message) { this.validityMessage = message; },
    setAttribute(name, value) { this.attrs[name] = value; },
    reportValidity() { this.reported = true; }
  };
  runInNewContext(source, {
    document: { getElementById(id) { return id === 'fotky' ? input : status; } },
    File, queueMicrotask
  });
  return {
    input, status, handlers,
    select(files) { input.files = files; inputHandlers.get('change')(); },
    payload(files = input.files) {
      const data = new FormData();
      data.append('Jméno', 'Test');
      data.append('Zpráva', 'Renovace');
      data.append('_next', 'https://krotitelenabytku.cz/dekujeme/');
      for (const file of files) data.append(input.name, file);
      handlers.get('formdata')?.({ formData: data });
      return data;
    }
  };
}

test('several photos have distinct multipart keys, unchanged names and content', async () => {
  const files = [new File(['first photo'], 'židle.jpg'), new File(['second photo'], 'detail.png')];
  const f = fixture({ files });
  const data = f.payload();
  assert.equal(f.input.multiple, true);
  assert.deepEqual([...data.keys()], ['Jméno', 'Zpráva', '_next', 'attachment_1', 'attachment_2']);
  assert.equal(data.get('attachment_1').name, 'židle.jpg');
  assert.equal(await data.get('attachment_1').text(), 'first photo');
  assert.equal(await data.get('attachment_2').text(), 'second photo');
  assert.equal(data.get('Zpráva'), 'Renovace');
  assert.equal(data.get('_next'), 'https://krotitelenabytku.cz/dekujeme/');
  // Serialize a real multipart body locally; this does not send a request.
  const body = await new Request('http://localhost/', { method: 'POST', body: data }).text();
  assert.match(body, /name="attachment_1"; filename="židle.jpg"/);
  assert.match(body, /name="attachment_2"; filename="detail.png"/);
  assert.match(f.status.textContent, /Počet vybraných fotek: 2/);
});

test('one photo works and two photos with the same filename are not deduplicated', () => {
  const photo = new File(['photo'], 'image.jpg');
  const f = fixture();
  assert.equal(f.payload([photo]).get('attachment_1').name, 'image.jpg');
  assert.deepEqual([...f.payload([photo, photo]).keys()].filter(k => k.startsWith('attachment')), ['attachment_1', 'attachment_2']);
});

test('no selection omits the browser empty-file placeholder', () => {
  const f = fixture();
  const data = f.payload([new File([], '')]);
  assert.deepEqual([...data.keys()], ['Jméno', 'Zpráva', '_next']);
  assert.equal(f.input.validityMessage, '');
});

test('combined limit accepts exactly 10 MB and blocks one byte over', () => {
  const f = fixture();
  f.select([{ size: 5_000_000 }, { size: 5_000_000 }]);
  assert.equal(f.input.validityMessage, '');
  f.select([{ size: 5_000_000 }, { size: 5_000_001 }]);
  assert.match(f.input.validityMessage, /Limit je 10 MB/);
  assert.equal(f.input.attrs['aria-invalid'], 'true');
  let prevented = false;
  let stopped = false;
  f.handlers.get('submit')({
    preventDefault() { prevented = true; },
    stopImmediatePropagation() { stopped = true; }
  });
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(f.input.reported, true);
  f.select([{ size: 50 }]);
  assert.equal(f.input.validityMessage, '');
  assert.equal(f.input.attrs['aria-invalid'], 'false');
  f.handlers.get('submit')({ preventDefault() { assert.fail('valid submission blocked'); } });
});

test('selecting again replaces the previous batch; clearing removes the error', () => {
  const f = fixture({ files: [new File(['old'], 'old.jpg')] });
  f.select([new File(['new'], 'new.jpg')]);
  assert.equal(f.payload().get('attachment_1').name, 'new.jpg');
  assert.equal(f.payload().has('attachment_2'), false);
  f.select([{ size: 11_000_000 }]);
  f.select([]);
  assert.equal(f.input.validityMessage, '');
  assert.match(f.status.textContent, /Můžete vybrat více/);
});

test('restored selections are checked at load and on submit; reset clears feedback', async () => {
  const f = fixture({ files: [{ size: 11_000_000 }] });
  assert.match(f.input.validityMessage, /Limit je 10 MB/);
  f.handlers.get('reset')();
  f.input.files = [];
  await Promise.resolve();
  assert.equal(f.input.validityMessage, '');
  f.input.files = [{ size: 11_000_000 }];
  let prevented = false;
  f.handlers.get('submit')({ preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
  assert.equal(prevented, true);
});

test('without formdata support only one native attachment is offered', () => {
  const f = fixture({ supported: false });
  assert.equal(f.input.multiple, false);
  assert.equal(f.handlers.has('formdata'), false);
  assert.match(f.status.textContent, /Jedna fotka/);
  const photo = new File(['single'], 'single.jpg');
  assert.equal(f.payload([photo]).get('attachment').name, 'single.jpg');
});

test('HTML loads attachment handling before analytics and has single-file no-JS fallback', () => {
  const html = readFileSync(require.resolve('../kontakt/index.html'), 'utf8');
  const input = html.match(/<input\b[^>]*id="fotky"[^>]*>/)[0];
  assert.match(input, /name="attachment"/);
  assert.doesNotMatch(input, /\bmultiple\b/);
  assert.ok(html.indexOf('/fotky.js') < html.indexOf('/analytics.js'));
  assert.match(html, /enctype="multipart\/form-data"/);
});
