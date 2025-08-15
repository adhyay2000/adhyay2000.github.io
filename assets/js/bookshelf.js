// Bookshelf with scrollable in-modal PDF reader using native browser PDF rendering via <iframe>.
// Works on static hosting (GitHub Pages).
// Add a `pdf` URL per book to enable the reader.
//
// Example:
// { title: 'My Book', author: 'Me', pdf: 'assets/my-book.pdf' }

const LIBRARY = {
  shelves: [
    {
      id: "fiction",
      name: "Fiction",
      books: [
        {
          id: "fic-1",
          title: "The Silent Forest",
          author: "A. K. Rao",
          year: 2021,
          color: "#b26e4b",
          description:
            "A coming-of-age tale set against the backdrop of a remote Himalayan village. Secrets, snowfall, and the search for belonging.",
          pdf: "https://arxiv.org/pdf/2402.06196"
        },
        {
          id: "fic-2",
          title: "Paper Moons",
          author: "N. Mehta",
          year: 2019,
          color: "#7c4b3a",
          description:
            "Interleaved short stories spanning decades of a Mumbai chawl—the small dramas of life that look ordinary until they are not."
        },
        {
          id: "fic-3",
          title: "River of Stars",
          author: "M. Banerjee",
          year: 2023,
          color: "#986e5a",
          description:
            "Spacefaring botanists race to revive a dying colony world. A quiet sci-fi about memory, migration, and second chances.",
          pdf: "sample.pdf" // demo file name you can replace
        }
      ]
    },
    {
      id: "nonfiction",
      name: "Non-Fiction",
      books: [
        {
          id: "nf-1",
          title: "Numbers That Lie",
          author: "R. Iyer",
          year: 2020,
          color: "#a86b43",
          description:
            "A witty tour through statistical traps and how charts can deceive even savvy readers."
        },
        {
          id: "nf-2",
          title: "Monsoon Economies",
          author: "T. Kulkarni",
          year: 2018,
          color: "#8e5539",
          description:
            "Why rainfall patterns shape markets, migration, and policy in South Asia—and what climate change means next."
        }
      ]
    },
    {
      id: "tech",
      name: "Tech",
      books: [
        {
          id: "tech-1",
          title: "Designing Distributed Systems",
          author: "J. Patel",
          year: 2024,
          color: "#b07b5e",
          description:
            "Patterns for resilient microservices, from consensus to circuit breakers—with production case studies."
        },
        {
          id: "tech-2",
          title: "Practical Algorithms",
          author: "S. Kapoor",
          year: 2022,
          color: "#9d6a50",
          description:
            "A hands-on guide to data structures and algorithms with annotated code and problem walkthroughs."
        }
      ]
    }
  ]
};

// ---------- Simple State ----------
let ACTIVE_SHELF = LIBRARY.shelves[0]?.id || null;
let ACTIVE_BOOK = null;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const tabsEl = document.getElementById('shelf-tabs');
const shelvesEl = document.getElementById('shelves');
const modalEl = document.getElementById('modal');
const modalCoverEl = document.getElementById('modal-cover');
const modalTitleEl = document.getElementById('modal-title');
const modalBylineEl = document.getElementById('modal-byline');
const modalMetaEl = document.getElementById('modal-meta');
const modalDescEl = document.getElementById('modal-desc');
const tabDetails = document.getElementById('tab-details');
const tabReader  = document.getElementById('tab-reader');
const panelDetails = document.getElementById('panel-details');
const panelReader  = document.getElementById('panel-reader');
const pdfFrame = document.getElementById('pdf-frame');
const pdfFallback = document.getElementById('pdf-fallback');
const pdfDirect = document.getElementById('pdf-direct');
const openNew = document.getElementById('open-new');

// ---------- Render Tabs ----------
function renderTabs(){
  tabsEl.innerHTML = LIBRARY.shelves.map(s => {
    const selected = s.id === ACTIVE_SHELF;
    return `<button class="tab" role="tab"
              aria-selected="${selected}"
              aria-controls="shelf-${s.id}"
              data-tab="${s.id}">${s.name}</button>`;
  }).join('');
}

tabsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if(!btn) return;
  ACTIVE_SHELF = String(btn.dataset.tab);
  updateTabsSelection();
  renderShelves();
});

function updateTabsSelection(){
  $$('.tabs button', tabsEl).forEach(b => {
    b.setAttribute('aria-selected', String(b.dataset.tab === ACTIVE_SHELF));
  });
}

// ---------- Render Shelves ----------
function renderShelves(){
  shelvesEl.innerHTML = LIBRARY.shelves.map(shelf => {
    const hidden = shelf.id !== ACTIVE_SHELF ? 'style="display:none"' : '';
    const books = shelf.books.map(renderBookCard).join('');
    return `<div class="shelf-row" id="shelf-${shelf.id}" ${hidden}>${books}</div>`;
  }).join('');
}

function renderBookCard(book){
  const coverStyle = book.img
    ? `style="background-image:url('${escapeHtml(book.img)}')" data-img="true"`
    : `style="background: linear-gradient(135deg, ${book.color || '#c4af9a'}, #2a2323)"`;

  const safeTitle = escapeHtml(book.title);
  const safeAuthor = escapeHtml(book.author);
  return `<article class="book" tabindex="0" role="button"
              aria-label="${safeTitle} by ${safeAuthor}"
              data-bookid="${book.id}">
            <div class="book-cover" ${coverStyle}>
              <div class="book-title">${safeTitle}</div>
            </div>
            <div class="book-author">${safeAuthor}</div>
          </article>`;
}

// Delegated click/keyboard open
shelvesEl.addEventListener('click', onBookActivate);
shelvesEl.addEventListener('keydown', (e) => {
  if(e.key === 'Enter' || e.key === ' '){
    const card = e.target.closest('.book');
    if(card){ e.preventDefault(); openModalFor(card.dataset.bookid); }
  }
});

function onBookActivate(e){
  const card = e.target.closest('.book');
  if(!card) return;
  openModalFor(card.dataset.bookid);
}

// ---------- Modal / Reader ----------
function openModalFor(bookId){
  const book = LIBRARY.shelves.flatMap(s => s.books).find(b => b.id === bookId);
  if(!book) return;
  ACTIVE_BOOK = book;

  modalTitleEl.textContent = book.title;
  modalBylineEl.textContent = `by ${book.author}`;
  modalMetaEl.textContent = book.year ? `Published: ${book.year}` : '';
  modalDescEl.textContent = book.description || '';

  if(book.img){
    modalCoverEl.style.backgroundImage = `url('${book.img}')`;
  }else{
    const color = book.color || '#c4af9a';
    modalCoverEl.style.backgroundImage = `linear-gradient(135deg, ${color}, #2a2323)`;
  }

  // Configure reader tab depending on presence of PDF
  const hasPdf = Boolean(book.pdf);
  tabReader.disabled = !hasPdf;
  openNew.style.visibility = hasPdf ? 'visible' : 'hidden';
  if(hasPdf){
    const url = sanitizeUrl(book.pdf);
    // Add small PDF viewer params for a nicer default
    const viewerUrl = url.includes('#') ? url : `${url}#view=FitH`;
    pdfFrame.src = viewerUrl;
    pdfFallback.hidden = false; // default; will hide if iframe loads
    pdfDirect.href = url;
    openNew.href = url;
    // Try focusing the reader by default (load Reader tab first)
    selectPanel('reader');
  }else{
    // No PDF, stay on details
    pdfFrame.removeAttribute('src');
    selectPanel('details');
  }

  modalEl.setAttribute('aria-hidden', 'false');
  setTimeout(() => $('.modal-close').focus(), 0);
}

// Panel switching
tabDetails.addEventListener('click', () => selectPanel('details'));
tabReader.addEventListener('click', () => { if(!tabReader.disabled) selectPanel('reader'); });

function selectPanel(which){
  if(which === 'reader' && tabReader.disabled){ which = 'details'; }
  const isReader = which === 'reader';

  tabDetails.setAttribute('aria-selected', String(!isReader));
  tabReader.setAttribute('aria-selected', String(isReader));

  panelDetails.hidden = isReader;
  panelReader.hidden = !isReader;
}

// iframe load/fallback handling
pdfFrame.addEventListener('load', () => {
  // If it loaded, hide fallback
  pdfFallback.hidden = true;
});

function closeModal(){
  modalEl.setAttribute('aria-hidden', 'true');
  // Cleanup: stop PDF loading to free memory
  pdfFrame.removeAttribute('src');
  ACTIVE_BOOK = null;
}

modalEl.addEventListener('click', (e) => {
  if(e.target.hasAttribute('data-close')) closeModal();
});
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape' && modalEl.getAttribute('aria-hidden') === 'false'){
    closeModal();
  }
});

// ---------- Utils ----------
function escapeHtml(str=''){
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function sanitizeUrl(url=''){
  // Basic guard for static sites; ensures no javascript: scheme
  try{
    const u = new URL(url, location.href);
    if(u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'file:' ){
      return u.href;
    }
    return '#';
  }catch{ return url; }
}

// ---------- Boot ----------
(function init(){
  if(!ACTIVE_SHELF) ACTIVE_SHELF = LIBRARY.shelves[0]?.id || null;
  renderTabs();
  renderShelves();
})();
