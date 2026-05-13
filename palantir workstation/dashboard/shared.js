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

    window.initShell = initShell;
}());

