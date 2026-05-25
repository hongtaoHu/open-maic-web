// SPDX-License-Identifier: AGPL-3.0
import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import SvgIcon from './components/SvgIcon.vue';
import router from './router';
import { useThemeStore } from './stores/theme';
import { initThemeFromStorage } from './theme';
import './style.css';

initThemeFromStorage();

const app = createApp(App);
app.component('SvgIcon', SvgIcon);
const pinia = createPinia();
app.use(pinia);
app.use(router);

useThemeStore(pinia).init();

app.mount('#app');
