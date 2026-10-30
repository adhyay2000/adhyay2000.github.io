// Portfolio app. React + htm from CDN, so there is no build step for GitHub Pages.
const { useState, useEffect, useRef, useMemo } = React;
const html = htm.bind(React.createElement);

const SECTIONS = [
  { id: 'about', label: 'About' },
  { id: 'projects', label: 'Projects' },
  { id: 'algorithms', label: 'Algorithms', href: 'algorithms/' },
  { id: 'experience', label: 'Experience' },
  { id: 'cv', label: 'CV' },
  { id: 'readings', label: 'Readings' },
  { id: 'blog', label: 'Blog' },
  { id: 'contact', label: 'Contact' },
];

const ROLES = [
  'Distributed Systems Engineer',
  'Network Security Developer',
  'Georgia Tech OMSCS Graduate',
  'BITS Pilani Alumnus',
];

const PROJECTS = [
  {
    title: 'MapReduce Framework',
    meta: 'OMSCS project',
    body: 'Built a MapReduce framework inspired by Google’s OSDI’04 paper, supporting user-defined map/reduce functions, worker failure recovery, and duplicate task handling.',
    tags: ['Python', 'Hadoop'],
  },
  {
    title: 'Distributed File System',
    meta: 'OMSCS project',
    body: 'Implemented a distributed file server using sync gRPC for file operations and async gRPC for directory listing updates, with client-side caching and invalidation.',
    tags: ['C++', 'gRPC'],
  },
  {
    title: 'Distributed Database (DynamoDB-inspired)',
    meta: 'Course Project',
    body: 'Created a distributed database featuring leaderless replication, read-repair mechanisms, and automatic partition rebalancing.',
    tags: ['Python', 'Spark', 'Hadoop', 'Docker'],
  },
  {
    title: 'Zamindar',
    meta: 'Personal project',
    body: 'A browser-based property-trading board game built from scratch for the Indian market: a full 40-space board themed around Indian cities, mortgaging and house/hotel building mechanics, and configurable computer opponents across five difficulty levels, from Noob to Excellent.',
    tags: ['HTML', 'CSS', 'JavaScript'],
    link: { href: 'zamindar.html', label: 'Play Now' },
  },
];

const JOBS = [
  {
    role: 'Senior Engineer',
    org: 'Eightfold.ai',
    when: 'Feb 2025 - Present',
    points: [
      'Developed a CSV ingestion and recurring ingestion framework used by the team to onboard customer data efficiently',
      'Took ownership of the Oracle Recruiting Cloud adapter for the Eightfold datapath, ensuring reliability and issue resolution',
    ],
    tags: ['Python', 'ORC HCM'],
  },
  {
    role: 'Member of Technical Staff',
    org: 'Nutanix',
    when: 'July 2021 - Feb 2025',
    points: [
      'Built an entity synchronization framework to replicate security policies across availability zones via RPCs, ensuring consistency and avoiding duplicate updates',
      'Scaled the visualization backend to serve 1M+ data points through WebSockets, achieving a 10x performance boost and optimized memory usage by tuning cgroup limits',
      'Refactored critical rule programming modules to reduce on-call incidents and implemented on-call automation tools to further lower operational overhead.',
      'Created a proof-of-concept extending Flow Network Security to support VMs on any cloud architecture using iptables, replicating all key features including rule programming and visualization.',
      'Developed a prototype using eBPF to block VMs exhibiting unusual traffic patterns, improving security detection.',
    ],
    tags: ['Python', 'Golang', 'OVS', 'Springboot', 'Microsegmentation', 'eBPF'],
  },
  {
    role: 'Software Development Intern',
    org: 'Amazon',
    when: 'Jan 2021 - June 2021',
    points: [
      'Migrated and optimized the search service, improving performance and reliability, and fixed automation tests in the build pipeline.',
      'Designed a pipeline leveraging S3 and AWS Lambda for automated data processing to support ML models.',
    ],
    tags: ['Java'],
  },
];

const LINKS = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/aditya-upadhyay-0b1b61188/' },
  { label: 'GitHub', href: 'https://github.com/adhyay2000/' },
  { label: 'Email', href: 'mailto:adityabundi2000@gmail.com' },
];

const BOOKS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTvsGbKDMwy_6pzOjhYRzbLP8l7cntBaj13RRJ-dbGZn3b8leTC0ex-K57KL5FVH0hx2rbE_OGK6L1T/pub?gid=0&single=true&output=csv';
const BOOK_COLORS = ['#b26e4b', '#4a7c7e', '#986e5a', '#6b4e7a', '#5a7c4e', '#7a5b6b', '#6b7a5b', '#5b6b7a', '#7a6b5b', '#6b5b7a'];

// Small CSV parser that copes with quoted fields, escaped quotes and newlines inside quotes.
function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else quoted = false; }
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// Columns: id, title, author, year, description, pdf
const toBooks = rows => rows.slice(1).filter(r => r[1] && r[1].trim()).map((r, i) => ({
  id: r[0] || `book-${i}`,
  title: r[1].trim(),
  author: (r[2] || '').trim() || 'Unknown Author',
  year: parseInt(r[3], 10) || null,
  description: (r[4] || '').trim(),
  pdf: (r[5] || '').trim(),
  color: BOOK_COLORS[i % BOOK_COLORS.length],
}));

const CV_URL = 'assets/data/Resume_Aditya_Upadhyay.pdf';

const BLOG_URL = 'https://docs.google.com/document/d/e/2PACX-1vTtanSBCX0lY5QtHdgCqseeSQBA-iZ1pyF-5AFlzU7WH7Ll8l2b1a_FvWqVR1TxghTvD298btJteHZ-/pub';

// Fades children in the first time they scroll into view.
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return html`<div ref=${ref} className=${`reveal ${shown ? 'in' : ''} ${className}`} style=${{ transitionDelay: `${delay}ms` }}>${children}</div>`;
}

function Typewriter({ words }) {
  const [text, setText] = useState('');
  const [i, setI] = useState(0);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const full = words[i % words.length];
    let wait = deleting ? 35 : 70;
    if (!deleting && text === full) wait = 1600;
    const t = setTimeout(() => {
      if (!deleting && text === full) setDeleting(true);
      else if (deleting && text === '') { setDeleting(false); setI(i + 1); }
      else setText(full.slice(0, text.length + (deleting ? -1 : 1)));
    }, wait);
    return () => clearTimeout(t);
  }, [text, deleting, i, words]);
  return html`<span className="typed">${text}<span className="caret" aria-hidden="true"></span></span>`;
}

function SectionHeader({ title, sub }) {
  return html`<div className="section-header"><h2>${title}</h2><p>${sub}</p></div>`;
}

function Tags({ tags, active, onPick }) {
  return html`<div className="tags">${tags.map(t => onPick
    ? html`<button key=${t} className=${`tag ${active === t ? 'on' : ''}`} onClick=${() => onPick(t)}>${t}</button>`
    : html`<span key=${t} className="tag">${t}</span>`)}</div>`;
}

function About({ go }) {
  return html`
    <section className="hero">
      <div className="hero-content">
        <p className="eyebrow">Hello, I'm</p>
        <h1>Aditya Upadhyay</h1>
        <p className="subtitle"><${Typewriter} words=${ROLES} /></p>
        <p className="description">
          A self-driven software developer with 5 years of experience in building scalable, distributed systems. Passionate about designing reliable architectures and tackling complex technical challenges. Finished Master’s in Computing Systems through the OMSCS program at the Georgia Institute of Technology, and a proud alumnus of BITS Pilani.
        </p>
        <div className="cta-buttons">
          <button className="btn btn-primary" onClick=${() => go('projects')}>View My Work</button>
          <button className="btn btn-secondary" onClick=${() => go('cv')}>Download CV</button>
        </div>
        <dl className="stats">
          <div><dt>5+</dt><dd>years building systems</dd></div>
          <div><dt>1M+</dt><dd>data points served</dd></div>
          <div><dt>10x</dt><dd>backend speedup</dd></div>
        </dl>
      </div>
    </section>`;
}

function Projects() {
  const [tag, setTag] = useState(null);
  const allTags = useMemo(() => [...new Set(PROJECTS.flatMap(p => p.tags))], []);
  const shown = PROJECTS.filter(p => !tag || p.tags.includes(tag));
  return html`
    <section>
      <${SectionHeader} title="Projects" sub="A showcase of my recent work and side projects" />
      <div className="filter">
        <button className=${`tag ${!tag ? 'on' : ''}`} onClick=${() => setTag(null)}>All</button>
        <${Tags} tags=${allTags} active=${tag} onPick=${t => setTag(tag === t ? null : t)} />
      </div>
      <div className="card-grid">
        ${shown.map((p, n) => html`
          <${Reveal} key=${p.title} delay=${n * 70}>
            <article className="card">
              <h3>${p.title}</h3>
              <p className="meta">${p.meta}</p>
              <p>${p.body}</p>
              <${Tags} tags=${p.tags} />
              ${p.link && html`<a href=${p.link.href} className="btn btn-secondary card-btn">${p.link.label} →</a>`}
            </article>
          <//>`)}
      </div>
    </section>`;
}

function Job({ job, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const long = job.points.length > 2;
  const points = open || !long ? job.points : job.points.slice(0, 2);
  return html`
    <article className="card job">
      <h3>${job.role}</h3>
      <p className="meta">${job.org} • ${job.when}</p>
      <ul>${points.map(p => html`<li key=${p}>${p}</li>`)}</ul>
      ${long && html`<button className="link-btn" onClick=${() => setOpen(!open)}>
        ${open ? 'Show less' : `Show ${job.points.length - 2} more`}</button>`}
      <${Tags} tags=${job.tags} />
    </article>`;
}

function Experience() {
  return html`
    <section>
      <${SectionHeader} title="Experience" sub="My professional journey and key accomplishments" />
      <div className="timeline">
        ${JOBS.map((j, n) => html`
          <${Reveal} key=${j.org} delay=${n * 80} className="tl-item">
            <${Job} job=${j} defaultOpen=${n === 0} />
          <//>`)}
      </div>
    </section>`;
}

function CV() {
  const [open, setOpen] = useState(true);
  return html`
    <section>
      <div className="cv-card">
        ${open && html`
          <object className="cv-frame" data=${`${CV_URL}#view=FitH`} type="application/pdf" aria-label="Resume PDF preview">
            <p className="muted-sm">Your browser can't show PDFs inline. Use the download button above.</p>
          </object>`}
      </div>
    </section>`;
}

function Book({ book, onOpen }) {
  return html`
    <button className="book" onClick=${() => onOpen(book)}>
      <span className="book-cover" style=${{ background: `linear-gradient(135deg, ${book.color}, #2a2323)` }}>
        <span className="book-title">${book.title}</span>
      </span>
      <span className="book-author">${book.author}</span>
    </button>`;
}

function BookModal({ book, onClose }) {
  const [tab, setTab] = useState('details');
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return html`
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="book-modal-title">
      <div className="modal-backdrop" onClick=${onClose}></div>
      <div className="modal-dialog">
        <button className="modal-close" aria-label="Close" onClick=${onClose}>×</button>
        <div className="modal-tabs" role="tablist">
          <button role="tab" aria-selected=${tab === 'details'} className=${`tag-tab ${tab === 'details' ? 'on' : ''}`}
                  onClick=${() => setTab('details')}>Details</button>
          ${book.pdf && html`
            <button role="tab" aria-selected=${tab === 'reader'} className=${`tag-tab ${tab === 'reader' ? 'on' : ''}`}
                    onClick=${() => setTab('reader')}>Read</button>
            <a className="tag-tab" href=${book.pdf} target="_blank" rel="noopener">Open in new tab ↗</a>`}
        </div>
        ${tab === 'details' ? html`
          <div className="modal-details">
            <div className="book-cover large" style=${{ background: `linear-gradient(135deg, ${book.color}, #2a2323)` }}></div>
            <div>
              <h3 id="book-modal-title">${book.title}</h3>
              <p className="meta">by ${book.author}${book.year ? ` • ${book.year}` : ''}</p>
              <p>${book.description || 'No description yet.'}</p>
            </div>
          </div>` : html`
          <iframe className="pdf-frame" src=${book.pdf} title=${`${book.title} PDF`} loading="lazy" referrerPolicy="no-referrer"></iframe>
          <p className="muted-sm pdf-note">Preview not loading? <a href=${book.pdf} target="_blank" rel="noopener">Open the PDF directly</a>.</p>`}
      </div>
    </div>`;
}

function Readings() {
  const [books, setBooks] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => {
    setBooks(null); setError(null);
    fetch(BOOKS_CSV)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(t => { const list = toBooks(parseCSV(t)); if (!list.length) throw new Error('no books found'); setBooks(list); })
      .catch(e => setError(e.message));
  };
  useEffect(load, []);
  return html`
    <section>
      <${SectionHeader} title="My Library" sub="Books and articles that have shaped my thinking" />
      ${error && html`<p className="muted">Couldn't load the library (${error}). <button className="link-btn" onClick=${load}>Try again</button></p>`}
      ${!books && !error && html`<p className="muted">Loading books…</p>`}
      ${books && html`<div className="shelf">${books.map((b, n) => html`
        <${Reveal} key=${b.id} delay=${Math.min(n, 8) * 40}><${Book} book=${b} onOpen=${setOpen} /><//>`)}</div>`}
      ${open && html`<${BookModal} book=${open} onClose=${() => setOpen(null)} />`}
    </section>`;
}

function Blog() {
  return html`
    <section>
      <${SectionHeader} title="Blog" sub="Thoughts on technology, development, and digital experiences" />
      <article className="card blog-post">
        <h3>Understanding Kafka: Distributed messaging system</h3>
        <p className="meta">Posted on December 15, 2024 • 5 min read</p>
        <a href=${BLOG_URL} className="btn btn-secondary">Read More →</a>
      </article>
    </section>`;
}

function Contact() {
  return html`
    <section>
      <${SectionHeader} title="Contact" sub="Let’s connect! You can reach me through any of these platforms." />
      <div className="cta-buttons center-row">
        ${LINKS.map(l => html`<a key=${l.label} href=${l.href} className="btn btn-primary">${l.label}</a>`)}
      </div>
    </section>`;
}

const VIEWS = { about: About, projects: Projects, experience: Experience, cv: CV, readings: Readings, blog: Blog, contact: Contact };

const fromHash = () => {
  const h = window.location.hash.slice(1);
  return VIEWS[h] ? h : 'about';
};

function App() {
  const [section, setSection] = useState(fromHash);
  const go = id => {
    window.history.pushState(null, '', `#${id}`);
    setSection(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  useEffect(() => {
    const onPop = () => setSection(fromHash());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('hashchange', onPop); };
  }, []);
  const View = VIEWS[section];
  return html`
    <${React.Fragment}>
      <header className="header">
        <div className="header-content">
          <a href="#about" className="logo" onClick=${e => { e.preventDefault(); go('about'); }}>Aditya Upadhyay</a>
          <nav className="nav-tabs" aria-label="Sections">
            ${SECTIONS.map(s => s.href ? html`
              <a key=${s.id} href=${s.href} className="nav-tab">${s.label}</a>` : html`
              <a key=${s.id} href=${`#${s.id}`} aria-current=${section === s.id ? 'page' : undefined}
                 className=${`nav-tab ${section === s.id ? 'active' : ''}`}
                 onClick=${e => { e.preventDefault(); go(s.id); }}>${s.label}</a>`)}
          </nav>
        </div>
      </header>
      <main className="main-container" key=${section}><${View} go=${go} /></main>
      <footer className="footer"><p>Made with ❤️ by Aditya Upadhyay</p></footer>
    <//>`;
}

ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
