import { createRouter, createWebHashHistory } from 'vue-router'
import { store } from '../stores/appStore'
import UserLayout from '../layouts/UserLayout.vue'
import Login from '../views/auth/Login.vue'
import Register from '../views/auth/Register.vue'
import Home from '../views/user/Home.vue'
import EquipmentList from '../views/user/EquipmentList.vue'
import EquipmentDetail from '../views/user/EquipmentDetail.vue'
import Profile from '../views/user/Profile.vue'
import Dashboard from '../views/admin/Dashboard.vue'
import SecondHand from '../views/user/SecondHand.vue'
import Publish from '../views/user/Publish.vue'
import AIDetection from '../views/user/AIDetection.vue'
import Messages from '../views/user/Messages.vue'
import ChatRoom from '../views/user/ChatRoom.vue'
import NotFound from '../views/user/NotFound.vue'

const routes = [
  {
    path: '/',
    component: UserLayout,
    children: [
      { path: '', name: 'Home', component: Home },
      { path: 'rental', name: 'Rental', component: EquipmentList },
      { path: 'rental/:id', name: 'RentalDetail', component: EquipmentDetail, props: true },
      { path: 'secondhand', name: 'SecondHand', component: SecondHand },
      { path: 'publish', name: 'Publish', component: Publish, meta: { requiresAuth: true } },
      { path: 'ai-detection', name: 'AIDetection', component: AIDetection },
      { path: 'messages', name: 'Messages', component: Messages, meta: { requiresAuth: true } },
      { path: 'messages/chat', name: 'ChatRoom', component: ChatRoom, meta: { requiresAuth: true } },
      { path: 'profile', name: 'Profile', component: Profile, meta: { requiresAuth: true } },
      { path: 'dashboard', name: 'Dashboard', component: Dashboard, meta: { requiresAuth: true, requiresAdmin: true } }
    ]
  },
  { path: '/login', name: 'Login', component: Login },
  { path: '/register', name: 'Register', component: Register },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound }
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(to => {
  const user = store.currentUser.value
  if (to.meta.requiresAuth && !user) return { path: '/login', query: { redirect: to.fullPath } }
  if (to.meta.requiresAdmin && user?.role !== 'admin') return '/'
  if ((to.path === '/login' || to.path === '/register') && user) return '/'
  return true
})

export default router
