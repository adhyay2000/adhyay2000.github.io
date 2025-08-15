const LIBRARY = {
  shelves: [
    {
      id: "Research Papers",
      name: "Research Papers",
      books: [
        {
          id: "paper-1",
          title: "Large Language Models: A Survey",
          author: "Shervin Minaee, Tomas Mikolov, Narjes Nikzad, Meysam Chenaghlu, Richard Socher, Xavier Amatriain, Jianfeng Gao",
          year: 2024,
          color: "#b26e4b",
          description: "Large Language Models (LLMs) have drawn a lot of attention due to their strong performance on a wide range of natural language tasks, since the release of ChatGPT in November 2022. LLMs' ability of general-purpose language understanding and generation is acquired by training billions of model's parameters on massive amounts of text data, as predicted by scaling laws \cite{kaplan2020scaling,hoffmann2022training}. The research area of LLMs, while very recent, is evolving rapidly in many different ways. In this paper, we review some of the most prominent LLMs, including three popular LLM families (GPT, LLaMA, PaLM), and discuss their characteristics, contributions and limitations. We also give an overview of techniques developed to build, and augment LLMs. We then survey popular datasets prepared for LLM training, fine-tuning, and evaluation, review widely used LLM evaluation metrics, and compare the performance of several popular LLMs on a set of representative benchmarks. Finally, we conclude the paper by discussing open challenges and future research directions.",
          pdf: "https://arxiv.org/pdf/2402.06196.pdf"
        },
      ]
    },
    {
      id: "non-fiction",
      name: "Non-Fiction",
      books: [
        {
          id: "nf-1",
          title: "The Art of Deep Work",
          author: "Dr. Sarah Kim",
          year: 2023,
          color: "#6b4e7a",
          description: "An exploration of focus and productivity in the digital age, offering practical strategies for cultivating concentration and achieving meaningful work.",
          pdf: "https://arxiv.org/pdf/2401.12345.pdf"
        },
        {
          id: "nf-2", 
          title: "Climate Futures",
          author: "R. Patel & J. Williams",
          year: 2024,
          color: "#5a7c4e",
          description: "A comprehensive look at emerging technologies and social innovations that could help address climate change while building a more sustainable future."
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
const openNewBtn = $('#open-new');

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

  // Fill details panel
  modalTitleEl.textContent = book.title;
  modalBylineEl.textContent = `by ${book.author}`;
  modalMetaEl.textContent = book.year ? `Published: ${book.year}` : '';
  modalDescEl.textContent = book.description || '';
  modalCoverEl.style.backgroundImage = book.img
    ? `url('${book.img}')`
    : `linear-gradient(135deg, ${book.color||'#c4af9a'}, #2a2323)`;

  // PDF control
  const hasPdf = !!book.pdf;
  tabReader.disabled = !hasPdf;
  openNewBtn.style.display = hasPdf ? 'inline-block' : 'none';
  if(hasPdf) {
    openNewBtn.onclick = () => window.open(book.pdf, '_blank');
  } else {
    openNewBtn.onclick = null;
  }

  // Show details by default, no PDF loaded
  clearPdf();
  selectPanel('details');
  modalEl.setAttribute('aria-hidden','false');
}

function selectPanel(which){
  const isReader = which === 'reader';
  tabDetails.setAttribute('aria-selected', !isReader);
  tabReader.setAttribute('aria-selected', isReader);

  if(isReader) {
    // Hide details, show PDF panel
    panelDetails.hidden = true;
    panelReader.hidden = false;
    loadPdf();
  } else {
    // Hide PDF, show details panel
    panelDetails.hidden = false;
    panelReader.hidden = true;
    clearPdf();
  }
}

function loadPdf(){
  if(ACTIVE_BOOK?.pdf) {
    pdfFrame.src = ACTIVE_BOOK.pdf;
  }
}

function clearPdf(){
  pdfFrame.removeAttribute('src');
}

tabDetails.addEventListener('click', ()=>selectPanel('details'));
tabReader.addEventListener('click', ()=>{ 
  if(!tabReader.disabled) selectPanel('reader');
});

modalEl.addEventListener('click', e=>{
  if(e.target.hasAttribute('data-close')) closeModal();
});

function closeModal(){
  modalEl.setAttribute('aria-hidden','true');
  clearPdf();
}

(function init(){
  renderTabs();
  renderShelves();
})();
