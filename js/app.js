document.addEventListener('DOMContentLoaded', () => {

    // =========================
    // Guests Swiper (<=699px)
    // =========================
    let guestsSwiper = null;

    function initGuestsSwiper() {
        const el = document.getElementById('guestsSwiper');
        if (!el || typeof Swiper === 'undefined') return;

        const need = window.matchMedia('(max-width: 699px)').matches;

        if (need && !guestsSwiper) {
            guestsSwiper = new Swiper('#guestsSwiper', {
                slidesPerView: 1,
                spaceBetween: 16,
                loop: false,
                observer: true,
                observeParents: true,
                watchOverflow: true,
                pagination: {
                    el: '.guests-pagination',
                    clickable: true
                },
                on: {
                    init() {
                        requestAnimationFrame(() => guestsSwiper && guestsSwiper.update());
                    }
                }
            });

            setTimeout(() => guestsSwiper && guestsSwiper.update(), 150);
        }

        if (!need && guestsSwiper) {
            guestsSwiper.destroy(true, true);
            guestsSwiper = null;
        }
    }

    initGuestsSwiper();
    window.addEventListener('resize', initGuestsSwiper);
    window.addEventListener('load', () => guestsSwiper && guestsSwiper.update());
});


document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('ticketOverlay');
    const closeBtn = overlay?.querySelector('.ticket-close');
    const buyBtn = document.getElementById('buyTicketsBtn');

    if (overlay) overlay.hidden = true;
    document.body.style.overflow = '';

    const ZONE_PRICES = {1: 2000, 2: 1800, 3: 1200};

    function zoneFor(row, seat) {
        if (row >= 19) return null;
        if (row >= 1 && row <= 6 && seat >= 11 && seat <= 30) return 1;
        if (row >= 15 && row <= 18) return 3;
        return 2;
    }

    const manualStatuses = {};

    function makeSeat(row, seat) {
        const id = `R${row}-S${seat}`;
        if (row >= 19) {
            const status = manualStatuses[id] || 'sold';
            return {id, row, seat, zone: null, price: 0, status};
        }
        const zone = zoneFor(row, seat);
        const price = ZONE_PRICES[zone];
        const status = manualStatuses[id] || 'free';
        return {id, row, seat, zone, price, status};
    }

    function generateSeats() {
        const seats = [];
        for (let row = 1; row <= 18; row++) {
            for (let seat = 1; seat <= 40; seat++) seats.push(makeSeat(row, seat));
        }
        for (let seat = 1; seat <= 35; seat++) seats.push(makeSeat(19, seat));
        const row20 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 26, 27, 28, 29, 30, 31, 32, 33, 34];
        row20.forEach(seat => seats.push(makeSeat(20, seat)));
        return seats;
    }

    const hallSvg = document.getElementById('hallSvg');
    const pickedList = document.getElementById('pickedList');
    const totalPriceEl = document.getElementById('totalPrice');
    const emailEl = document.getElementById('buyerEmail');
    const payBtn = document.getElementById('payBtn');

    const selected = new Map();
    let rendered = false;

    // ===== pan/zoom =====
    let viewportG = null;
    let viewW = 1100;
    let viewH = 750;

    const panZoom = {scale: 1, tx: 0, ty: 0, minScale: 1, maxScale: 4};
    const interaction = {
        pointers: new Map(),
        isDragging: false,
        dragJustHappened: false,
        dragThreshold: 4,
        pinch: {active: false, startDist: 0, startScale: 1, startTx: 0, startTy: 0, mid: {x: 0, y: 0}}
    };
    let panZoomInitialized = false;

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function parseViewBox() {
        const vb = hallSvg?.getAttribute('viewBox');
        if (!vb) return;
        const parts = vb.split(/\s+/).map(Number);
        if (parts.length === 4) {
            viewW = parts[2];
            viewH = parts[3];
        }
    }

    function applyTransform() {
        if (!viewportG) return;
        const minTx = viewW - panZoom.scale * viewW;
        const minTy = viewH - panZoom.scale * viewH;
        panZoom.tx = clamp(panZoom.tx, minTx, 0);
        panZoom.ty = clamp(panZoom.ty, minTy, 0);
        viewportG.setAttribute(
            'transform',
            `matrix(${panZoom.scale} 0 0 ${panZoom.scale} ${panZoom.tx} ${panZoom.ty})`
        );
    }

    // ✅ НОВОЕ: при открытии показываем схему полностью (без автозума и без смещения)
    function resetPanZoomView() {
        if (!viewportG) return;
        parseViewBox();
        panZoom.scale = 1;
        panZoom.tx = 0;
        panZoom.ty = 0;
        applyTransform();
    }

    function clientToSvgPoint(clientX, clientY) {
        const pt = hallSvg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const ctm = hallSvg.getScreenCTM();
        if (!ctm) return {x: 0, y: 0};
        const sp = pt.matrixTransform(ctm.inverse());
        return {x: sp.x, y: sp.y};
    }

    function zoomAt(point, newScale) {
        const oldScale = panZoom.scale;
        newScale = clamp(newScale, panZoom.minScale, panZoom.maxScale);
        if (Math.abs(newScale - oldScale) < 0.0001) return;
        panZoom.tx = panZoom.tx + (oldScale - newScale) * point.x;
        panZoom.ty = panZoom.ty + (oldScale - newScale) * point.y;
        panZoom.scale = newScale;
        applyTransform();
    }

    function setupPanZoom() {
        if (!hallSvg || !viewportG || panZoomInitialized) return;
        panZoomInitialized = true;

        hallSvg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const p = clientToSvgPoint(e.clientX, e.clientY);
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            zoomAt(p, panZoom.scale * factor);
        }, {passive: false});

        hallSvg.addEventListener('pointerdown', (e) => {
            const p = clientToSvgPoint(e.clientX, e.clientY);
            interaction.pointers.set(e.pointerId, p);
            interaction.isDragging = false;

            if (interaction.pointers.size === 2) {
                const pts = Array.from(interaction.pointers.values());
                const dx = pts[0].x - pts[1].x;
                const dy = pts[0].y - pts[1].y;
                interaction.pinch.active = true;
                interaction.pinch.startDist = Math.hypot(dx, dy);
                interaction.pinch.startScale = panZoom.scale;
                interaction.pinch.startTx = panZoom.tx;
                interaction.pinch.startTy = panZoom.ty;
                interaction.pinch.mid = {x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2};
            }
        });

        hallSvg.addEventListener('pointermove', (e) => {
            if (!interaction.pointers.has(e.pointerId)) return;

            const p = clientToSvgPoint(e.clientX, e.clientY);
            const prev = interaction.pointers.get(e.pointerId);
            interaction.pointers.set(e.pointerId, p);

            if (interaction.pinch.active && interaction.pointers.size === 2) {
                const pts = Array.from(interaction.pointers.values());
                const dx = pts[0].x - pts[1].x;
                const dy = pts[0].y - pts[1].y;
                const dist = Math.hypot(dx, dy);

                if (interaction.pinch.startDist > 0) {
                    const ratio = dist / interaction.pinch.startDist;
                    const newScale = clamp(interaction.pinch.startScale * ratio, panZoom.minScale, panZoom.maxScale);

                    const mid = interaction.pinch.mid;
                    const oldScale = interaction.pinch.startScale;

                    panZoom.scale = newScale;
                    panZoom.tx = interaction.pinch.startTx + (oldScale - newScale) * mid.x;
                    panZoom.ty = interaction.pinch.startTy + (oldScale - newScale) * mid.y;

                    applyTransform();
                    interaction.dragJustHappened = true;
                }
                return;
            }

            if (interaction.pointers.size === 1) {
                const dx = p.x - prev.x;
                const dy = p.y - prev.y;

                if (!interaction.isDragging) {
                    if (Math.hypot(dx, dy) >= interaction.dragThreshold) interaction.isDragging = true;
                }

                if (interaction.isDragging) {
                    panZoom.tx += dx;
                    panZoom.ty += dy;
                    applyTransform();
                    interaction.dragJustHappened = true;
                    e.preventDefault();
                }
            }
        }, {passive: false});

        function endPointer(e) {
            if (!interaction.pointers.has(e.pointerId)) return;
            interaction.pointers.delete(e.pointerId);
            if (interaction.pointers.size < 2) interaction.pinch.active = false;

            if (interaction.isDragging || interaction.dragJustHappened) {
                setTimeout(() => {
                    interaction.dragJustHappened = false;
                }, 120);
            }
            interaction.isDragging = false;
        }

        hallSvg.addEventListener('pointerup', endPointer);
        hallSvg.addEventListener('pointercancel', endPointer);
    }

    // ===== selection =====
    function updateSummary() {
        const list = Array.from(selected.values())
            .sort((a, b) => a.row - b.row || a.seat - b.seat)
            .map(s => `Р${s.row} М${s.seat}`)
            .join(', ');

        pickedList.textContent = list || '—';

        const total = Array.from(selected.values()).reduce((sum, s) => sum + s.price, 0);
        totalPriceEl.textContent = String(total);

        const emailOk = ((emailEl?.value || '').trim()).includes('@');
        payBtn.disabled = !(selected.size > 0 && emailOk);
    }

    function clearSelection() {
        selected.forEach((seat) => {
            const g = hallSvg?.querySelector(`g[data-id="${seat.id}"]`);
            g?.classList.remove('seat-selected');
        });
        selected.clear();
        pickedList.textContent = '—';
        totalPriceEl.textContent = '0';
        payBtn.disabled = true;
    }

    function toggleSeat(seat, seatGroupEl) {
        if (interaction.dragJustHappened) return;
        if (seat.status !== 'free') return;

        if (selected.has(seat.id)) {
            selected.delete(seat.id);
            seatGroupEl.classList.remove('seat-selected');
        } else {
            selected.set(seat.id, seat);
            seatGroupEl.classList.add('seat-selected');
        }
        updateSummary();
    }

    function svgEl(tag) {
        return document.createElementNS('http://www.w3.org/2000/svg', tag);
    }

    function renderHall() {
        if (!hallSvg) return;
        hallSvg.innerHTML = '';

        const padX = 20;
        const titleH = 50;
        const sceneH = 50;
        const gapAfterScene = 14;

        const labelW = 86;
        const cellW = 22;
        const cellH = 22;
        const cellGap = 1;

        const mainCols = 40;
        const mainRows = 18;

        const gridW = mainCols * (cellW + cellGap) - cellGap;
        const gridH = mainRows * (cellH + cellGap) - cellGap;

        const startX = padX + labelW;
        const startY = padX + titleH + sceneH + gapAfterScene;

        const gapBottom = 16;
        const row19Y = startY + gridH + gapBottom;
        const row20Y = row19Y + (cellH + cellGap);

        const totalH = row20Y + cellH + padX + 24;
        const totalW = startX + gridW + padX;

        hallSvg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);

        viewportG = svgEl('g');
        viewportG.setAttribute('id', 'viewport');
        hallSvg.appendChild(viewportG);

        const title = svgEl('text');
        title.setAttribute('x', String(padX));
        title.setAttribute('y', String(padX + 30));
        title.setAttribute('class', 'hall-title');
        title.setAttribute('fill', '#ffffff');
        title.textContent = 'План Большого зала КЦ «Вдохновение» (773 места)';
        viewportG.appendChild(title);

        const sceneRect = svgEl('rect');
        sceneRect.setAttribute('x', String(startX));
        sceneRect.setAttribute('y', String(padX + titleH));
        sceneRect.setAttribute('width', String(gridW));
        sceneRect.setAttribute('height', String(sceneH - 8));
        sceneRect.setAttribute('fill', '#d9d9d9');
        sceneRect.setAttribute('stroke', 'rgba(0,0,0,0.4)');
        sceneRect.setAttribute('stroke-width', '1');
        viewportG.appendChild(sceneRect);

        const sceneText = svgEl('text');
        sceneText.setAttribute('x', String(startX + gridW / 2));
        sceneText.setAttribute('y', String(padX + titleH + (sceneH - 8) / 2 + 6));
        sceneText.setAttribute('text-anchor', 'middle');
        sceneText.setAttribute('class', 'hall-scene-text');
        sceneText.setAttribute('fill', '#111');
        sceneText.textContent = 'СЦЕНА';
        viewportG.appendChild(sceneText);

        const outer = svgEl('rect');
        outer.setAttribute('x', String(startX));
        outer.setAttribute('y', String(startY));
        outer.setAttribute('width', String(gridW));
        outer.setAttribute('height', String(gridH));
        outer.setAttribute('class', 'grid-outer');
        viewportG.appendChild(outer);

        const thickV1X = startX + 10 * (cellW + cellGap) - cellGap;
        const thickV2X = startX + 30 * (cellW + cellGap) - cellGap;

        [thickV1X, thickV2X].forEach(x => {
            const ln = svgEl('line');
            ln.setAttribute('x1', String(x));
            ln.setAttribute('y1', String(startY));
            ln.setAttribute('x2', String(x));
            ln.setAttribute('y2', String(startY + gridH));
            ln.setAttribute('class', 'grid-thick');
            viewportG.appendChild(ln);
        });

        [3, 6, 9, 14, 18].forEach(r => {
            const y = startY + r * (cellH + cellGap) - cellGap;
            const ln = svgEl('line');
            ln.setAttribute('x1', String(startX));
            ln.setAttribute('y1', String(y));
            ln.setAttribute('x2', String(startX + gridW));
            ln.setAttribute('y2', String(y));
            ln.setAttribute('class', 'grid-thick');
            viewportG.appendChild(ln);
        });

        for (let row = 1; row <= 20; row++) {
            const t = svgEl('text');
            const y = (row <= 18)
                ? (startY + (row - 1) * (cellH + cellGap) + cellH / 2 + 5)
                : (row === 19 ? (row19Y + cellH / 2 + 5) : (row20Y + cellH / 2 + 5));

            t.setAttribute('x', String(padX + labelW - 10));
            t.setAttribute('y', String(y));
            t.setAttribute('text-anchor', 'end');
            t.setAttribute('fill', '#ffffff');
            t.setAttribute('font-size', '12');
            t.setAttribute('font-weight', '700');
            t.textContent = `${row} ряд`;
            viewportG.appendChild(t);
        }

        const seats = generateSeats();
        const seatMap = new Map();
        seats.forEach(s => seatMap.set(`${s.row}:${s.seat}`, s));

        for (let row = 1; row <= 18; row++) {
            for (let seat = 1; seat <= 40; seat++) {
                drawSeatInMainGrid(seatMap.get(`${row}:${seat}`));
            }
        }

        const row19Seats = Array.from({length: 35}, (_, i) => i + 1);
        const row19W = row19Seats.length * (cellW + cellGap) - cellGap;
        const row19X = startX + (gridW - row19W) / 2;
        row19Seats.forEach((seat, idx) => drawSeatCellAt(seatMap.get(`19:${seat}`), row19X + idx * (cellW + cellGap), row19Y));

        const row20Left = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        const row20Right = [26, 27, 28, 29, 30, 31, 32, 33, 34];
        const leftW = row20Left.length * (cellW + cellGap) - cellGap;
        const rightW = row20Right.length * (cellW + cellGap) - cellGap;
        const gapBetweenBlocks = (cellW + cellGap);
        const totalRow20W = leftW + gapBetweenBlocks + rightW;
        const row20X = startX + (gridW - totalRow20W) / 2;

        row20Left.forEach((seat, idx) => drawSeatCellAt(seatMap.get(`20:${seat}`), row20X + idx * (cellW + cellGap), row20Y));
        const rightStart = row20X + leftW + gapBetweenBlocks;
        row20Right.forEach((seat, idx) => drawSeatCellAt(seatMap.get(`20:${seat}`), rightStart + idx * (cellW + cellGap), row20Y));

        updateSummary();

        // ✅ ВАЖНО: больше НЕ делаем автозум. Ставим “fit” и всё.
        resetPanZoomView();
        setupPanZoom();

        function drawSeatInMainGrid(seatObj) {
            const x = startX + (seatObj.seat - 1) * (cellW + cellGap);
            const y = startY + (seatObj.row - 1) * (cellH + cellGap);
            drawSeatCellAt(seatObj, x, y);
        }

        function drawSeatCellAt(seatObj, x, y) {
            const g = svgEl('g');
            g.dataset.id = seatObj.id;
            if (seatObj.status === 'sold') g.classList.add('seat-sold');

            const r = svgEl('rect');
            r.setAttribute('x', String(x));
            r.setAttribute('y', String(y));
            r.setAttribute('width', String(cellW));
            r.setAttribute('height', String(cellH));
            r.setAttribute('rx', '2');
            r.setAttribute('ry', '2');

            if (seatObj.row >= 19) r.setAttribute('class', 'seat-rect seat-zone-sold');
            else r.setAttribute('class', `seat-rect seat-zone-${seatObj.zone}`);

            g.appendChild(r);

            const t = svgEl('text');
            t.setAttribute('x', String(x + cellW / 2));
            t.setAttribute('y', String(y + cellH / 2 + 1));

            let tone = 'dark';
            if (seatObj.zone === 1 || seatObj.zone === 2) tone = 'light';
            if (seatObj.row >= 19) tone = 'dark';

            t.setAttribute('class', `seat-text ${tone}`);
            t.textContent = String(seatObj.seat);
            g.appendChild(t);

            const tooltip = svgEl('title');
            tooltip.textContent = seatObj.status === 'sold'
                ? `Ряд ${seatObj.row}, место ${seatObj.seat} • ЗАНЯТО`
                : `Ряд ${seatObj.row}, место ${seatObj.seat} • ${seatObj.price} ₽`;
            g.appendChild(tooltip);

            if (seatObj.status === 'free') {
                g.style.cursor = 'pointer';
                g.addEventListener('click', () => toggleSeat(seatObj, g));
            }

            viewportG.appendChild(g);
        }
    }

    function openModal() {
        if (!overlay) return;
        overlay.hidden = false;
        document.body.style.overflow = 'hidden';

        if (!rendered) {
            renderHall();
            rendered = true;
        } else {
            updateSummary();
            // ✅ каждый раз при открытии показываем схему целиком
            resetPanZoomView();
        }

        closeBtn?.focus();
    }

    function closeModal() {
        if (!overlay) return;
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        clearSelection();
        overlay.hidden = true;
        document.body.style.overflow = '';
        buyBtn?.focus();
    }

    buyBtn?.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay && !overlay.hidden) closeModal();
    });

    emailEl?.addEventListener('input', updateSummary);
    payBtn?.addEventListener('click', () => alert('Дальше подключаем оплату СБП через backend. Сейчас это UI-демо.'));
});
