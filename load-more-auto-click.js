```javascript
(async () => {
  let clicks = 0;
  let lastClickTime = null;

  const DELAY = 2500;
  const BUTTON_TEXT = 'Cargar más';

  const startTime = performance.now();

  const wait = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  const getTimestamp = () => {
    const now = new Date();

    return now.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const findLoadMoreButton = () =>
    [...document.querySelectorAll('*')]
      .find(element =>
        element.textContent?.trim() === BUTTON_TEXT &&
        element.offsetParent !== null
      );

  const simulateClick = element => {
    const { left, top, width, height } =
      element.getBoundingClientRect();

    const clientX = left + width / 2;
    const clientY = top + height / 2;

    ['mousedown', 'mouseup', 'click'].forEach(type => {
      element.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          clientX,
          clientY
        })
      );
    });
  };

  console.log(`[${getTimestamp()}] Inicio`);

  while (true) {
    const button = findLoadMoreButton();

    if (!button) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(3);

      console.log(
        `[${getTimestamp()}] Fin | ` +
        `Total: ${clicks} clics | ` +
        `Tiempo total: ${elapsed}s`
      );

      break;
    }

    const now = performance.now();

    const elapsed = ((now - startTime) / 1000).toFixed(3);

    const interval = lastClickTime === null
      ? '0.000'
      : ((now - lastClickTime) / 1000).toFixed(3);

    simulateClick(button);

    clicks++;
    lastClickTime = now;

    console.log(
      `[${getTimestamp()}] ` +
      `Clic #${clicks} | ` +
      `+${elapsed}s desde inicio | ` +
      `Δ ${interval}s`
    );

    await wait(DELAY);
  }
})();
```
