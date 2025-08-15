// Navigation functionality
document.addEventListener('DOMContentLoaded', function() {
  const navTabs = document.querySelectorAll('.nav-tab');
  const sections = document.querySelectorAll('.section');

  // Handle navigation clicks
  navTabs.forEach(tab => {
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetSection = this.getAttribute('data-section');
      
      // Update active tab
      navTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // Update active section
      sections.forEach(section => {
        section.classList.remove('active');
      });
      
      document.getElementById(targetSection).classList.add('active');
      
      // Update URL hash
      window.history.pushState(null, null, `#${targetSection}`);
    });
  });

  // Handle CTA button clicks
  document.querySelectorAll('[data-section]').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const targetSection = this.getAttribute('data-section');
      
      if (targetSection) {
        e.preventDefault();
        
        // Find and click the corresponding nav tab
        const targetTab = document.querySelector(`[data-section="${targetSection}"].nav-tab`);
        if (targetTab) {
          targetTab.click();
        }
      }
    });
  });

  // Handle initial page load with hash
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(hash)) {
    const targetTab = document.querySelector(`[data-section="${hash}"]`);
    if (targetTab) {
      targetTab.click();
    }
  }
});

// Smooth scrolling enhancement
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href === '#' || this.hasAttribute('data-section')) {
      return; // Let the navigation handler deal with it
    }
    
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});
