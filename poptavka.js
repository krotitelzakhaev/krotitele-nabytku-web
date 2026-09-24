/* Prefill only the inquiry context; keep this independent of analytics consent. */
(() => {
  'use strict';
  const reason = document.getElementById('duvod');
  const message = document.getElementById('zprava');
  if (!reason || !message) return;

  const reasons = new Map([
    ['renovace', 'Renovace vlastního nábytku'],
    ['vykup', 'Nabízím nábytek k výkupu nebo odvozu'],
    ['koupe', 'Chci koupit / rezervovat kus z nabídky'],
    ['hledani', 'Sháním konkrétní kus']
  ]);
  const pieces = new Map([
    ['kropacek-kozelka-set', 'pár křesel Kropáček & Koželka + stolek Pavouk (set)'],
    ['cecko-pavouk-set', 'pár křesel Céčko + stolek Pavouk (set)'],
    ['smidek-par', 'pár křesel Jaroslav Šmídek (TON) — šedozelený potah'],
    ['cecko-cihlovy-par', 'pár křesel Céčko — cihlový vzor'],
    ['jidelni-zidle-par', 'jídelní židle s čalouněnými sedáky, 2 ks']
  ]);
  const params = new URLSearchParams(location.search);
  const requestedReason = reasons.get(params.get('duvod'));
  // Do not replace values restored by the browser or already entered by the visitor.
  if (requestedReason && !reason.value) reason.value = requestedReason;
  const piece = pieces.get(params.get('kus'));
  if (params.get('duvod') === 'koupe' && reason.value === reasons.get('koupe') && piece && !message.value) {
    message.value = 'Dobrý den, mám zájem o ' + piece + '.\n\n';
  }
})();
