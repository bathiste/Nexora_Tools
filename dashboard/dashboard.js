(function () {
  'use strict';

  // Sidebar tools — kept local to this page so dashboard.html has no
  // dependency on shared.js. Merge with the TOOLS array in shared.js
  // if you want a single source of truth.
  var TOOLS = [
    { name: 'Recon',        href: 'recon.html',      status: 'active'  },
    { name: 'Nmap',         href: 'nmap.html',       status: 'active'  },
    { name: 'Metasploit',   href: 'metasploit.html', status: 'standby' },
    { name: 'Burp Suite',   href: 'burpsuite.html',  status: 'standby' },
    { name: 'Maltego',      href: 'maltego.html',    status: 'active'  },
    { name: 'Threat Map',   href: 'threatmap.html',  status: 'active'  },
    { name: 'Settings',     href: 'settings.html',   status: 'active'  }
  ];

  var STATS = {
    cards: [
      { label: 'Active Sessions',   value: '12',      delta: '+3 today',        down: false },
      { label: 'Events Processed',  value: '48.2K',    delta: '+6.1% vs yday',   down: false },
      { label: 'Alerts Flagged',    value: '7',        delta: '-2 vs yday',      down: true  },
      { label: 'Avg Response',      value: '184ms',    delta: '+11ms',           down: true  }
    ],
    usage: [
      { name: 'Recon',      pct: 82 },
      { name: 'Nmap',       pct: 64 },
      { name: 'Maltego',    pct: 47 },
      { name: 'Threat Map', pct: 39 },
      { name: 'Metasploit', pct: 21 }
    ]
  };

  function skeletonNavItems(n) {
    var out = '';
    for (var i = 0; i < n; i++) {
      var w = 60 + Math.round(Math.random() * 30);
      out += '<div class="g-skel g-skel-nav-item" style="width:' + w + '%"></div>';
    }
    return out;
  }

  function renderSidebarSkeleton() {
    return (
      '<div class="g-sidebar-brand">NEXORA <span>GOTHAM</span></div>' +
      '<div class="g-nav-group"><div class="g-nav-title">Overview</div>' +
      skeletonNavItems(1) + '</div>' +
      '<div class="g-nav-group"><div class="g-nav-title">Applications</div>' +
      skeletonNavItems(4) + '</div>' +
      '<div class="g-nav-group"><div class="g-nav-title">Analytics</div>' +
      skeletonNavItems(3) + '</div>'
    );
  }

  function renderSidebarReal() {
    var apps = TOOLS.filter(function (t) {
      return ['Recon', 'Nmap', 'Metasploit', 'Burp Suite'].indexOf(t.name) !== -1;
    });
    var analytics = TOOLS.filter(function (t) {
      return ['Maltego', 'Threat Map', 'Settings'].indexOf(t.name) !== -1;
    });

    function item(t) {
      return (
        '<a href="' + t.href + '" class="g-nav-item g-fade-in">' +
        '<span>' + t.name + '</span>' +
        '<span class="g-dot ' + t.status + '"></span>' +
        '</a>'
      );
    }

    return (
      '<div class="g-sidebar-brand">NEXORA <span>GOTHAM</span></div>' +
      '<div class="g-nav-group"><div class="g-nav-title">Overview</div>' +
      '<button class="g-nav-item selected g-fade-in" type="button">' +
      '<span>Chat</span><span class="g-dot active"></span></button></div>' +
      '<div class="g-nav-group"><div class="g-nav-title">Applications</div>' +
      apps.map(item).join('') + '</div>' +
      '<div class="g-nav-group"><div class="g-nav-title">Analytics</div>' +
      analytics.map(item).join('') +
      '<button class="g-nav-item stats-trigger g-fade-in" id="g-stats-trigger" type="button">' +
      '<span>Statistics</span><span class="g-dot active"></span></button></div>'
    );
  }

  function renderChatSkeleton() {
    return (
      '<div class="g-chat-header">' +
      '<div><div class="g-skel" style="width:120px;height:16px;margin-bottom:6px"></div>' +
      '<div class="g-skel" style="width:180px;height:10px"></div></div>' +
      '</div>' +
      '<div class="g-chat-scroll">' +
      '<div class="g-skel g-skel-msg short"></div>' +
      '<div class="g-skel g-skel-msg long" style="align-self:flex-end"></div>' +
      '<div class="g-skel g-skel-msg long"></div>' +
      '</div>' +
      '<div class="g-composer"><div class="g-skel g-skel-composer"></div></div>'
    );
  }

  function renderChatReal() {
    return (
      '<div class="g-chat-header g-fade-in">' +
      '<div>' +
      '<div class="g-chat-title">AI Assistant</div>' +
      '<div class="g-chat-sub">STANDBY &middot; MODEL READY</div>' +
      '</div>' +
      '</div>' +
      '<div class="g-chat-scroll g-fade-in" id="g-chat-scroll">' +
      '<div class="g-msg"><div class="g-msg-avatar">AI</div>' +
      '<div class="g-msg-bubble">Session initialized. Ask me to summarize a scan, ' +
      'draft a report, or look up a CVE.</div></div>' +
      '</div>' +
      '<div class="g-composer g-fade-in">' +
      '<div class="g-composer-inner">' +
      '<textarea id="g-chat-input" rows="1" placeholder="Message the assistant&hellip;"></textarea>' +
      '<button class="g-send-btn" id="g-send-btn" type="button" aria-label="Send">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none">' +
      '<path d="M4 12L20 4L13 20L11 13L4 12Z" fill="currentColor"/></svg>' +
      '</button></div></div>'
    );
  }

  function renderStatsSkeleton() {
    var cards = '';
    for (var i = 0; i < 4; i++) {
      cards += '<div class="g-skel g-skel-stat-card"></div>';
    }
    var bars = '';
    for (var j = 0; j < 5; j++) {
      bars += '<div class="g-stats-bar-item">' +
        '<div class="g-skel" style="width:130px;height:10px;flex-shrink:0"></div>' +
        '<div class="g-skel g-skel-bar"></div>' +
        '<div class="g-skel" style="width:30px;height:10px;flex-shrink:0"></div>' +
        '</div>';
    }
    return (
      '<div class="g-stats-header"><div class="g-skel" style="width:140px;height:16px"></div>' +
      '<button class="g-stats-close" id="g-stats-close" type="button" aria-label="Close">' +
      '<svg width="12" height="12" viewBox="0 0 10 10"><path d="M0,0 L10,10 M10,0 L0,10" ' +
      'stroke="currentColor" stroke-width="1.2"/></svg></button></div>' +
      '<div class="g-stats-body">' +
      '<div class="g-stats-grid">' + cards + '</div>' +
      '<div class="g-stats-row">' + bars + '</div>' +
      '</div>'
    );
  }

  function renderStatsReal() {
    var cards = STATS.cards.map(function (c) {
      return (
        '<div class="g-stat-card g-fade-in">' +
        '<div class="g-stat-label">' + c.label + '</div>' +
        '<div class="g-stat-value">' + c.value + '</div>' +
        '<div class="g-stat-delta' + (c.down ? ' down' : '') + '">' + c.delta + '</div>' +
        '</div>'
      );
    }).join('');

    var bars = STATS.usage.map(function (u) {
      return (
        '<div class="g-stats-bar-item g-fade-in">' +
        '<div class="g-stats-bar-name">' + u.name + '</div>' +
        '<div class="g-stats-bar-track"><div class="g-stats-bar-fill" style="width:' + u.pct + '%"></div></div>' +
        '<div class="g-stats-bar-pct">' + u.pct + '%</div>' +
        '</div>'
      );
    }).join('');

    return (
      '<div class="g-stats-header g-fade-in"><div class="g-chat-title">Statistics</div>' +
      '<button class="g-stats-close" id="g-stats-close" type="button" aria-label="Close">' +
      '<svg width="12" height="12" viewBox="0 0 10 10"><path d="M0,0 L10,10 M10,0 L0,10" ' +
      'stroke="currentColor" stroke-width="1.2"/></svg></button></div>' +
      '<div class="g-stats-body">' +
      '<div class="g-stats-grid">' + cards + '</div>' +
      '<div class="g-stats-section-title">Tool Usage (24h)</div>' +
      '<div class="g-stats-row">' + bars + '</div>' +
      '</div>'
    );
  }

  function appendMessage(text, isUser) {
    var scroll = document.getElementById('g-chat-scroll');
    if (!scroll) return;
    var html =
      '<div class="g-msg' + (isUser ? ' user' : '') + ' g-fade-in">' +
      '<div class="g-msg-avatar">' + (isUser ? 'YOU' : 'AI') + '</div>' +
      '<div class="g-msg-bubble"></div></div>';
    scroll.insertAdjacentHTML('beforeend', html);
    scroll.lastElementChild.querySelector('.g-msg-bubble').textContent = text;
    scroll.scrollTop = scroll.scrollHeight;
  }

  function wireChat() {
    var input = document.getElementById('g-chat-input');
    var btn = document.getElementById('g-send-btn');
    if (!input || !btn) return;

    function send() {
      var text = input.value.trim();
      if (!text) return;
      appendMessage(text, true);
      input.value = '';
      input.style.height = 'auto';
      setTimeout(function () {
        appendMessage('Acknowledged. (This is a placeholder response — wire this up to your model.)', false);
      }, 500);
    }

    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    btn.addEventListener('click', send);
  }

  function wireStatsTrigger() {
    var trigger = document.getElementById('g-stats-trigger');
    var panel = document.getElementById('g-stats-panel');
    if (!trigger || !panel) return;

    trigger.addEventListener('click', function () {
      // Every open starts from a fresh skeleton, per requirement.
      panel.innerHTML = renderStatsSkeleton();
      panel.classList.add('open');
      trigger.classList.add('open');
      wireStatsClose();

      setTimeout(function () {
        panel.innerHTML = renderStatsReal();
        wireStatsClose();
      }, 900);
    });
  }

  function wireStatsClose() {
    var closeBtn = document.getElementById('g-stats-close');
    var panel = document.getElementById('g-stats-panel');
    var trigger = document.getElementById('g-stats-trigger');
    if (!closeBtn || !panel) return;
    closeBtn.addEventListener('click', function () {
      panel.classList.remove('open');
      if (trigger) trigger.classList.remove('open');
    });
  }

  function initDashboard() {
    var app = document.getElementById('g-app');
    if (!app) return;

    app.innerHTML =
      '<div class="g-sidebar" id="g-sidebar">' + renderSidebarSkeleton() + '</div>' +
      '<div class="g-main">' +
      '<div id="g-chat-root">' + renderChatSkeleton() + '</div>' +
      '<div class="g-stats-panel" id="g-stats-panel"></div>' +
      '</div>';

    // Skeleton runs every time this page loads.
    setTimeout(function () {
      document.getElementById('g-sidebar').innerHTML = renderSidebarReal();
      document.getElementById('g-chat-root').innerHTML = renderChatReal();
      wireChat();
      wireStatsTrigger();
    }, 900);
  }

  window.initDashboard = initDashboard;
}());
