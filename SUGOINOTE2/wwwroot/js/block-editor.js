(function () {
    'use strict';

    const CODE_LANGUAGES = [
        { value: 'csharp', label: 'C#' },
        { value: 'javascript', label: 'JavaScript' },
        { value: 'sql', label: 'SQL' },
        { value: 'html', label: 'HTML' }
    ];

    let editor, bubbleMenu, imgToolbar, onContentChange;
    let selectedImageWrap = null;
    let history = { stack: [], index: -1, max: 80 };
    let historyLock = false;
    let historyTimer = null;

    function initBlockEditor(options) {
        editor = document.getElementById('editorContent');
        if (!editor) return;

        onContentChange = options.onContentChange || function () {};

        createBubbleMenu();
        createImageToolbar();
        bindToolbar();
        bindInsertMenu();
        bindTablePicker();
        bindImageUpload();
        editor.querySelectorAll('[data-bound]').forEach(el => el.removeAttribute('data-bound'));
        reinitializeEditorBlocks();
        pushHistory();

        editor.addEventListener('mouseup', handleSelection);
        editor.addEventListener('keyup', handleSelection);
        editor.addEventListener('keydown', handleKeyDown);
        editor.addEventListener('input', handleInput);
        editor.addEventListener('click', handleEditorClick);
        editor.addEventListener('dragstart', preventImageDrag);
        editor.addEventListener('drop', e => e.preventDefault());
        document.addEventListener('mousedown', handleDocumentClick);
        window.addEventListener('scroll', positionImageToolbar, true);
        window.addEventListener('resize', positionImageToolbar);

        bindUtilityBar();
        bindExportModal();
        bindLinkModal();
    }

    /* ── Historial (Undo / Redo) ── */

    function pushHistory() {
        if (historyLock) return;
        const html = editor.innerHTML;
        if (history.stack[history.index] === html) return;
        history.stack = history.stack.slice(0, history.index + 1);
        history.stack.push(html);
        if (history.stack.length > history.max) history.stack.shift();
        history.index = history.stack.length - 1;
    }

    function scheduleHistory() {
        clearTimeout(historyTimer);
        historyTimer = setTimeout(pushHistory, 400);
    }

    function undo() {
        if (history.index <= 0) return;
        historyLock = true;
        history.index--;
        editor.innerHTML = history.stack[history.index];
        reinitializeEditorBlocks();
        historyLock = false;
        onContentChange();
    }

    function redo() {
        if (history.index >= history.stack.length - 1) return;
        historyLock = true;
        history.index++;
        editor.innerHTML = history.stack[history.index];
        reinitializeEditorBlocks();
        historyLock = false;
        onContentChange();
    }

    function handleKeyDown(e) {
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
            return;
        }
        if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
            e.preventDefault();
            redo();
            return;
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
            if (deleteAdjacentBlock(e.key)) {
                e.preventDefault();
                pushHistory();
                onContentChange();
            }
        }
    }

    const DELETABLE_BLOCK_SELECTOR = '.code-block-wrap, .editor-table-wrap, .img-resize-wrap, .columns-layout';

    function deleteAdjacentBlock(key) {
        const sel = window.getSelection();
        if (!sel?.rangeCount || !sel.isCollapsed || !editor.contains(sel.anchorNode)) return false;

        const block = key === 'Backspace' ? getPreviousBlock(sel) : getNextBlock(sel);
        if (!block?.matches?.(DELETABLE_BLOCK_SELECTOR)) return false;

        block.remove();
        return true;
    }

    function isAtEditableStart(range) {
        const { startContainer, startOffset } = range;
        if (startContainer.nodeType === Node.TEXT_NODE) {
            return startOffset === 0 && !startContainer.textContent.trim();
        }
        if (startContainer === editor) return true;
        if (startContainer.nodeType === Node.ELEMENT_NODE) {
            if (startOffset === 0) return true;
            const prev = startContainer.childNodes[startOffset - 1];
            return isEmptyInlineNode(prev);
        }
        return false;
    }

    function isAtEditableEnd(range) {
        const { startContainer, startOffset } = range;
        if (startContainer.nodeType === Node.TEXT_NODE) {
            return startOffset >= startContainer.textContent.length && !startContainer.textContent.trim();
        }
        if (startContainer === editor) return true;
        if (startContainer.nodeType === Node.ELEMENT_NODE) {
            if (startOffset >= startContainer.childNodes.length) return true;
            const next = startContainer.childNodes[startOffset];
            return isEmptyInlineNode(next);
        }
        return false;
    }

    function getPreviousBlock(sel) {
        const range = sel.getRangeAt(0);
        if (!isAtEditableStart(range)) return null;

        if (range.startContainer === editor && range.startOffset > 0) {
            const prev = editor.childNodes[range.startOffset - 1];
            return prev?.nodeType === Node.ELEMENT_NODE ? prev : null;
        }

        let el = range.startContainer.nodeType === Node.TEXT_NODE
            ? range.startContainer.parentElement
            : range.startContainer;
        while (el && el !== editor) {
            const prev = el.previousElementSibling;
            if (prev) {
                if (prev.matches(DELETABLE_BLOCK_SELECTOR)) return prev;
                if (prev.textContent.trim()) return null;
            }
            el = el.parentElement;
        }
        return null;
    }

    function getNextBlock(sel) {
        const range = sel.getRangeAt(0);
        if (!isAtEditableEnd(range)) return null;

        if (range.startContainer === editor && range.startOffset < editor.childNodes.length) {
            const next = editor.childNodes[range.startOffset];
            return next?.nodeType === Node.ELEMENT_NODE ? next : null;
        }

        let el = range.startContainer.nodeType === Node.TEXT_NODE
            ? range.startContainer.parentElement
            : range.startContainer;
        while (el && el !== editor) {
            const next = el.nextElementSibling;
            if (next) {
                if (next.matches(DELETABLE_BLOCK_SELECTOR)) return next;
                if (next.textContent.trim()) return null;
            }
            el = el.parentElement;
        }
        return null;
    }

    function isEmptyInlineNode(node) {
        if (!node) return true;
        if (node.nodeType === Node.TEXT_NODE) return !node.textContent.trim();
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches(DELETABLE_BLOCK_SELECTOR)) return false;
            return !node.textContent.trim() && !node.querySelector('img, table, hr');
        }
        return false;
    }

    function handleInput() {
        marcarVacio();
        scheduleHistory();
        onContentChange();
    }

    /**
     * CSS `:empty` nunca casaba porque el div del editor siempre tiene hijos (un <br> tras
     * pulsar Enter). Se marca con un atributo para que el placeholder sí se muestre.
     */
    function marcarVacio() {
        const html = editor.innerHTML.trim();
        const vacio = html === '' || html === '<br>' || html === '<div><br></div>';
        editor.toggleAttribute('data-vacio', vacio);
        if (vacio) editor.setAttribute('data-vacio', '1');
        else editor.removeAttribute('data-vacio');
    }

    function preventImageDrag(e) {
        if (e.target.tagName === 'IMG' || e.target.closest('.img-resize-wrap')) {
            e.preventDefault();
        }
    }

    function reinitializeEditorBlocks() {
        reinitializeImages();
        reinitializeTables();
        reinitializeCodeBlocks();
        reinitializeColumns();
    }

    /* ── Toolbar ── */

    function bindToolbar() {
        const toolbar = document.getElementById('editorToolbar');
        if (!toolbar) return;

        toolbar.querySelectorAll('button[data-cmd]').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.preventDefault();
                const cmd = btn.dataset.cmd;
                const val = btn.dataset.val;
                if (cmd === 'undo') undo();
                else if (cmd === 'redo') redo();
                else if (cmd === 'link') openLinkModal();
                else if (cmd === 'formatBlock') applyFormat(cmd, val);
                else applyFormat(cmd);
            });
        });
    }

    function bindInsertMenu() {
        const btn = document.getElementById('btnInsertMenu');
        const menu = document.getElementById('insertMenu');
        if (!btn || !menu) return;

        btn.addEventListener('mousedown', e => {
            e.preventDefault();
            e.stopPropagation();
            menu.classList.toggle('show');
        });

        menu.querySelectorAll('button[data-insert]').forEach(item => {
            item.addEventListener('mousedown', e => {
                e.preventDefault();
                handleInsert(item.dataset.insert);
                menu.classList.remove('show');
            });
        });
    }

    function handleInsert(type) {
        editor.focus();
        switch (type) {
            case 'hr': insertHorizontalRule(); break;
            case 'pagebreak': insertPageBreak(); break;
            case 'image': document.getElementById('imageUploadInput')?.click(); return;
            case 'table': openTablePicker(); return;
            case 'columns2': insertColumns(2); break;
            case 'columns3': insertColumns(3); break;
            case 'checklist': insertChecklist(); break;
            case 'code': insertCodeBlock(); break;
            case 'date': insertDate(); break;
        }
        pushHistory();
        onContentChange();
    }

    function applyFormat(cmd, val) {
        editor.focus();
        document.execCommand(cmd, false, val || null);
        pushHistory();
        onContentChange();
    }

    /* ── Bubble Menu ── */

    function createBubbleMenu() {
        bubbleMenu = document.createElement('div');
        bubbleMenu.className = 'bubble-menu';
        bubbleMenu.innerHTML = `
            <button type="button" data-cmd="bold" title="Negrita"><i class="bi bi-type-bold"></i></button>
            <button type="button" data-cmd="italic" title="Cursiva"><i class="bi bi-type-italic"></i></button>
            <button type="button" data-cmd="underline" title="Subrayado"><i class="bi bi-type-underline"></i></button>
            <span class="bubble-divider"></span>
            <button type="button" data-cmd="link" title="Enlace"><i class="bi bi-link-45deg"></i></button>`;
        document.body.appendChild(bubbleMenu);

        bubbleMenu.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.preventDefault();
                if (btn.dataset.cmd === 'link') openLinkModal();
                else applyFormat(btn.dataset.cmd);
                hideBubbleMenu();
            });
        });
    }

    function handleSelection() {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !editor.contains(sel.anchorNode)) {
            hideBubbleMenu();
            return;
        }
        if (!sel.toString().trim()) {
            hideBubbleMenu();
            return;
        }
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        bubbleMenu.style.top = `${Math.max(8, rect.top - 48)}px`;
        bubbleMenu.style.left = `${Math.max(8, rect.left + rect.width / 2 - 100)}px`;
        bubbleMenu.classList.add('visible');
    }

    function hideBubbleMenu() {
        bubbleMenu?.classList.remove('visible');
    }

    /* ── Imágenes ── */

    function createImageToolbar() {
        imgToolbar = document.createElement('div');
        imgToolbar.className = 'img-edit-toolbar';
        imgToolbar.innerHTML = `
            <button type="button" data-action="align-left" title="Alinear izquierda"><i class="bi bi-text-left"></i></button>
            <button type="button" data-action="align-center" title="Centrar"><i class="bi bi-text-center"></i></button>
            <button type="button" data-action="align-right" title="Alinear derecha"><i class="bi bi-text-right"></i></button>
            <span class="img-toolbar-divider"></span>
            <button type="button" data-action="size-25" title="25%">25%</button>
            <button type="button" data-action="size-50" title="50%">50%</button>
            <button type="button" data-action="size-75" title="75%">75%</button>
            <button type="button" data-action="size-100" title="100%">100%</button>
            <span class="img-toolbar-divider"></span>
            <button type="button" data-action="replace" title="Cambiar imagen"><i class="bi bi-arrow-repeat"></i></button>
            <button type="button" data-action="delete" class="danger" title="Eliminar"><i class="bi bi-trash"></i></button>`;
        document.body.appendChild(imgToolbar);

        imgToolbar.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.preventDefault();
                e.stopPropagation();
                handleImageAction(btn.dataset.action);
            });
        });
    }

    function handleImageAction(action) {
        if (!selectedImageWrap) return;
        const img = selectedImageWrap.querySelector('img');
        if (!img) return;

        selectedImageWrap.classList.remove('img-align-left', 'img-align-center', 'img-align-right');

        if (action === 'align-left') selectedImageWrap.classList.add('img-align-left');
        else if (action === 'align-center') selectedImageWrap.classList.add('img-align-center');
        else if (action === 'align-right') selectedImageWrap.classList.add('img-align-right');
        else if (action.startsWith('size-')) {
            const pct = parseInt(action.split('-')[1], 10);
            img.style.width = Math.round(editor.offsetWidth * (pct / 100)) + 'px';
            updateImageLabel(selectedImageWrap);
        } else if (action === 'replace') {
            document.getElementById('imageUploadInput')?.click();
            document.getElementById('imageUploadInput').dataset.replace = '1';
        } else if (action === 'delete') {
            selectedImageWrap.remove();
            selectedImageWrap = null;
            hideImageToolbar();
        }

        pushHistory();
        onContentChange();
        positionImageToolbar();
    }

    function bindImageUpload() {
        const input = document.getElementById('imageUploadInput');
        input?.addEventListener('change', e => {
            const file = e.target.files?.[0];
            if (!file) return;

            const nombre = file.name;

            try {
                // Antes no había ningún límite: una imagen de 40 MB se leía entera,
                // se convertía a base64 y se reenviaba en cada autoguardado.
                if (file.size > MAX_BYTES_IMG) {
                    throw new Error('La imagen pesa ' + Sugoi.peso(file.size) + ' y el límite es 2 MB.');
                }
                if (!/^image\/(png|jpe?g|gif|webp)$/i.test(file.type)) {
                    throw new Error('Usa una imagen PNG, JPG, GIF o WEBP.');
                }
            } catch (err) {
                Sugoi.toast.error('No se pudo insertar "' + nombre + '": ' + err.message);
                e.target.value = '';
                delete input.dataset.replace;
                return;
            }

            const reader = new FileReader();
            reader.onload = ev => {
                if (input.dataset.replace === '1' && selectedImageWrap) {
                    selectedImageWrap.querySelector('img').src = ev.target.result;
                    input.dataset.replace = '';
                } else {
                    insertImageAtCursor(ev.target.result);
                }
                pushHistory();
                onContentChange();
            };
            reader.onerror = () => Sugoi.toast.error('No se pudo leer "' + nombre + '".');
            reader.readAsDataURL(file);

            e.target.value = '';
            delete input.dataset.replace;
        });
    }

    function insertImageAtCursor(src) {
        editor.focus();
        const wrap = createImageWrap(src);
        const sel = window.getSelection();
        if (sel?.rangeCount && editor.contains(sel.anchorNode)) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(wrap);
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            wrap.after(p);
        } else {
            editor.appendChild(wrap);
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            editor.appendChild(p);
        }
        selectImageWrap(wrap);
    }

    function createImageWrap(src) {
        const wrap = document.createElement('div');
        wrap.className = 'img-resize-wrap img-align-left';
        wrap.contentEditable = 'false';

        const img = document.createElement('img');
        img.src = src;
        img.alt = 'Imagen';
        img.draggable = false;
        img.style.width = Math.round(editor.offsetWidth * 0.5) + 'px';

        const label = document.createElement('span');
        label.className = 'img-size-label';

        const handle = document.createElement('span');
        handle.className = 'img-resize-handle';

        wrap.appendChild(img);
        wrap.appendChild(label);
        wrap.appendChild(handle);
        initImageResize(wrap, img, handle, label);
        return wrap;
    }

    function reinitializeImages() {
        editor.querySelectorAll('img').forEach(img => {
            if (!img.closest('.img-resize-wrap')) {
                const wrap = createImageWrap(img.src);
                const newImg = wrap.querySelector('img');
                if (img.style.width) newImg.style.width = img.style.width;
                else if (img.width) newImg.style.width = img.width + 'px';
                if (img.className) wrap.className = 'img-resize-wrap ' + img.className;
                img.replaceWith(wrap);
            }
        });

        editor.querySelectorAll('.img-resize-wrap').forEach(wrap => {
            wrap.contentEditable = 'false';
            let img = wrap.querySelector('img');
            if (!img) return;
            img.draggable = false;

            let label = wrap.querySelector('.img-size-label');
            if (!label) {
                label = document.createElement('span');
                label.className = 'img-size-label';
                wrap.appendChild(label);
            }

            let handle = wrap.querySelector('.img-resize-handle');
            if (!handle) {
                handle = document.createElement('span');
                handle.className = 'img-resize-handle';
                wrap.appendChild(handle);
            }

            if (wrap.dataset.bound !== '1') {
                const newHandle = handle.cloneNode(true);
                handle.replaceWith(newHandle);
                handle = newHandle;
                initImageResize(wrap, img, handle, label);
                wrap.dataset.bound = '1';
            }
        });
    }

    function initImageResize(wrap, img, handle, label) {
        updateImageLabel(wrap);
        handle.addEventListener('mousedown', e => {
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startW = img.offsetWidth;
            function onMove(ev) {
                img.style.width = Math.max(80, Math.min(startW + (ev.clientX - startX), editor.offsetWidth - 40)) + 'px';
                updateImageLabel(wrap);
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                pushHistory();
                onContentChange();
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
        wrap.addEventListener('click', e => {
            e.stopPropagation();
            selectImageWrap(wrap);
        });
        wrap.addEventListener('dragstart', e => e.preventDefault());
        img.addEventListener('dragstart', e => e.preventDefault());
    }

    function updateImageLabel(wrap) {
        const img = wrap.querySelector('img');
        const label = wrap.querySelector('.img-size-label');
        if (img && label) label.textContent = `${Math.round(img.offsetWidth)}px`;
    }

    function selectImageWrap(wrap) {
        if (selectedImageWrap) selectedImageWrap.classList.remove('selected');
        selectedImageWrap = wrap;
        wrap.classList.add('selected');
        positionImageToolbar();
        imgToolbar?.classList.add('visible');
    }

    function hideImageToolbar() {
        imgToolbar?.classList.remove('visible');
    }

    function positionImageToolbar() {
        if (!selectedImageWrap || !imgToolbar) return;
        const rect = selectedImageWrap.getBoundingClientRect();
        imgToolbar.style.top = `${Math.max(8, rect.top - 48)}px`;
        imgToolbar.style.left = `${Math.max(8, rect.left)}px`;
    }

    function handleEditorClick(e) {
        if (!e.target.closest('.img-resize-wrap')) {
            if (selectedImageWrap) selectedImageWrap.classList.remove('selected');
            selectedImageWrap = null;
            hideImageToolbar();
        }
    }

    /* ── Insert helpers ── */

    function insertBlockElement(el) {
        const sel = window.getSelection();
        const spacer = document.createElement('p');
        spacer.innerHTML = '<br>';
        if (sel?.rangeCount && editor.contains(sel.anchorNode)) {
            const range = sel.getRangeAt(0);
            range.collapse(false);
            range.insertNode(spacer);
            spacer.before(el);
        } else {
            editor.appendChild(el);
            editor.appendChild(document.createElement('p')).innerHTML = '<br>';
        }
        placeCaret(spacer);
    }

    function insertHorizontalRule() {
        const hr = document.createElement('hr');
        hr.className = 'editor-hr';
        insertBlockElement(hr);
    }

    function insertPageBreak() {
        const pb = document.createElement('div');
        pb.className = 'page-break';
        pb.contentEditable = 'false';
        insertBlockElement(pb);
    }

    function insertDate() {
        const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
        const now = new Date();
        const span = document.createElement('span');
        span.className = 'date-block';
        span.contentEditable = 'false';
        span.textContent = `${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}`;
        insertBlockElement(span);
    }

    function insertColumns(count) {
        const layout = document.createElement('div');
        layout.className = `columns-layout cols-${count}`;
        layout.contentEditable = 'false';
        for (let i = 0; i < count; i++) {
            const col = document.createElement('div');
            col.className = 'col-block';
            col.contentEditable = 'true';
            col.innerHTML = '<p><br></p>';
            layout.appendChild(col);
        }
        insertBlockElement(layout);
        placeCaret(layout.querySelector('.col-block p'));
    }

    function insertChecklist() {
        const ul = document.createElement('ul');
        ul.className = 'checklist';
        const li = document.createElement('li');
        li.innerHTML = '<input type="checkbox" /><span contenteditable="true"><br></span>';
        ul.appendChild(li);
        insertBlockElement(ul);
        placeCaret(li.querySelector('span'));
    }

    function createCodeBlockHeader(wrap) {
        const header = document.createElement('div');
        header.className = 'code-block-header';
        header.contentEditable = 'false';

        const left = document.createElement('div');
        left.className = 'code-block-header-left';

        const langLabel = document.createElement('span');
        langLabel.className = 'code-lang-label';
        langLabel.textContent = 'Lenguaje';

        const select = document.createElement('select');
        select.className = 'code-lang-select';
        CODE_LANGUAGES.forEach(lang => {
            const opt = document.createElement('option');
            opt.value = lang.value;
            opt.textContent = lang.label;
            select.appendChild(opt);
        });

        left.appendChild(langLabel);
        left.appendChild(select);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'code-delete-btn';
        deleteBtn.title = 'Eliminar bloque de código';
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        deleteBtn.addEventListener('mousedown', e => {
            e.preventDefault();
            e.stopPropagation();
            wrap.remove();
            pushHistory();
            onContentChange();
        });

        header.appendChild(left);
        header.appendChild(deleteBtn);
        return header;
    }

    function insertCodeBlock() {
        const wrap = document.createElement('div');
        wrap.className = 'code-block-wrap';
        wrap.contentEditable = 'false';
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.contentEditable = 'true';
        code.textContent = '// Escribe tu código aquí...';
        pre.appendChild(code);
        wrap.appendChild(createCodeBlockHeader(wrap));
        wrap.appendChild(pre);
        insertBlockElement(wrap);
        placeCaret(code);
    }

    function insertTable(rows, cols) {
        const wrap = document.createElement('div');
        wrap.className = 'editor-table-wrap';
        wrap.contentEditable = 'false';

        const bar = createTableControlBar(wrap);
        wrap.appendChild(bar);

        const table = document.createElement('table');
        table.className = 'editor-table';
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (let c = 0; c < cols; c++) {
            const th = document.createElement('th');
            th.contentEditable = 'true';
            th.textContent = c === 0 ? 'Encabezado' : `Col ${c + 1}`;
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        for (let r = 0; r < rows - 1; r++) {
            const tr = document.createElement('tr');
            for (let c = 0; c < cols; c++) {
                const td = document.createElement('td');
                td.contentEditable = 'true';
                td.innerHTML = '<br>';
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        wrap.appendChild(table);
        wrap.dataset.bound = '1';
        insertBlockElement(wrap);
        const firstCell = table.querySelector('tbody td') || table.querySelector('th');
        if (firstCell) placeCaret(firstCell);
    }

    function createTableControlBar(wrap) {
        const bar = document.createElement('div');
        bar.className = 'table-control-bar';
        bar.contentEditable = 'false';
        bar.innerHTML = `<span class="table-control-label"><i class="bi bi-table"></i> Tabla</span>
            <button type="button" class="table-delete-btn" title="Eliminar tabla"><i class="bi bi-trash"></i></button>`;
        bar.querySelector('.table-delete-btn').addEventListener('mousedown', e => {
            e.preventDefault();
            e.stopPropagation();
            wrap.remove();
            pushHistory();
            onContentChange();
        });
        return bar;
    }

    function reinitializeTables() {
        editor.querySelectorAll('table').forEach(table => {
            if (table.closest('.editor-table-wrap')) return;
            if (!table.classList.contains('editor-table')) table.classList.add('editor-table');

            const wrap = document.createElement('div');
            wrap.className = 'editor-table-wrap';
            wrap.contentEditable = 'false';
            table.parentNode.insertBefore(wrap, table);
            wrap.appendChild(table);
        });

        editor.querySelectorAll('.editor-table-wrap').forEach(wrap => {
            wrap.contentEditable = 'false';
            const table = wrap.querySelector('table');
            if (!table) return;
            if (!table.classList.contains('editor-table')) table.classList.add('editor-table');
            table.querySelectorAll('th, td').forEach(cell => { cell.contentEditable = 'true'; });

            let bar = wrap.querySelector('.table-control-bar');
            if (!bar) {
                wrap.insertBefore(createTableControlBar(wrap), table);
            } else {
                const btn = bar.querySelector('.table-delete-btn');
                if (btn) {
                    const newBtn = btn.cloneNode(true);
                    btn.replaceWith(newBtn);
                    newBtn.addEventListener('mousedown', e => {
                        e.preventDefault();
                        e.stopPropagation();
                        wrap.remove();
                        pushHistory();
                        onContentChange();
                    });
                }
            }
            wrap.dataset.bound = '1';
        });
    }

    function reinitializeCodeBlocks() {
        editor.querySelectorAll('.code-block-wrap').forEach(wrap => {
            wrap.contentEditable = 'false';
            const code = wrap.querySelector('code');
            if (code) code.contentEditable = 'true';

            let header = wrap.querySelector('.code-block-header');
            if (!header) {
                wrap.insertBefore(createCodeBlockHeader(wrap), wrap.firstChild);
                return;
            }

            header.contentEditable = 'false';
            if (!header.querySelector('.code-delete-btn')) {
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'code-delete-btn';
                deleteBtn.title = 'Eliminar bloque de código';
                deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
                deleteBtn.addEventListener('mousedown', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    wrap.remove();
                    pushHistory();
                    onContentChange();
                });
                header.appendChild(deleteBtn);
            }

            if (!header.querySelector('.code-lang-select')) {
                const left = header.querySelector('.code-block-header-left') || header;
                if (!header.querySelector('.code-lang-label')) {
                    const langLabel = document.createElement('span');
                    langLabel.className = 'code-lang-label';
                    langLabel.textContent = 'Lenguaje';
                    left.insertBefore(langLabel, left.firstChild);
                }
                const select = document.createElement('select');
                select.className = 'code-lang-select';
                CODE_LANGUAGES.forEach(lang => {
                    const opt = document.createElement('option');
                    opt.value = lang.value;
                    opt.textContent = lang.label;
                    select.appendChild(opt);
                });
                left.appendChild(select);
            }
        });
    }

    function reinitializeColumns() {
        editor.querySelectorAll('.columns-layout').forEach(layout => {
            layout.contentEditable = 'false';
            layout.querySelectorAll('.col-block').forEach(col => { col.contentEditable = 'true'; });
        });
    }

    function placeCaret(el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    /* ── Table Picker ── */

    function bindTablePicker() {
        const grid = document.getElementById('tablePickerGrid');
        const label = document.getElementById('tablePickerLabel');
        const modal = document.getElementById('tablePickerModal');
        if (!grid) return;

        for (let r = 1; r <= 6; r++) {
            for (let c = 1; c <= 6; c++) {
                const cell = document.createElement('div');
                cell.className = 'table-picker-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.addEventListener('mouseenter', () => {
                    updateGridHighlight(grid, r, c);
                    if (label) label.textContent = `${r} × ${c}`;
                });
                cell.addEventListener('click', () => {
                    insertTable(r, c);
                    closeTablePicker();
                    pushHistory();
                    onContentChange();
                });
                grid.appendChild(cell);
            }
        }
        document.getElementById('tablePickerCancel')?.addEventListener('click', closeTablePicker);
        modal?.addEventListener('click', e => { if (e.target === modal) closeTablePicker(); });
    }

    function updateGridHighlight(grid, rows, cols) {
        grid.querySelectorAll('.table-picker-cell').forEach(cell => {
            const r = parseInt(cell.dataset.row);
            const c = parseInt(cell.dataset.col);
            cell.classList.toggle('highlight', r <= rows && c <= cols);
        });
    }

    function openTablePicker() {
        const grid = document.getElementById('tablePickerGrid');
        const label = document.getElementById('tablePickerLabel');
        if (grid) updateGridHighlight(grid, 1, 1);
        if (label) label.textContent = '1 × 1';
        document.getElementById('tablePickerModal')?.classList.add('open');
    }

    function closeTablePicker() {
        document.getElementById('tablePickerModal')?.classList.remove('open');
    }

    /* ── Link Modal ── */

    let savedLinkRange = null;

    function bindLinkModal() {
        document.getElementById('linkConfirm')?.addEventListener('click', () => {
            const url = document.getElementById('linkUrlInput')?.value.trim();
            if (url && savedLinkRange) {
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(savedLinkRange);
                applyFormat('createLink', url.startsWith('http') ? url : `https://${url}`);
            }
            closeLinkModal();
        });
        document.getElementById('linkCancel')?.addEventListener('click', closeLinkModal);
        document.getElementById('linkModal')?.addEventListener('click', e => {
            if (e.target.id === 'linkModal') closeLinkModal();
        });
    }

    function openLinkModal() {
        const sel = window.getSelection();
        if (sel?.rangeCount) savedLinkRange = sel.getRangeAt(0).cloneRange();
        document.getElementById('linkUrlInput').value = '';
        document.getElementById('linkModal').classList.add('open');
    }

    function closeLinkModal() {
        document.getElementById('linkModal')?.classList.remove('open');
        savedLinkRange = null;
    }

    function handleDocumentClick(e) {
        if (!bubbleMenu?.contains(e.target)) hideBubbleMenu();
        if (!e.target.closest('.toolbar-insert-wrap')) {
            document.getElementById('insertMenu')?.classList.remove('show');
        }
        if (!e.target.closest('.img-edit-toolbar') && !e.target.closest('.img-resize-wrap')) {
            /* handled in handleEditorClick */
        }
    }

    /* ── Import / Export ── */

    const MAX_BYTES_DOC = 10 * 1024 * 1024;
    const MAX_BYTES_IMG = 2 * 1024 * 1024;

    const FORMATOS = {
        pdf: 'PDF',
        docx: 'DOCX',
        html: 'HTML',
        htm: 'HTML',
        txt: 'TXT'
    };

    /** Muestra el error de importación junto al editor, indicando SIEMPRE el nombre del archivo. */
    function errorImportacion(nombreArchivo, mensaje) {
        const zona = document.getElementById('importError');
        if (!zona) { Sugoi.toast.error('No se pudo importar "' + nombreArchivo + '": ' + mensaje); return; }

        zona.innerHTML =
            '<i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>' +
            '<div class="sugoi-inline-error__texto">' +
            '<strong>No se pudo importar <span class="sugoi-inline-error__archivo"></span></strong>' +
            '<span class="sugoi-inline-error__motivo"></span>' +
            '</div>' +
            '<button type="button" class="sugoi-inline-error__cerrar" aria-label="Cerrar aviso">&times;</button>';

        // textContent, nunca innerHTML: el nombre viene del usuario.
        zona.querySelector('.sugoi-inline-error__archivo').textContent = nombreArchivo;
        zona.querySelector('.sugoi-inline-error__motivo').textContent = mensaje;
        zona.querySelector('.sugoi-inline-error__cerrar').addEventListener('click', ocultarErrorImportacion);
        zona.hidden = false;
        zona.focus();
    }

    function ocultarErrorImportacion() {
        const zona = document.getElementById('importError');
        if (zona) { zona.hidden = true; zona.innerHTML = ''; }
    }

    function bindUtilityBar() {
        document.getElementById('btnUploadDoc')?.addEventListener('click', () => {
            ocultarErrorImportacion();
            document.getElementById('fileUploadInput')?.click();
        });
        document.getElementById('fileUploadInput')?.addEventListener('change', handleFileUpload);
        document.getElementById('btnDownloadDoc')?.addEventListener('click', () => {
            document.getElementById('exportModal')?.classList.add('open');
        });
    }

    function bindExportModal() {
        const modal = document.getElementById('exportModal');
        modal?.querySelectorAll('.export-card').forEach(card => {
            card.addEventListener('click', async () => {
                await exportDocument(card.dataset.format);
                modal.classList.remove('open');
            });
        });
        document.getElementById('exportCancel')?.addEventListener('click', () => modal?.classList.remove('open'));
        modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
    }

    function getTitle() {
        return document.getElementById('tituloEditor')?.value.trim() || 'apunte';
    }

    function findLiveImage(exportImg) {
        const src = exportImg.getAttribute('src');
        if (!src) return null;
        for (const live of editor.querySelectorAll('.img-resize-wrap img, .editor-area img')) {
            if (live.getAttribute('src') === src) return live;
        }
        return null;
    }

    function applyExportImageSize(target, source) {
        const editorImg = source?.closest?.('.img-resize-wrap')?.querySelector('img') || source || target;
        const px = editorImg.offsetWidth
            || parseInt(editorImg.style.width, 10)
            || parseInt(editorImg.getAttribute('width'), 10)
            || 0;

        if (px > 0) {
            target.style.width = px + 'px';
            target.setAttribute('width', String(px));
        } else {
            const fallback = Math.round((editor?.offsetWidth || 720) * 0.5);
            target.style.width = fallback + 'px';
            target.setAttribute('width', String(fallback));
        }
        target.style.maxWidth = '100%';
        target.style.height = 'auto';
        target.style.display = 'block';
        target.style.margin = '12px auto';
        target.removeAttribute('height');
        return target;
    }

    async function prepareHtmlForExport(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        div.querySelectorAll('.img-resize-handle, .img-size-label, .img-toolbar').forEach(el => el.remove());
        div.querySelectorAll('.img-resize-wrap').forEach(wrap => {
            const img = wrap.querySelector('img');
            if (!img) {
                wrap.remove();
                return;
            }
            const live = findLiveImage(img) || img;
            const clone = applyExportImageSize(img.cloneNode(true), live);
            const align = wrap.style.textAlign || wrap.dataset?.align;
            if (align && align !== 'left') {
                const figure = document.createElement('div');
                figure.style.textAlign = align;
                figure.style.margin = '12px 0';
                clone.style.display = 'inline-block';
                clone.style.margin = '0';
                figure.appendChild(clone);
                wrap.replaceWith(figure);
            } else {
                wrap.replaceWith(clone);
            }
        });
        for (const img of div.querySelectorAll('img')) {
            if (!img.getAttribute('width')) {
                const live = findLiveImage(img);
                applyExportImageSize(img, live || img);
            }
            const src = img.getAttribute('src');
            if (src && !src.startsWith('data:')) {
                try { img.src = await urlToBase64(src); } catch (_) {}
            }
        }
        div.querySelectorAll('.code-block-header, .table-control-bar').forEach(el => el.remove());
        div.querySelectorAll('.code-block-wrap').forEach(wrap => {
            const pre = wrap.querySelector('pre');
            if (pre) wrap.replaceWith(pre.cloneNode(true));
        });
        return div.innerHTML;
    }

    function urlToBase64(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => {
                fetch(url).then(r => r.blob()).then(blob => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                }).catch(reject);
            };
            img.src = url;
        });
    }

    async function exportDocument(format) {
        const title = getTitle();
        const html = await prepareHtmlForExport(editor.innerHTML);
        if (format === 'text') {
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            tmp.querySelectorAll('img').forEach(img => img.replaceWith(document.createTextNode(`\n[Imagen]\n`)));
            downloadBlob(tmp.textContent || '', `${title}.txt`, 'text/plain;charset=utf-8');
        } else if (format === 'word') {
            downloadBlob(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Segoe UI,sans-serif;line-height:1.7;color:#111}img{max-width:100%;height:auto;display:block;margin:12px auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px}pre{background:#f4f4f4;padding:12px;border-radius:8px;overflow-x:auto}</style></head><body>${html}</body></html>`, `${title}.doc`, 'application/msword');
        } else if (format === 'pdf') {
            exportPdf(title, html);
        }
    }

    function exportPdf(title, html) {
        const w = window.open('', '_blank');
        if (!w) { alert('Permite ventanas emergentes para exportar a PDF.'); return; }
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Segoe UI,sans-serif;padding:40px;color:#111;line-height:1.7;max-width:900px;margin:0 auto}img{max-width:100%;height:auto;display:block;margin:12px auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px}pre{background:#f4f4f4;padding:12px;border-radius:8px;overflow-x:auto}.columns-layout{display:grid;gap:16px}.cols-2{grid-template-columns:1fr 1fr}.cols-3{grid-template-columns:1fr 1fr 1fr}</style></head><body><h1>${escapeHtml(title)}</h1>${html}</body></html>`);
        w.document.close();
        w.onload = () => { w.focus(); w.print(); };
    }

    function downloadBlob(content, filename, mime) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([content], { type: mime }));
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    /**
     * Importa un documento al editor.
     *
     * Antes este método tenía siete defectos: solo aceptaba .txt/.html/.htm/.docx (el PDF no
     * aparecía ni en el selector), el catch descartaba la excepción real, mammoth venía de un
     * CDN, no había límite de tamaño, el .html se inyectaba sin sanear, el guardado dependía de
     * un debounce de 2 s y el fallo de guardado no se comunicaba.
     */
    async function handleFileUpload(e) {
        const input = e.target;
        const file = input.files?.[0];
        if (!file) return;

        const nombre = file.name;
        const extension = (nombre.split('.').pop() || '').toLowerCase();
        const peso = Sugoi.peso(file.size);

        try {
            // 1. Tamaño (antes no había ninguno: un .docx de 80 MB colgaba el navegador).
            if (file.size > MAX_BYTES_DOC) {
                errorImportacion(nombre, 'El archivo pesa ' + peso + ' y el límite es 10 MB.');
                return;
            }
            if (file.size === 0) {
                errorImportacion(nombre, 'El archivo está vacío.');
                return;
            }

            // 2. Formato, con el nombre del archivo en el mensaje.
            if (!Object.prototype.hasOwnProperty.call(FORMATOS, extension)) {
                errorImportacion(nombre, 'Formato no soportado. Usa .pdf, .docx, .html o .txt.');
                return;
            }

            // 3. Confirmación antes de DESTRUIR el contenido actual del apunte.
            const actual = editor.innerHTML.trim();
            const tieneContenido = actual.length > 0 && actual !== '<br>';
            if (tieneContenido && !confirm(
                'Importar "' + nombre + '" reemplazará todo el contenido actual del apunte.\n\n' +
                'Podrás deshacerlo con Ctrl+Z. ¿Continuar?')) {
                return;
            }

            let html;
            try {
                html = await convertirArchivo(file, extension);
            } catch (err) {
                // 4. Ahora sí se muestra la causa real, no un "no se pudo leer" genérico.
                errorImportacion(nombre, err && err.message ? err.message : 'Error desconocido al leer el archivo.');
                return;
            }

            if (!html || html.replace(/<[^>]*>/g, '').trim().length === 0) {
                errorImportacion(nombre, 'El documento no contiene texto legible.');
                return;
            }

            // 5. Saneado antes de entrar al editor: un .html con <script> o onerror=
            //    se auto-guardaba en la base de datos y se renderizaba para otros usuarios.
            html = window.DOMPurify ? DOMPurify.sanitize(html) : escaparHtml(html);

            editor.innerHTML = html;
            reinitializeEditorBlocks();
            marcarVacio();
            pushHistory();

            // 6. Guardado INMEDIATO: antes solo se program's el debounce de 2 s y, si el
            //    usuario cerraba la página antes, el documento se perdía sin avisar.
            if (typeof guardar === 'function') {
                clearTimeout(window.saveTimer);
                await guardar();
            } else {
                onContentChange();
            }

            Sugoi.toast.ok('"' + nombre + '" importado (' + peso + ').');
        } finally {
            input.value = '';
        }
    }

    /** Convierte el archivo a HTML. Lanza con un mensaje legible si algo falla. */
    async function convertirArchivo(file, extension) {
        switch (extension) {
            case 'docx': {
                if (typeof mammoth === 'undefined') {
                    throw new Error('No se pudo cargar el conversor de Word. Revisa tu conexión a internet.');
                }
                const arrayBuffer = await file.arrayBuffer();
                // Un .docx es un ZIP. Si no empieza con la firma "PK", mammoth/jsZip
                // lanza un error técnico ("Can't find end of central directory") que no
                // dice nada útil. Suele pasar cuando el archivo tiene la extensión
                // cambiada (p. ej. un PDF renombrado a .docx).
                if (!firmaZip(arrayBuffer)) {
                    const real = await detectarFormatoReal(file);
                    let pista = ' Asegúrate de exportarlo como .docx desde Word.';
                    if (real === 'pdf') {
                        pista = ' En realidad es un PDF: cámbiale la extensión a .pdf (o expórtalo de Word como .docx).';
                    } else if (real === 'doc') {
                        pista = ' Es un .doc antiguo; guárdalo como .docx o PDF.';
                    }
                    throw new Error('El archivo no es un Word (.docx) válido.' + pista);
                }
                const result = await mammoth.convertToHtml({ arrayBuffer });
                return normalizarHtml(result.value);
            }

            case 'pdf': {
                if (!window.__pdfjs) {
                    throw new Error('No se pudo cargar el lector de PDF. Recarga la página e inténtalo de nuevo.');
                }
                return await extraerTextoPdf(file);
            }

            case 'html':
            case 'htm':
                return normalizarHtml(await file.text());

            case 'txt':
                return (await file.text())
                    .split(/\r?\n/)
                    .map(l => '<p>' + escaparHtml(l) + '</p>')
                    .join('');

            default:
                throw new Error('Formato no soportado.');
        }
    }

    /** true si el buffer empieza con la firma de un ZIP ("PK"). Un .docx lo es. */
    function firmaZip(arrayBuffer) {
        const b = new Uint8Array(arrayBuffer.slice(0, 4));
        return b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05);
    }

    /**
     * Detecta el formato real por los bytes de cabecera, sin fiarse de la extensión.
     * Devuelve 'pdf' | 'docx' | 'doc' | null.
     */
    async function detectarFormatoReal(file) {
        const b = new Uint8Array(await file.slice(0, 4).arrayBuffer());
        if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';  // %PDF
        if (b[0] === 0x50 && b[1] === 0x4b) return 'docx';                                   // PK (ZIP)
        if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'doc';  // OLE2
        return null;
    }

    /** Recorta el documento HTML para que no arrastre su propio <html>/<body>/<style>. */
    function normalizarHtml(html) {
        let h = (html || '').trim();

        const cuerpo = h.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (cuerpo) h = cuerpo[1];

        h = h.replace(/<script[\s\S]*?<\/script>/gi, '');
        h = h.replace(/<style[\s\S]*?<\/style>/gi, '');
        h = h.replace(/<!--[\s\S]*?-->/g, '');
        h = h.replace(/<\/?(html|head|body|meta|link|title)[^>]*>/gi, '');

        return h.trim();
    }

    /** Extrae el texto del PDF página a página y lo convierte en párrafos. */
    async function extraerTextoPdf(file) {
        const pdfjsLib = window.__pdfjs;
        const buffer = await file.arrayBuffer();
        const b = new Uint8Array(buffer.slice(0, 4));
        if (!(b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46)) {
            throw new Error('El archivo no es un PDF válido (su contenido no empieza con %PDF). Puede tener la extensión cambiada.');
        }
        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

        const paginas = [];
        for (let n = 1; n <= doc.numPages; n++) {
            const pagina = await doc.getPage(n);
            const contenido = await pagina.getTextContent();

            // Reconstruye líneas a partir de la posición vertical de cada fragmento.
            const lineas = new Map();
            for (const item of contenido.items) {
                if (!item.str || !item.str.trim()) continue;
                const y = Math.round(item.transform[5]);
                if (!lineas.has(y)) lineas.set(y, []);
                lineas.get(y).push({ x: item.transform[4], s: item.str });
            }

            const ordenadas = [...lineas.entries()].sort((a, b) => b[0] - a[0]);
            for (const [, fragmentos] of ordenadas) {
                fragmentos.sort((a, b) => a.x - b.x);
                const linea = fragmentos.map(f => f.s).join('').replace(/\s+/g, ' ').trim();
                if (linea) paginas.push(linea);
            }
        }

        if (!paginas.length) throw new Error('El PDF no contiene texto seleccionable (puede ser una imagen escaneada).');

        return paginas.map(l => '<p>' + escaparHtml(l) + '</p>').join('');
    }

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    window.initBlockEditor = initBlockEditor;
})();
