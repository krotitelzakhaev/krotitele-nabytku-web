/* Keep native FormSubmit delivery; send every photo under a distinct field name. */
(() => {
  'use strict';
  const input = document.getElementById('fotky');
  const status = document.getElementById('fotky-stav');
  const form = input?.form;
  if (!input || !status || !form) return;

  // Decimal MB is deliberately conservative against the service's 10 MB limit.
  const maxBytes = 10_000_000;
  const canSplit = 'onformdata' in form;
  // Without this API (or JS), keep a working single-file native fallback.
  input.multiple = canSplit;
  const hint = canSplit
    ? 'Můžete vybrat více fotek najednou, celkem nejvýše 10 MB.'
    : status.textContent;

  function validate() {
    const files = Array.from(input.files || []);
    const bytes = files.reduce((total, file) => total + file.size, 0);
    const size = (bytes / 1_000_000).toLocaleString('cs-CZ', { maximumFractionDigits: 2 });
    const error = bytes > maxBytes
      ? 'Fotky mají dohromady ' + size + ' MB. Limit je 10 MB. Vyberte méně nebo menší fotky; větší dávku pošlete e-mailem nebo přes WhatsApp.'
      : '';
    input.setCustomValidity(error);
    input.setAttribute('aria-invalid', error ? 'true' : 'false');
    status.textContent = error || (files.length
      ? 'Počet vybraných fotek: ' + files.length + '. Celkem ' + size + ' MB z 10 MB.'
      : hint);
    return !error;
  }

  input.addEventListener('change', validate);
  form.addEventListener('reset', () => queueMicrotask(validate));
  // Recheck restored selections too, before analytics can record a submission.
  form.addEventListener('submit', event => {
    if (validate()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    input.reportValidity();
  }, true);

  if (canSplit) {
    form.addEventListener('formdata', event => {
      const data = event.formData;
      const files = data.getAll(input.name).filter(file => file instanceof File && file.name);
      data.delete(input.name);
      files.forEach((file, index) => {
        data.append('attachment_' + (index + 1), file, file.name);
      });
    });
  }

  validate();
})();
