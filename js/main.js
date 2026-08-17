/* ============================================================
   PLAYZONE9 - main.js
   Handles all frontend interactions
   ============================================================ */

/* ============================================================
   CONFIGURATION
   Edit these values to customise the site quickly
   ============================================================ */
var CONFIG = {
  /* WhatsApp support number — managed in /admin (Branding > Footer) */
  whatsappNumber: (window.CMS && CMS.get('branding.whatsapp')) || '91xxxxxx',

  /* WhatsApp message (URL encoded) */
  whatsappMessage: 'Hello%2C%20I%20need%20support%20on%20PLAYZONE9.',

  /* Site name */
  siteName: 'PLAYZONE9'
};

/* ============================================================
   WHATSAPP LINKS
   Populates all WhatsApp hrefs from CONFIG
   ============================================================ */
function initWhatsApp() {
  var url = 'https://wa.me/' + CONFIG.whatsappNumber + '?text=' + CONFIG.whatsappMessage;

  var floatBtn = document.getElementById('whatsappFloat');
  if (floatBtn) floatBtn.href = url;

  var supportLink = document.getElementById('whatsappLink');
  if (supportLink) supportLink.href = url;

  var supportBtn = document.getElementById('whatsappSupportBtn');
  if (supportBtn) supportBtn.href = url;
}

/* ============================================================
   MAIN NAVIGATION — Mobile Toggle
   Opens/closes the full-screen nav on mobile
   ============================================================ */
function initMobileNav() {
  var hamburger = document.getElementById('navHamburger');
  var navList   = document.getElementById('navList');
  if (!hamburger || !navList) return;

  /* Create a close button inside the mobile nav */
  var closeBtn = document.createElement('button');
  closeBtn.className = 'nav-close-btn';
  closeBtn.setAttribute('aria-label', 'Close menu');
  closeBtn.innerHTML = '<i class="fas fa-times"></i>';
  navList.appendChild(closeBtn);

  function openNav() {
    navList.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeNav() {
    navList.classList.remove('open');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', openNav);
  closeBtn.addEventListener('click', closeNav);

  /* Close nav when a link is clicked */
  var navLinks = navList.querySelectorAll('.nav-link');
  navLinks.forEach(function(link) {
    link.addEventListener('click', closeNav);
  });
}

/* ============================================================
   SIDEBAR — Toggle on Mobile
   Slides the left sidebar in/out
   ============================================================ */
function initSidebar() {
  var toggleBtn = document.getElementById('sidebarToggle');
  var sidebar   = document.getElementById('leftSidebar');
  var overlay   = document.getElementById('sidebarOverlay');
  if (!toggleBtn || !sidebar || !overlay) return;

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  toggleBtn.addEventListener('click', openSidebar);
  overlay.addEventListener('click', closeSidebar);
}

/* ============================================================
   SIDEBAR SECTIONS — Collapsible
   Clicking a section heading collapses its list
   ============================================================ */
function initSidebarCollapse() {
  var headings = document.querySelectorAll('.sidebar-heading');

  headings.forEach(function(heading) {
    heading.addEventListener('click', function() {
      var targetId = heading.getAttribute('data-toggle');
      if (!targetId) return;

      var list  = document.getElementById(targetId);
      var arrow = heading.querySelector('.sidebar-arrow');
      if (!list) return;

      list.classList.toggle('collapsed');
      if (arrow) arrow.classList.toggle('collapsed');
    });
  });
}

/* ============================================================
   SPORT TABS — Active State
   Switches the active tab on click
   ============================================================ */
function initSportTabs() {
  var tabs = document.querySelectorAll('.sport-tab');

  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      /* Remove active from all */
      tabs.forEach(function(t) { t.classList.remove('active'); });
      /* Add active to clicked */
      tab.classList.add('active');
    });
  });
}

/* ============================================================
   TICKER — Auto-scrolling animation restart
   Ensures the ticker keeps looping (CSS handles animation,
   this just keeps it running cleanly)
   ============================================================ */
function initTicker() {
  var ticker = document.querySelector('.ticker-text');
  if (!ticker) return;

  ticker.addEventListener('animationend', function() {
    ticker.style.animation = 'none';
    /* Trigger reflow */
    void ticker.offsetWidth;
    ticker.style.animation = '';
  });
}

/* ============================================================
   NAV LINK ACTIVE STATE — Desktop
   Sets active class on clicked nav item
   ============================================================ */
function initNavActive() {
  var navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(function(link) {
    link.addEventListener('click', function(e) {
      /* Only on desktop — on mobile, nav closes instead */
      if (window.innerWidth > 768) {
        navLinks.forEach(function(l) { l.classList.remove('active'); });
        link.classList.add('active');
      }
    });
  });
}

/* ============================================================
   ODDS BUTTONS — Login Prompt
   Since there's no real backend, clicking odds shows a prompt
   ============================================================ */
function initOddsButtons() {
  var oddsBtns = document.querySelectorAll('.odds-btn:not(.lock):not(.draw)');

  oddsBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      /* Redirect to login — actual betting needs an account */
      window.location.href = 'login.html';
    });
  });
}

/* ============================================================
   CASINO CARDS — Login Prompt
   Clicking a casino card redirects to login
   ============================================================ */
function initCasinoCards() {
  var cards = document.querySelectorAll('.casino-card');

  cards.forEach(function(card) {
    card.addEventListener('click', function() {
      window.location.href = card.getAttribute('data-link') || 'login.html';
    });
  });
}

/* ============================================================
   SIDEBAR LIST LINKS — Active State
   ============================================================ */
function initSidebarLinks() {
  var links = document.querySelectorAll('.sidebar-list a');

  links.forEach(function(link) {
    link.addEventListener('click', function() {
      /* Remove active from all sidebar links */
      links.forEach(function(l) { l.classList.remove('active'); });
      link.classList.add('active');
    });
  });
}

/* ============================================================
   MOBILE MATCH TITLES — Split "Team A v Team B / date" into
   two display lines: team name (bold) and datetime (grey).
   Also injects 1/X/2 column labels above active odds grids.
   ============================================================ */
function enhanceMobileMatches() {
  if (window.innerWidth > 768) return;

  /* Split team name from datetime */
  var titles = document.querySelectorAll('.match-title');
  titles.forEach(function(el) {
    if (el.dataset.enhanced) return;
    el.dataset.enhanced = '1';
    var text = el.textContent.trim();
    var slash = text.indexOf(' / ');
    if (slash !== -1) {
      var team = text.slice(0, slash);
      var date = text.slice(slash + 3);
      el.innerHTML =
        '<span class="match-team">' + team + '</span>' +
        '<span class="match-datetime">' + date + '</span>';
    }
  });

  /* Inject 1/X/2 labels above active (non-all-locked) odds grids */
  var rows = document.querySelectorAll('.match-row');
  rows.forEach(function(row) {
    var oddsDiv = row.querySelector('.match-odds');
    if (!oddsDiv || row.querySelector('.mob-odds-labels')) return;
    var btns = oddsDiv.querySelectorAll('.odds-btn');
    var allLocked = Array.prototype.every.call(btns, function(b) {
      return b.classList.contains('lock');
    });
    if (allLocked) return;
    var labels = document.createElement('div');
    labels.className = 'mob-odds-labels';
    labels.innerHTML = '<span>1</span><span>X</span><span>2</span>';
    oddsDiv.parentNode.insertBefore(labels, oddsDiv);
  });
}

/* ============================================================
   STICKY HEADER SHADOW
   Adds shadow to header on scroll
   ============================================================ */
function initScrollEffects() {
  var header = document.querySelector('.site-header');
  if (!header) return;

  window.addEventListener('scroll', function() {
    if (window.scrollY > 10) {
      header.style.boxShadow = '0 2px 20px rgba(0,0,0,0.6)';
    } else {
      header.style.boxShadow = '';
    }
  }, { passive: true });
}

/* ============================================================
   INIT — Run everything on DOMContentLoaded
   ============================================================ */
/* Sports tabs and casino cards are re-rendered by js/cms.js, so their
   listeners must be re-attached whenever the CMS repaints. */
document.addEventListener('cms:applied', function() {
  initSportTabs();
  initCasinoCards();
  initOddsButtons();
  enhanceMobileMatches();
});

document.addEventListener('DOMContentLoaded', function() {
  initWhatsApp();
  initMobileNav();
  initSidebar();
  initSidebarCollapse();
  initSportTabs();
  initTicker();
  initNavActive();
  initOddsButtons();
  initCasinoCards();
  initSidebarLinks();
  initScrollEffects();
  enhanceMobileMatches();
});
