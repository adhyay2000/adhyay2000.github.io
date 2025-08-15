(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const tabsEl = $("#bs-tabs");
  const shelvesEl = $("#bs-shelves");
  const searchEl = $("#bs-search-input");
  const modalEl = $("#bs-modal");
  const modalBody = $("#bs-modal-body");

  let shelves = [];
  let active = null;
  let query = "";

  fetch("assets/data/books.json")
    .then(r => r.json())
    .then(data => {
      shelves = data.shelves || [];
      active = (shelves[0] && shelves[0].id) || null;
      renderTabs();
      renderShelves();
    })
    .catch(err => {
      console.error("Failed to load books.json", err);
      tabsEl.innerHTML = "<div style='opacity:.8'>Failed to load data.</div>";
    });

  function renderTabs(){
    tabsEl.innerHTML = shelves.map(s => `<button class="bs-tab ${s.id===active?'active':''}" data-tab="${s.id}">${escapeHtml(s.name)}</button>`).join("");
    tabsEl.addEventListener("click", (e)=>{
      const btn = e.target.closest("[data-tab]");
      if(!btn) return;
      active = btn.getAttribute("data-tab");
      renderTabs();
      renderShelves();
      window.history.replaceState({}, "", `?shelf=${encodeURIComponent(active)}`);
    }, { once:true });
  }

  function renderShelves(){
    const shelf = shelves.find(s=>s.id===active);
    if(!shelf){ shelvesEl.innerHTML = ""; return; }

    const list = (query ? shelf.books.filter(b => match(b, query)) : shelf.books);

    if(list.length===0){
      shelvesEl.innerHTML = `<div class="bs-shelf"><div style="padding:24px;opacity:.9">No books match your search.</div></div>`;
      return;
    }

    // chunk into rows of ~12
    const chunks = chunk(list, 12);
    shelvesEl.innerHTML = chunks.map(items => {
      const cards = items.map(book => card(book)).join("");
      return `<section class="bs-shelf"><div class="bs-grid">${cards}</div></section>`;
    }).join("");

    // click handlers
    $$(".bs-book", shelvesEl).forEach(a => {
      a.addEventListener("click", () => {
        const id = a.getAttribute("data-id");
        const book = shelf.books.find(b => b.id === id);
        openModal(book);
      });
    });
  }

  searchEl.addEventListener("input", (e)=>{
    query = e.target.value.trim().toLowerCase();
    renderShelves();
  });

  // Modal logic
  function openModal(book){
    const cover = book.cover ? `style="background-image:url('${escapeAttr(book.cover)}')"` : "";
    const tags = (book.tags||[]).map(t => `<span class="bs-chip">${escapeHtml(t)}</span>`).join("");
    modalBody.innerHTML = `
      <div class="bs-modal__cover" ${cover}></div>
      <div>
        <h2 id="bs-modal-title" style="margin:0 0 6px 0">${escapeHtml(book.title)}</h2>
        <div style="opacity:.9">${escapeHtml(book.author||'')}</div>
        ${book.year ? `<div style="opacity:.7;font-size:.9rem;margin-top:2px">${book.year}</div>`: ''}
        ${tags ? `<div class="bs-chips">${tags}</div>`:''}
        ${book.description ? `<p>${escapeHtml(book.description)}</p>`:''}
        <div style="margin-top:10px; display:flex; gap:8px;">
          <a class="bs-btn" target="_blank" rel="noopener" href="#">Read more</a>
          <button class="bs-btn" data-close>Close</button>
        </div>
      </div>
    `;
    modalEl.classList.add("open");
    modalEl.setAttribute("aria-hidden", "false");
  }
  modalEl.addEventListener("click", e=>{
    if(e.target.hasAttribute("data-close")) closeModal();
  });
  function closeModal(){
    modalEl.classList.remove("open");
    modalEl.setAttribute("aria-hidden", "true");
  }

  // Utils
  function match(b, q){
    return (b.title||'').toLowerCase().includes(q) || (b.author||'').toLowerCase().includes(q);
  }
  function chunk(arr, n){
    const out=[]; for(let i=0;i<arr.length;i+=n) out.push(arr.slice(i,i+n)); return out;
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',\"'\":'&#39;'}[m])); }
  function escapeAttr(s){ return String(s).replace(/"/g,'&quot;'); }

  // read ?shelf= from URL if present
  (function(){
    const params = new URLSearchParams(location.search);
    const shelf = params.get("shelf");
    if(shelf) active = shelf;
  })();
})();