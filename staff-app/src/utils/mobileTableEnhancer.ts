const MOBILE_QUERY = '(max-width: 768px)';
const SWIPE_THRESHOLD = 36;
const SWIPE_RESET_MS = 900;

type CleanupFn = () => void;

function getHeaderLabels(table: HTMLTableElement): string[] {
  return Array.from(table.querySelectorAll('thead th')).map((header) =>
    (header.textContent || '').replace(/\s+/g, ' ').trim() || 'Field',
  );
}

function applyRowLabels(table: HTMLTableElement, isMobile: boolean) {
  const labels = getHeaderLabels(table);
  const rows = table.querySelectorAll('tbody tr');

  rows.forEach((row) => {
    const cells = row.querySelectorAll('td');
    cells.forEach((cell, index) => {
      if (isMobile) {
        cell.setAttribute('data-label', labels[index] || `Field ${index + 1}`);
      } else {
        cell.removeAttribute('data-label');
      }
    });
  });
}

function bindSwipeFeedback(row: HTMLTableRowElement): CleanupFn {
  let startX = 0;
  let startY = 0;

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  };

  const onTouchEnd = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;

    const swipeClass = dx < 0 ? 'mobile-swipe-left' : 'mobile-swipe-right';
    row.classList.add(swipeClass);

    window.setTimeout(() => {
      row.classList.remove(swipeClass);
    }, SWIPE_RESET_MS);
  };

  row.addEventListener('touchstart', onTouchStart, { passive: true });
  row.addEventListener('touchend', onTouchEnd, { passive: true });

  return () => {
    row.removeEventListener('touchstart', onTouchStart);
    row.removeEventListener('touchend', onTouchEnd);
  };
}

export function enableMobileTableEnhancer(): CleanupFn {
  const cleanups = new Map<HTMLTableRowElement, CleanupFn>();
  const mediaQuery = window.matchMedia(MOBILE_QUERY);

  const sync = () => {
    const isMobile = mediaQuery.matches;
    const tables = document.querySelectorAll<HTMLTableElement>('.mobile-friendly-table');

    tables.forEach((table) => {
      applyRowLabels(table, isMobile);

      table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
        if (cleanups.has(row)) return;
        cleanups.set(row, bindSwipeFeedback(row));
      });
    });

    cleanups.forEach((cleanup, row) => {
      if (!row.isConnected) {
        cleanup();
        cleanups.delete(row);
      }
    });
  };

  sync();

  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('resize', sync, { passive: true });
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', sync);
  }

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', sync);

    if (mediaQuery.removeEventListener) {
      mediaQuery.removeEventListener('change', sync);
    }

    cleanups.forEach((cleanup) => cleanup());
    cleanups.clear();
  };
}
