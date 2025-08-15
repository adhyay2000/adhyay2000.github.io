// Configuration for Google Sheets CSV
const SHEETS_CONFIG = {
  CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTvsGbKDMwy_6pzOjhYRzbLP8l7cntBaj13RRJ-dbGZn3b8leTC0ex-K57KL5FVH0hx2rbE_OGK6L1T/pub?gid=0&single=true&output=csv'
};

// Default colors for book covers
const BOOK_COLORS = [
  '#b26e4b', '#4a7c7e', '#986e5a', '#6b4e7a', '#5a7c4e', 
  '#7a5b6b', '#6b7a5b', '#5b6b7a', '#7a6b5b', '#6b5b7a'
];

// Initialize empty library
let LIBRARY = {
  shelves: []
};

// Function to parse CSV data
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  
  const books = [];
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let currentValue = '';
    let inQuotes = false;
    
    // Parse CSV line handling quoted values
    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim()); // Don't forget the last value
    
    // Create book object
    if (values.length >= 2 && values[1]) { // At least id and title
      const book = {
        id: values[0] || `book-${i}`,
        title: values[1] || 'Untitled',
        author: values[2] || 'Unknown Author',
        year: values[3] ? parseInt(values[3]) : null,
        description: values[4] || '',
        pdf: values[5] || '',
        color: BOOK_COLORS[(i - 1) % BOOK_COLORS.length]
      };
      
      if (book.title !== 'Untitled') {
        books.push(book);
      }
    }
  }
  
  return books;
}

// Function to fetch data from Google Sheets CSV
async function fetchBooksFromSheets() {
  if (!SHEETS_CONFIG.CSV_URL || SHEETS_CONFIG.CSV_URL === 'YOUR_PUBLISHED_CSV_URL_HERE') {
    showError('Please update SHEETS_CONFIG.CSV_URL with your published Google Sheets CSV URL');
    loadSampleData();
    return;
  }

  try {
    showLoadingState(true);
    const response = await fetch(SHEETS_CONFIG.CSV_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const csvText = await response.text();
    const books = parseCSV(csvText);
    
    if (books.length === 0) {
      throw new Error('No valid books found in the CSV');
    }
    
    // Create library with all books in one shelf
    LIBRARY.shelves = [{
      id: "my-library",
      name: "My Library",
      books: books
    }];
    
    // Update active shelf
    ACTIVE_SHELF = LIBRARY.shelves[0]?.id || null;
    
    // Re-render the UI
    renderTabs();
    renderShelves();
    showLoadingState(false);
    
    console.log(`Successfully loaded ${books.length} books from Google Sheets CSV`);
    
  } catch (error) {
    console.error('Error fetching books from CSV:', error);
    showLoadingState(false);
    showError(`Failed to load books: ${error.message}`);
    
    // Fallback to sample data
    loadSampleData();
  }
}

// Function to show loading state
function showLoadingState(isLoading) {
  if (isLoading) {
    shelvesEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">Loading books from Google Sheets...</div>';
  }
}

// Function to show error message
function showError(message) {
  shelvesEl.innerHTML = `<div style="text-align:center;padding:40px;color:#ff6b6b;">${message}</div>`;
}

// Fallback sample data
function loadSampleData() {
  LIBRARY = {
    shelves: [
      {
        id: "sample",
        name: "Sample Books",
        books: [
          {
            id: "sample-1",
            title: "Configure Your CSV",
            author: "Setup Guide",
            year: 2024,
            color: "#b26e4b",
            description: "Update SHEETS_CONFIG.CSV_URL with your published Google Sheets CSV URL. Go to File → Share → Publish to web → Choose CSV format.",
            pdf: ""
          }
        ]
      }
    ]
  };
  ACTIVE_SHELF = LIBRARY.shelves[0]?.id || null;
  renderTabs();
  renderShelves();
}

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

// Add refresh button to header
function addRefreshButton() {
  const header = $('.site-header');
  const refreshBtn = document.createElement('button');
  refreshBtn.innerHTML = '↻ Refresh';
  refreshBtn.className = 'refresh-btn';
  refreshBtn.style.cssText = `
    position: absolute;
    top: 16px;
    right: 20px;
    background: var(--shelf);
    color: var(--text);
    border: 1px solid var(--shelf-edge);
    border-radius: 6px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 14px;
  `;
  refreshBtn.onclick = fetchBooksFromSheets;
  header.appendChild(refreshBtn);
}

(function init(){
  addRefreshButton();
  // Try to load from Google Sheets first, fallback to sample data
  fetchBooksFromSheets();
})();
