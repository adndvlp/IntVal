// WebKit móvil no desplaza siempre una región enfocada con las flechas.
// Sólo actuar sobre la región: sus controles y Tab conservan su comportamiento.
export function scrollRegionOnArrow(event: {
  key: string;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  preventDefault(): void;
}) {
  const region = event.currentTarget;
  if (
    !(region instanceof HTMLElement) ||
    event.target !== region ||
    !['ArrowLeft', 'ArrowRight'].includes(event.key)
  )
    return;
  event.preventDefault();
  region.scrollBy({
    left: (event.key === 'ArrowRight' ? 1 : -1) * region.clientWidth * 0.75,
    behavior: 'auto',
  });
}
