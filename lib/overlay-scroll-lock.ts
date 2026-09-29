type LockedElement = {
  element: HTMLElement;
  overflow: string;
  overscrollBehavior: string;
};

type DocumentLockState = {
  count: number;
  locked: LockedElement[];
};

const documentLocks = new WeakMap<Document, DocumentLockState>();

function lockElement(element: HTMLElement): LockedElement {
  const locked = {
    element,
    overflow: element.style.overflow,
    overscrollBehavior: element.style.overscrollBehavior,
  };
  element.style.overflow = "hidden";
  element.style.overscrollBehavior = "none";
  return locked;
}

/**
 * Reference-counted blocking-overlay scroll ownership.
 *
 * The first overlay records the existing body/application-scroll styles and
 * the last overlay restores them. Nested overlays therefore cannot restore
 * page scrolling while another dialog still owns the lock, and unmounting a
 * route always releases its token.
 */
export function acquireBlockingOverlayScrollLock(doc: Document = document) {
  let state = documentLocks.get(doc);
  if (!state) {
    const appContent = doc.querySelector<HTMLElement>(".sg-app-content");
    state = {
      count: 0,
      locked: [doc.body, appContent].filter(
        (element): element is HTMLElement => Boolean(element),
      ).map(lockElement),
    };
    documentLocks.set(doc, state);
  }

  state.count += 1;
  doc.documentElement.dataset.sgOverlayLockCount = String(state.count);
  let released = false;

  return () => {
    if (released) return;
    released = true;
    const current = documentLocks.get(doc);
    if (!current) return;
    current.count = Math.max(0, current.count - 1);
    if (current.count > 0) {
      doc.documentElement.dataset.sgOverlayLockCount = String(current.count);
      return;
    }

    current.locked.forEach(({ element, overflow, overscrollBehavior }) => {
      element.style.overflow = overflow;
      element.style.overscrollBehavior = overscrollBehavior;
    });
    delete doc.documentElement.dataset.sgOverlayLockCount;
    documentLocks.delete(doc);
  };
}

