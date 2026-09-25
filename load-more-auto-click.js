```javascript
(async () => {
  let clicks = 0;

  const DELAY = 2500;
  const BUTTON_TEXT = 'Cargar más';

  const wait = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

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

    const mouseEvents = ['mousedown', 'mouseup', 'click'];

    mouseEvents.forEach(type => {
      element.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          clientX,
          clientY
        })
      );
    });
  };

  while (true) {
    const button = findLoadMoreButton();

    if (!button) {
      console.log(`No encuentro el botón "${BUTTON_TEXT}".`);
      break;
    }

    simulateClick(button);

    clicks++;
    console.log(`Clic ${clicks}`);

    await wait(DELAY);
  }

  console.log(`Proceso terminado. Total de clics: ${clicks}`);
})();
```
