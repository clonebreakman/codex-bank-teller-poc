export function renderReviewClientScript(): string {
  return `(() => {
  const root = document.body;
  const endpoint = root.dataset.actionEndpoint;
  const actorId = root.dataset.actorId;
  const note = document.querySelector('[data-testid="action-note"]');
  const status = document.querySelector('[data-testid="review-status"]');
  const error = document.querySelector('[data-testid="review-error"]');
  const buttons = Array.from(document.querySelectorAll('[data-action]'));
  const initialDisabled = new Map(buttons.map((button) => [button, button.disabled]));

  if (!endpoint || !actorId || !(note instanceof HTMLTextAreaElement) ||
      !(status instanceof HTMLElement) || !(error instanceof HTMLElement)) {
    return;
  }

  const setButtonsDisabled = (disabled) => {
    for (const button of buttons) {
      if (button instanceof HTMLButtonElement) button.disabled = disabled;
    }
  };

  const restoreButtons = () => {
    const currentStatus = status.dataset.status;
    for (const button of buttons) {
      if (button instanceof HTMLButtonElement) {
        const duplicateConfirm = currentStatus === "confirmed" && button.dataset.action === "confirm";
        button.disabled = duplicateConfirm || (initialDisabled.get(button) ?? false);
      }
    }
  };

  const setTerminal = () => setButtonsDisabled(true);

  for (const button of buttons) {
    if (!(button instanceof HTMLButtonElement)) continue;
    button.addEventListener('click', async () => {
      const action = button.dataset.action;
      if (!action || !endpoint || !actorId) return;
      setButtonsDisabled(true);
      error.textContent = '';
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, actorId, note: note.value }),
        });
        const payload = await response.json();
        if (!response.ok || payload.ok !== true) {
          error.textContent = String(payload.reason ?? 'ACTION_REJECTED');
          restoreButtons();
          return;
        }
        const nextStatus = String(payload.review.status);
        status.dataset.status = nextStatus;
        status.textContent = '状态：' + nextStatus;
        if (payload.review.executed !== false) {
          error.textContent = 'EXECUTION_FLAG_INVALID';
          setButtonsDisabled(true);
          return;
        }
        if (nextStatus === 'handed_off' || nextStatus === 'rejected') {
          setTerminal();
        } else {
          restoreButtons();
        }
      } catch {
        error.textContent = 'ACTION_REQUEST_FAILED';
        restoreButtons();
      }
    });
  }
})();`;
}
