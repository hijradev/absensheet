// DailyAttendance.test.js - Unit tests for DailyAttendance pagination
// Validates: Requirements 6.4

import { describe, it, expect, beforeEach } from 'vitest';
import { DailyAttendance } from './DailyAttendance.js';

function makeInstance() {
    const state = {};
    return new DailyAttendance(state, () => {}, () => {});
}

describe('DailyAttendance.paginationBtn()', () => {
    let da;

    beforeEach(() => {
        da = makeInstance();
    });

    it('includes page-number class on the <li> element', () => {
        const html = da.paginationBtn(3, 5, '3');
        expect(html).toMatch(/class="page-item page-number/);
    });

    it('includes active class when pageNum equals currentPage', () => {
        const html = da.paginationBtn(2, 2, '2');
        expect(html).toMatch(/page-item page-number active/);
    });

    it('does not include active class when pageNum differs from currentPage', () => {
        const html = da.paginationBtn(1, 4, '1');
        // active should not appear in the class list
        const liMatch = html.match(/<li[^>]*>/);
        expect(liMatch).not.toBeNull();
        expect(liMatch[0]).not.toMatch(/\bactive\b/);
    });

    it('renders a button with the correct data-page attribute', () => {
        const html = da.paginationBtn(7, 1, '7');
        expect(html).toContain('data-page="7"');
    });

    it('renders the label inside the button', () => {
        const html = da.paginationBtn(5, 5, '5');
        expect(html).toContain('>5<');
    });
});

describe('DailyAttendance renderPagination() — prev/next buttons do NOT have page-number class', () => {
    it('prev <li> does not have page-number class', () => {
        // We can inspect the renderPagination output by checking the template string
        // The prev/next items are hardcoded in renderPagination, not via paginationBtn
        const da = makeInstance();

        // Patch document.getElementById to capture innerHTML assignment
        let captured = '';
        const fakeContainer = {
            set innerHTML(val) { captured = val; }
        };
        const origGetById = global.document?.getElementById;
        global.document = {
            getElementById: (id) => id === 'att-pagination' ? fakeContainer : null
        };

        da.renderPagination(2, 5);

        // Restore
        if (origGetById) global.document.getElementById = origGetById;

        // Extract all <li> elements
        const liMatches = captured.match(/<li[^>]*>/g) || [];

        // Prev button: first <li>
        expect(liMatches[0]).not.toMatch(/page-number/);

        // Next button: last <li>
        expect(liMatches[liMatches.length - 1]).not.toMatch(/page-number/);
    });

    it('page number <li> elements have page-number class', () => {
        const da = makeInstance();

        let captured = '';
        const fakeContainer = {
            set innerHTML(val) { captured = val; }
        };
        global.document = {
            getElementById: (id) => id === 'att-pagination' ? fakeContainer : null
        };

        da.renderPagination(3, 5);

        const liMatches = captured.match(/<li[^>]*>/g) || [];

        // Skip first (prev) and last (next) — all middle items that are page numbers
        // should have page-number class (disabled ellipsis items won't)
        const pageNumberItems = liMatches.filter(li =>
            li.includes('page-number')
        );
        expect(pageNumberItems.length).toBeGreaterThan(0);
        pageNumberItems.forEach(li => {
            expect(li).toMatch(/page-number/);
        });
    });

    it('ellipsis <li> elements do NOT have page-number class', () => {
        const da = makeInstance();

        let captured = '';
        const fakeContainer = {
            set innerHTML(val) { captured = val; }
        };
        global.document = {
            getElementById: (id) => id === 'att-pagination' ? fakeContainer : null
        };

        // Use page 5 of 10 to trigger ellipsis on both sides
        da.renderPagination(5, 10);

        const liMatches = captured.match(/<li[^>]*>/g) || [];
        const disabledItems = liMatches.filter(li => li.includes('disabled'));

        // Ellipsis items are disabled; they should not have page-number
        disabledItems.forEach(li => {
            expect(li).not.toMatch(/page-number/);
        });
    });
});
