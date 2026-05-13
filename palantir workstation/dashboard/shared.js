(function () {
    'use strict';

    var TOOLS = [
        { name: 'Overview',     href: 'dashboard.html',  status: null,     statusText: null,     category: 'overview'    },
        { name: 'Recon',        href: 'recon.html',      status: 'active',  statusText: 'Active',  category: 'applications' },
        { name: 'Nmap',         href: 'nmap.html',       status: 'active',  statusText: 'Active',  category: 'applications' },
        { name: 'Metasploit',   href: 'metasploit.html', status: 'standby', statusText: 'Standby', category: 'applications' },
        { name: 'Burp Suite',   href: 'burpsuite.html',  status: 'standby', statusText: 'Standby', category: 'applications' },
        { name: 'Maltego',      href: 'maltego.html',    status: 'active',  statusText: 'Active',  category: 'analytics'    },
        { name: 'AI Assistant', href: 'ai.html',         status: 'standby', statusText: 'Standby', category: 'analytics'    },
        { name: 'Threat Map',   href: 'threatmap.html',  status: 'active',  statusText: 'Active',  category: 'analytics'    },
        { name: 'Settings',     href: 'settings.html',   status: 'active',  statusText: 'Active',  category: 'analytics'    },
    ];

    // Placeholder data for tool pages (label, title, description, dotClass, statusText)
    var PLACEHOLDER_PAGES = {
        'nmap.html': {
            label: 'Application',
            title: 'Nmap',
            desc: 'Network exploration tool and port scanner. Used for host discovery, open port enumeration, service version detection, and OS fingerprinting on authorized targets.',
            dotClass: 'active',
            statusText: 'Active — Module ready'
        },
        'metasploit.html': {
            label: 'Application',
            title: 'Metasploit',
            desc: 'Advanced exploit framework for penetration testing. Provides a comprehensive library of exploits, payloads, and post-exploitation modules for authorized security assessments.',
            dotClass: '',
            statusText: 'Standby — Awaiting target'
        },
        'burpsuite.html': {
            label: 'Application',
            title: 'Burp Suite',
            desc: 'Web application security testing platform. Intercepts HTTP/S traffic, crawls web targets, and identifies injection points, authentication flaws, and business logic vulnerabilities.',
            dotClass: '',
            statusText: 'Standby — Proxy inactive'
        },
        'maltego.html': {
            label: 'Analytics',
            title: 'Maltego',
            desc: 'Open-source intelligence and graphical link analysis tool. Maps relationships between domains, IP addresses, email addresses, social profiles, and infrastructure components.',
            dotClass: 'active',
            statusText: 'Active — Graph engine ready'
        },
        'ai.html': {
            label: 'Analytics',
            title: 'AI Assistant',
            desc: 'Intelligent security analysis and threat intelligence assistant. Assists with vulnerability research, report generation, payload crafting guidance, and CVE lookups on authorized engagements.',
            dotClass: '',
            statusText: 'Standby — Initializing model'
        },
        'threatmap.html': {
            label: 'Analytics',
            title: 'Threat Map',
            desc: 'Real-time threat intelligence visualization. Displays global attack patterns, active threats, and security events aggregated from multiple intelligence feeds.',
            dotClass: 'active',
            statusText: 'Active — Feed connected'
        },
        'settings.html': {
            label: 'System',
            title: 'Settings',
            desc: 'Platform configuration and preferences. Manage proxy settings, user agent rotation, API keys, logging level, and integration endpoints for connected tools.',
            dotClass: 'active',
            statusText: 'Active — Configuration loaded'
        },
        'dashboard.html': {
            label: 'Platform Overview',
            title: 'Gotham',
            desc: 'Select a tool from the navigation panel to begin your authorized penetration testing session. All activity is logged and requires valid authorization.',
            dotClass: 'active',
            statusText: 'Platform Online'
        }
    };

    function toolItemHTML(tool, currentHref) {
        var sel = tool.href === currentHref;
        return (
            '<a href="' + tool.href + '" class="tool-item' + (sel ? ' selected' : '') + '"' +
            (sel ? ' aria-current="page"' : '') + '>' +
            '<div class="tool-item-name">' + tool.name + '</div>' +
            '<div class="tool-item-underline" aria-hidden="true"></div>' +
            '<div class="tool-item-status ' + tool.status + '">' + tool.statusText + '</div>' +
            '</a>'
        );
    }

    function initShell(currentHref) {
        var overview  = TOOLS.filter(function (t) { return t.category === 'overview'; });
        var apps      = TOOLS.filter(function (t) { return t.category === 'applications'; });
        var analytics = TOOLS.filter(function (t) { return t.category === 'analytics'; });

        var nav = (
            '<div class="category-column overview">' +
            '<div class="category-title">Main</div>' +
            overview.map(function (t) { return toolItemHTML(t, currentHref); }).join('') +
            '</div>' +
            '<div class="category-column left">' +
            '<div class="category-title">Applications</div>' +
            apps.map(function (t) { return toolItemHTML(t, currentHref); }).join('') +
            '</div>' +
            '<div class="category-column right">' +
            '<div class="category-title">Analytics</div>' +
            analytics.map(function (t) { return toolItemHTML(t, currentHref); }).join('') +
            '</div>'
        );

        var shell = (
            '<div class="titlebar">' +
            '<div class="titlebar-drag-area">' +
            '<span class="titlebar-title">NEXORA GOTHAM PLATFORM</span>' +
            '</div>' +
            '<div class="window-controls">' +
            '<div class="window-control" onclick="if(window.electronAPI) window.electronAPI.minimizeWindow()" aria-label="Minimize">' +
            '<svg viewBox="0 0 10 1" aria-hidden="true"><rect width="10" height="1" fill="white"/></svg>' +
            '</div>' +
            '<div class="window-control" onclick="if(window.electronAPI) window.electronAPI.maximizeWindow()" aria-label="Maximize">' +
            '<svg viewBox="0 0 10 10" aria-hidden="true"><rect x="0" y="0" width="10" height="10" fill="none" stroke="white" stroke-width="1"/></svg>' +
            '</div>' +
            '<div class="window-control close" onclick="if(window.electronAPI) window.electronAPI.closeWindow()" aria-label="Close">' +
            '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M0,0 L10,10 M10,0 L0,10" stroke="white" stroke-width="1"/></svg>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '<div class="window-border" aria-hidden="true">' +
            '<div class="window-border-line top"></div>' +
            '<div class="window-border-line bottom"></div>' +
            '<div class="window-border-line left"></div>' +
            '<div class="window-border-line right"></div>' +
            '</div>' +
            '<header class="final-platform">' +
            '<div class="final-platform-logo" aria-hidden="true"><div class="palantir-icon"></div></div>' +
            '<div class="final-platform-text">NEXORA <span class="gotham">GOTHAM</span> PLATFORM</div>' +
            '</header>' +
            '<div class="title-line" aria-hidden="true"></div>' +
            '<div class="vertical-line" aria-hidden="true"></div>' +
            '<nav class="main-content" aria-label="Tool navigation">' +
            nav +
            '</nav>'
        );

        document.body.insertAdjacentHTML('afterbegin', shell);

        // Maximize / restore icon toggle
        if (window.electronAPI) {
            window.electronAPI.isMaximized().then(function (maximized) {
                setMaximizeIcon(maximized);
            });
            window.electronAPI.onWindowMaximized(function (maximized) {
                setMaximizeIcon(maximized);
            });
        }
    }

    function setMaximizeIcon(isMaximized) {
        var btn = document.querySelector('.window-control[aria-label="Maximize"]');
        if (!btn) return;
        btn.setAttribute('aria-label', isMaximized ? 'Restore' : 'Maximize');
        var svg = btn.querySelector('svg');
        if (!svg) return;
        svg.innerHTML = isMaximized
            // Restore — two overlapping rectangles
            ? '<path fill="none" stroke="white" stroke-width="1" d="M3,0 L10,0 L10,7 M0,3 L7,3 L7,10 L0,10 Z"/>'
            // Maximize — single rectangle
            : '<rect x="0" y="0" width="10" height="10" fill="none" stroke="white" stroke-width="1"/>';
    }

    /**
     * Renders a placeholder tool page from the PLACEHOLDER_PAGES lookup table.
     * Call from any simple placeholder HTML file: <script>initToolPage();</script>
     */
    function initToolPage() {
        var pageName = window.location.pathname.split('/').pop();
        var data = PLACEHOLDER_PAGES[pageName];
        if (!data) {
            data = { label: 'Tool', title: pageName, desc: '', dotClass: '', statusText: 'Ready' };
        }

        var html =
            '<div class="tool-content">' +
            '<div class="tool-placeholder">' +
            '<span class="tool-placeholder-label">' + data.label + '</span>' +
            '<h1 class="tool-placeholder-name">' + data.title + '</h1>' +
            '<p class="tool-placeholder-desc">' + data.desc + '</p>' +
            '<div class="tool-placeholder-status">' +
            '<span class="tool-placeholder-dot ' + data.dotClass + '"></span>' +
            '<span>' + data.statusText + '</span>' +
            '</div>' +
            '</div>' +
            '</div>';

        // Insert before the <script> tags that load shared.js
        document.body.insertAdjacentHTML('afterbegin', html);
    }

    window.initShell = initShell;
    window.initToolPage = initToolPage;
}());

