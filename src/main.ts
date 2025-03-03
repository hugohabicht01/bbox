import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";
import { createPinia } from "pinia";
import App from "./App.vue";

import "@unocss/reset/tailwind.css";
import "./styles/main.css";
import "uno.css";

const pinia = createPinia();
const app = createApp(App);
const router = createRouter({
  routes,
  history: createWebHistory(import.meta.env.BASE_URL),
});

app.use(router);
app.use(pinia);
app.mount("#app");

// confirmation dialog before leaving the page
window.addEventListener("beforeunload", (event) => {
  event.preventDefault(); // Required for modern browsers
});
