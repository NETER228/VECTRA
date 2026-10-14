/* terms.js — пользовательское соглашение. Vectra.askTerms(cb): показывает окно; «Согласен» → cb(); «Не согласен» → уводим на поисковик с запросом «конституция».
   Согласие хранится в localStorage (версия + дата). Текст — шаблон, перед публикацией его стоит вычитать и подогнать под ваши реальные данные. */
(function () {
  const S = Vectra.store, VER = 1, t = Vectra.t, C = window.VECTRA_CONFIG || {};
  Vectra.needsTerms = () => (S.get('terms', {}).v || 0) < VER;
  Vectra.askTerms = (cb, readOnly) => {
    if (document.getElementById('tmBack')) return;
    const items = [1, 2, 3, 4, 5, 6, 7].map(i => `<li>${t('terms.p' + i)}</li>`).join('');
    document.body.insertAdjacentHTML('beforeend', `
<div class="nm-back" id="tmBack"><div class="nm-card terms" role="dialog" aria-modal="true" aria-labelledby="tmT">
  <h2 id="tmT">${t('terms.title')}</h2><p>${t('terms.intro')}</p>
  <ol class="tm-list" tabindex="0">${items}</ol>
  ${readOnly ? '' : `<p class="tm-warn">${t('terms.decline')}</p>`}
  <div class="nm-btns"><button class="go" id="tmOk">${readOnly ? t('fair.ok') : t('terms.agree')}</button>${readOnly ? '' : `<button class="go alt" id="tmNo">${t('terms.no')}</button>`}</div>
</div></div>`);
    document.getElementById('tmOk').onclick = () => { if (!readOnly) S.set('terms', { v: VER, t: new Date().toISOString() }); document.getElementById('tmBack').remove(); cb && cb() };
    if (!readOnly) document.getElementById('tmNo').onclick = () => { location.replace(C.declineUrl || 'https://www.google.com/search?q=' + encodeURIComponent('конституция')) };
    document.getElementById('tmOk').focus();
  };
})();
