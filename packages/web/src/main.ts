import { mountLayout } from './layout.js';
import { register, start } from './router.js';
import { mount, unmount } from 'svelte';
import Validator from './routes/Validator.svelte';
import PdfExtract from './routes/PdfExtract.svelte';
import './styles.css';

const mainSlot = mountLayout(document.querySelector('#app'));

let validatorUnmount: (() => void) | null = null;
register(
  '#/',
  () => {
    const instance = mount(Validator, { target: mainSlot! });
    validatorUnmount = () => unmount(instance);
  },
  () => {
    validatorUnmount?.();
    validatorUnmount = null;
  },
);
let pdfExtractUnmount: (() => void) | null = null;
register(
  '#/pdf-extract',
  () => {
    const instance = mount(PdfExtract, { target: mainSlot! });
    pdfExtractUnmount = () => unmount(instance);
  },
  () => {
    pdfExtractUnmount?.();
    pdfExtractUnmount = null;
  },
);
start();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
