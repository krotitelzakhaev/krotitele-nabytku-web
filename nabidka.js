/* Progressive enhancement: photos remain ordinary image links without JS. */
(() => {
  'use strict';
  const links = Array.from(document.querySelectorAll('[data-gallery]'));
  const dialog = document.querySelector('.produkt-lightbox');
  if (!links.length || !dialog || typeof dialog.showModal !== 'function') return;
  const photo = dialog.querySelector('img');
  const caption = dialog.querySelector('[data-gallery-caption]');
  const counter = dialog.querySelector('[data-gallery-counter]');
  let current = 0;
  let opener;
  let oldOverflow;
  function show(index) {
    current = (index + links.length) % links.length;
    photo.src = links[current].href;
    photo.alt = links[current].dataset.caption;
    caption.textContent = photo.alt;
    counter.textContent = `${current + 1} / ${links.length}`;
  }
  links.forEach((link, index) => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    opener = link;
    show(index);
    oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
  }));
  dialog.querySelector('[data-gallery-prev]').addEventListener('click', () => show(current - 1));
  dialog.querySelector('[data-gallery-next]').addEventListener('click', () => show(current + 1));
  dialog.querySelector('[data-gallery-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(current + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = oldOverflow;
    opener?.focus();
  });
})();
