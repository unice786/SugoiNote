/* Sidebar + tema + navegación móvil.
 *
 * Antes este archivo solo collapsible el sidebar en escritorio. En ≤768px el CSS lo escondía
 * con translateX(-100%) y no existía ningún botón para volver a abrirlo: la aplicación se
 * quedaba SIN NAVEGACIÓN en móvil.
 */
(function () {
    'use strict';

    var CLAVE = 'sugoi-sidebar-collapsed';

    /* ── Sidebar colapsable (escritorio) ────────────────────── */
    var btn = document.getElementById('sidebarToggle');
    var sidebar = document.getElementById('sidebar');

    if (btn && sidebar) {
        btn.addEventListener('click', function () {
            var colapsado = sidebar.classList.toggle('collapsed');
            document.documentElement.classList.toggle('sidebar-collapsed-init', colapsado);
            btn.setAttribute('aria-expanded', colapsado ? 'false' : 'true');
            btn.setAttribute('aria-label', colapsado ? 'Expandir menú' : 'Colapsar menú');
            try { localStorage.setItem(CLAVE, colapsado ? 'true' : 'false'); } catch (_) { }
        });

        // Sincroniza el botón con el estado inicial aplicado por el script del <head>.
        if (sidebar.classList.contains('collapsed')) {
            btn.setAttribute('aria-expanded', 'false');
            btn.setAttribute('aria-label', 'Expandir menú');
        }
    }

    /* ── Navegación móvil ──────────────────────────────────── */
    var navBtn = document.getElementById('navToggle');
    var scrim = document.getElementById('navScrim');

    function abrirNav() {
        document.body.classList.add('nav-abierto');
        navBtn.setAttribute('aria-expanded', 'true');
        navBtn.setAttribute('aria-label', 'Cerrar menú');
        scrim.hidden = false;
        // Mueve el foco al primer enlace para que el teclado no quede atrapado fuera.
        var primero = sidebar && sidebar.querySelector('.nav-link-sugoi');
        if (primero) primero.focus();
    }

    function cerrarNav() {
        document.body.classList.remove('nav-abierto');
        navBtn.setAttribute('aria-expanded', 'false');
        navBtn.setAttribute('aria-label', 'Abrir menú');
        scrim.hidden = true;
    }

    if (navBtn && sidebar) {
        navBtn.addEventListener('click', function () {
            document.body.classList.contains('nav-abierto') ? cerrarNav() : abrirNav();
        });
        scrim && scrim.addEventListener('click', cerrarNav);

        // Navegar cierra el menú.
        sidebar.querySelectorAll('a[href]').forEach(function (a) {
            a.addEventListener('click', function () {
                if (document.body.classList.contains('nav-abierto')) cerrarNav();
            });
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && document.body.classList.contains('nav-abierto')) {
                cerrarNav();
                navBtn.focus();
            }
        });
    }

    /* ── Tema: claro / oscuro / automático ──────────────────── */
    var CLAVE_TEMA = 'sugoi-tema';
    var consulta = window.matchMedia('(prefers-color-scheme: dark)');

    function temaEfectivo() {
        var guardado = null;
        try { guardado = localStorage.getItem(CLAVE_TEMA); } catch (_) { }
        if (guardado === 'light' || guardado === 'dark') return guardado;
        return consulta.matches ? 'dark' : 'light';
    }

    function aplicarTema(modo) {
        var efectivo = modo === 'auto' ? (consulta.matches ? 'dark' : 'light') : modo;

        document.documentElement.setAttribute('data-bs-theme', efectivo);
        document.documentElement.setAttribute('data-sugoi-tema', modo);

        try {
            if (modo === 'auto') localStorage.removeItem(CLAVE_TEMA);
            else localStorage.setItem(CLAVE_TEMA, modo);
        } catch (_) { }

        document.querySelectorAll('.theme-btn').forEach(function (b) {
            var activo = b.dataset.tema === modo;
            b.classList.toggle('active', activo);
            b.setAttribute('aria-pressed', activo ? 'true' : 'false');
        });
    }

    document.querySelectorAll('.theme-btn').forEach(function (b) {
        b.addEventListener('click', function () { aplicarTema(b.dataset.tema); });
    });

    // Si el tema es "auto", sigue los cambios del sistema operativo en vivo.
    consulta.addEventListener('change', function () {
        var guardado = null;
        try { guardado = localStorage.getItem(CLAVE_TEMA); } catch (_) { }
        if (!guardado || guardado === 'auto') aplicarTema('auto');
    });

    aplicarTema((function () {
        try { return localStorage.getItem(CLAVE_TEMA) || 'auto'; } catch (_) { return 'auto'; }
    })());
})();