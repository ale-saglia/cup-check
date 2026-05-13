import { mountLayout } from './layout.js';
import { register, start } from './router.js';
import { mount as mountValidator, unmount as unmountValidator } from './views/validator-view.js';
import { mount as mountPdfExtract, unmount as unmountPdfExtract } from './views/pdf-extract-view.js';
import './styles.css';

const mainSlot = mountLayout(document.querySelector('#app'));

register('#/', () => mountValidator(mainSlot), unmountValidator);
register('#/pdf-extract', () => mountPdfExtract(mainSlot), unmountPdfExtract);
start();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
