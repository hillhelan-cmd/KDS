import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'customer',
    component: () => import('../views/CustomerView.vue'),
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../views/AdminView.vue'),
  },
  {
    path: '/kds',
    name: 'kds',
    component: () => import('../views/KdsView.vue'),
  },
  {
    path: '/kiosk',
    name: 'kiosk',
    component: () => import('../views/KioskView.vue'),
  },
  {
    path: '/public-view',
    name: 'public-view',
    component: () => import('../views/PublicView.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})