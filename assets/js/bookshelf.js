const LIBRARY = {
  shelves: [
    {
      id: "papers",
      name: "Papers",
      books: [
        {
          id: "paper-1",
          title: "The Silent Forest",
          author: "A. K. Rao",
          year: 2021,
          color: "#b26e4b",
          description: "A coming-of-age tale...",
          pdf: "assets/data/2402.06196v3.pdf"
        },
        {
          id: "fic-3",
          title: "River of Stars",
          author: "M. Banerjee",
          year: 2023,
          color: "#986e5a",
          description: "Spacefaring botanists...",
          pdf: "sample.pdf"
        }
      ]
    }
  ]
};

let ACTIVE_SHELF = LIBRARY.shelves[0]?.id || null;
let ACTIVE_BOOK = null;

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

const tabsEl = $('#shelf-tabs');
const shelvesEl = $('#shelves');
const modalEl = $('#modal');
const modalCoverEl = $('#modal-cover');
const modalTitleEl = $('#modal-title');
const modalBylineEl = $('#modal-byline');
const modalMetaEl = $('#modal-meta');
const modalDescEl = $('#modal-desc');
const tabDetails = $('#tab-details');
const tabReader  = $('#tab-reader');
const panelDetails = $('#panel-details');
const panelReader  = $('#panel-reader');
const pdfFrame = $('#pdf-frame');
const pdfFallback = $('#pdf-fallback');
const pdfDirect = $('#pdf-direct');
const openNew = $('#open-new');

function renderTabs(){
  tabsEl.innerHTML = LIBRARY.shelves.map(s => `
    <button data-tab="${s.id}" aria-selected="${s.id===ACTIVE_SHELF}">${s.name}</button>
  `).join('');
}

tabsEl.addEventListener('click', e=>{
  const btn = e.target.closest('button[data-tab]');
  if(!btn) return;
  ACTIVE_SHELF = btn.dataset.tab;
  renderShelves();
  updateTabsSelection();
});
function updateTabsSelection(){
  $$('button', tabsEl).forEach(b=>b.setAttribute('aria-selected', b.dataset.tab===ACTIVE_SHELF));
}

function renderShelves(){
  shelvesEl.innerHTML = LIBRARY.shelves.map(shelf=>{
    const hidden = shelf.id!==ACTIVE_SHELF ? 'style="display:none"' : '';
    return `<div class="shelf-row" ${hidden}>
      ${shelf.books.map(renderBookCard).join('')}
    </div>`;
  }).join('');
}
function renderBookCard(book){
  const coverStyle = book.img
    ? `style="background-image:url('${book.img}')" data-img="true"`
    : `style="background: linear-gradient(135deg, ${book.color||'#c4af9a'}, #2a2323)"`;
  return `<article class="book" data-bookid="${book.id}">
    <div class="book-cover" ${coverStyle}><div class="book-title">${book.title}</div></div>
    <div class="book-author">${book.author}</div>
  </article>`;
}

shelvesEl.addEventListener('click', e=>{
  const card = e.target.closest('.book');
  if(card) openModalFor(card.dataset.bookid);
});

function openModalFor(bookId){
  const book = LIBRARY.shelves.flatMap(s=>s.books).find(b=>b.id===bookId);
  if(!book) return;
  ACTIVE_BOOK = book;

  modalTitleEl.textContent = book.title;
  modalBylineEl.textContent = `by ${book.author}`;
  modalMetaEl.textContent = book.year ? `Published: ${book.year}` : '';
  modalDescEl.textContent = book.description || '';
  modalCoverEl.style.backgroundImage = book.img
    ? `url('${book.img}')`
    : `linear-gradient(135deg, ${book.color||'#c4af9a'}, #2a2323)`;

  const hasPdf = !!book.pdf;
  tabReader.disabled = !hasPdf;
  openNew.style.visibility = hasPdf ? 'visible':'hidden';
  if(hasPdf){
    pdfFrame.src = book.pdf;
    pdfDirect.href = book.pdf;
    openNew.href = book.pdf;
  } else {
    pdfFrame.removeAttribute('src');
  }
  selectPanel('details');
  modalEl.setAttribute('aria-hidden','false');
}

function selectPanel(which){
  const isReader = which==='reader';
  tabDetails.setAttribute('aria-selected', !isReader);
  tabReader.setAttribute('aria-selected', isReader);
  panelDetails.hidden = isReader;
  panelReader.hidden = !isReader;
}
tabDetails.addEventListener('click', ()=>selectPanel('details'));
tabReader.addEventListener('click', ()=>{ if(!tabReader.disabled) selectPanel('reader'); });

modalEl.addEventListener('click', e=>{
  if(e.target.hasAttribute('data-close')) closeModal();
});
function closeModal(){
  modalEl.setAttribute('aria-hidden','true');
  pdfFrame.removeAttribute('src');
}

(function init(){
  renderTabs();
  renderShelves();
})();
