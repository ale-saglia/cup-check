import { mountLayout } from './layout.js';
import { register, start } from './router.js';
import { mount, unmount } from 'svelte';
import Validator from './routes/Validator.svelte';
import {
  mount as mountPdfExtract,
  unmount as unmountPdfExtract,
} from './views/pdf-extract-view.js';
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
register('#/pdf-extract', () => mountPdfExtract(mainSlot), unmountPdfExtract);
start();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
