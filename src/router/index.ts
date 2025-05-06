import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import HomePage from '../views/HomePage.vue';
import CameraPage from '../views/CameraPage.vue';
import MicrofonePage from '../views/MicrofonePage.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    name: 'Home',
    component: HomePage
  },
  {
    path: '/camera',
    name: 'Camera',
    component: CameraPage
  },
  {
    path: '/microfone',
    name: 'Microfone',
    component: MicrofonePage
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

export default router;
