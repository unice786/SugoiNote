/* SugoiNote — utilidades compartidas del cliente.
 *
 * Reemplaza el patrón repetido en cada vista de:
 *   - alert() para errores  →  toast accesible con role="status"
 *   - fetch() sin token     →  apiPost() que adjunta el antifalsificador
 *   - catch (_) {} mudo     →  siempre se informa al usuario
 */
(function () {
    'use strict';

    /* ── Token antifalsificador ────────────────────────────── */
    function token() {
        var meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : '';
    }

    /* ── Petición autenticada ───────────────────────────────── */

    async function api(url, opciones) {
        var opts = Object.assign({ headers: {} }, opciones || {});
        opts.headers = Object.assign({ 'X-Requested-With': 'XMLHttpRequest' }, opts.headers);

        // AutoValidateAntiforgeryToken valida el token tanto en el formulario
        // como en la cabecera RequestVerificationToken.
        if ((opts.method || 'GET').toUpperCase() !== 'GET') {
            opts.headers['RequestVerificationToken'] = token();
        }

        var res = await fetch(url, opts);

        var cuerpo = null;
        var tipo = res.headers.get('content-type') || '';
        if (tipo.indexOf('application/json') !== -1) {
            try { cuerpo = await res.json(); } catch (_) { cuerpo = null; }
        } else {
            cuerpo = (await res.text()) || null;
        }

        if (!res.ok) {
            var mensaje = (cuerpo && cuerpo.error) || cuerpo || 'Error inesperado (' + res.status + ')';
            throw new Error(String(mensaje));
        }

        return cuerpo;
    }

    function apiGet(url) { return api(url, { method: 'GET' }); }

    function apiPost(url, datos) {
        return api(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos || {})
        });
    }

    /* ── Notificaciones ────────────────────────────────────── */

    function contenedor() {
        var c = document.getElementById('sugoi-toasts');
        if (!c) {
            c = document.createElement('div');
            c.id = 'sugoi-toasts';
            c.className = 'sugoi-toasts';
            c.setAttribute('role', 'status');
            c.setAttribute('aria-live', 'polite');
            document.body.appendChild(c);
        }
        return c;
    }

    function toast(mensaje, tipo) {
        var c = contenedor();
        var el = document.createElement('div');
        el.className = 'sugoi-toast sugoi-toast--' + (tipo || 'info');

        var icono = { exito: 'bi-check-circle-fill', error: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' }[tipo] || 'bi-info-circle-fill';
        el.innerHTML = '<i class="bi ' + icono + '" aria-hidden="true"></i><span></span>' +
            '<button type="button" class="sugoi-toast__cerrar" aria-label="Cerrar">&times;</button>';
        el.querySelector('span').textContent = mensaje;

        function quitar() {
            el.classList.add('sugoi-toast--saliendo');
            setTimeout(function () { el.remove(); }, 220);
        }
        el.querySelector('.sugoi-toast__cerrar').addEventListener('click', quitar);
        c.appendChild(el);
        setTimeout(quitar, tipo === 'error' ? 8000 : 4000);
        return el;
    }

    toast.ok = function (m) { return toast(m, 'exito'); };
    toast.error = function (m) { return toast(m, 'error'); };
    toast.info = function (m) { return toast(m, 'info'); };

    /* ── Formato ────────────────────────────────────────────── */

    function peso(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function fecha(v) {
        if (!v) return '';
        var d = new Date(v);
        if (isNaN(d)) return '';
        return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) +
            ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    }

    window.Sugoi = {
        api: api, apiGet: apiGet, apiPost: apiPost,
        toast: toast, peso: peso, fecha: fecha,
        token: token
    };
})();