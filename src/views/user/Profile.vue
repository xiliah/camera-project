<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { store, statusText } from '../../stores/appStore'

const router = useRouter()
const active = ref('orders')
const tabs = [
  { key: 'orders', icon: '📋', label: '我的订单' },
  { key: 'repairs', icon: '🛠️', label: '器材报修' },
  { key: 'favorites', icon: '❤️', label: '我的收藏' },
  { key: 'messages', icon: '🔔', label: '消息通知' },
  { key: 'settings', icon: '⚙️', label: '账号设置' }
]
const user = store.currentUser
const orders = computed(() => store.state.orders.filter(item => item.userId === user.value?.id))
const repairs = computed(() => store.state.repairs.filter(item => item.userId === user.value?.id))
const favorites = computed(() => store.state.equipment.filter(item => store.userFavorites.value.includes(item.id)))
const notices = computed(() => store.state.notifications.filter(item => item.userId === user.value?.id))
const repairForm = ref({ equipmentId: '', type: '功能异常', description: '' })

function equipment(id) {
  return store.state.equipment.find(item => item.id === id)
}

function submitRepair() {
  store.createRepair({ ...repairForm.value })
  repairForm.value = { equipmentId: '', type: '功能异常', description: '' }
}

function logout() {
  store.logout()
  router.push('/')
}
</script>

<template>
  <main class="profile-page">
    <div class="container profile-container">
      <aside class="profile-sidebar">
        <div class="user-card">
          <span class="user-avatar">👤</span>
          <h3>{{ user?.name }}</h3>
          <span class="badge badge-primary">{{ user?.role === 'admin' ? '管理员' : '普通用户' }}</span>
          <p>{{ user?.studentId }} · {{ user?.phone }}</p>
        </div>
        <nav class="profile-nav">
          <button v-for="tab in tabs" :key="tab.key" :class="{ active: active === tab.key }" @click="active = tab.key">
            <span>{{ tab.icon }}</span>{{ tab.label }}
          </button>
          <button v-if="store.isAdmin.value" @click="router.push('/dashboard')">🧭 管理后台</button>
          <button class="logout" @click="logout">🚪 退出登录</button>
        </nav>
      </aside>

      <section class="profile-content">
        <div v-if="active === 'orders'" class="content-section">
          <h2>我的订单</h2>
          <p v-if="!orders.length" class="empty-state">暂无订单，去租赁页面看看吧。</p>
          <article v-for="order in orders" :key="order.id" class="order-card">
            <div class="order-header">
              <strong>订单号：{{ order.id }}</strong>
              <span class="badge badge-primary">{{ statusText(order.status) }}</span>
            </div>
            <div class="order-body">
              <strong>{{ equipment(order.equipmentId)?.name }}</strong>
              <p>租期 {{ order.days }} 天 · 到期 {{ new Date(order.dueAt).toLocaleDateString() }}</p>
              <p>押金 ¥{{ order.deposit }} · {{ order.depositStatus === 'refunded' ? '押金已退还' : '押金已支付' }}</p>
            </div>
            <div class="order-footer">合计租金 ¥{{ order.rentTotal }}</div>
          </article>
        </div>

        <div v-if="active === 'repairs'" class="content-section">
          <h2>器材报修</h2>
          <form class="inline-form" @submit.prevent="submitRepair">
            <select v-model="repairForm.equipmentId" required>
              <option disabled value="">选择报修器材</option>
              <option v-for="order in orders" :key="order.id" :value="order.equipmentId">{{ equipment(order.equipmentId)?.name }}</option>
            </select>
            <select v-model="repairForm.type"><option>功能异常</option><option>外观损坏</option><option>配件缺失</option></select>
            <input v-model="repairForm.description" required placeholder="描述故障现象" />
            <button class="btn btn-primary" type="submit">提交报修</button>
          </form>
          <article v-for="repair in repairs" :key="repair.id" class="order-card">
            <div class="order-header"><strong>{{ repair.type }}</strong><span class="badge badge-warning">{{ statusText(repair.status) }}</span></div>
            <p>{{ repair.description }}</p>
          </article>
        </div>

        <div v-if="active === 'favorites'" class="content-section">
          <h2>我的收藏</h2>
          <div class="favorites-grid">
            <p v-if="!favorites.length" class="empty-state">暂无收藏</p>
            <article v-for="item in favorites" :key="item.id" class="mini-card">
              <img :src="item.image" :alt="item.name" />
              <h3>{{ item.name }}</h3>
              <router-link class="btn btn-ghost btn-sm" :to="`/rental/${item.id}`">查看详情</router-link>
            </article>
          </div>
        </div>

        <div v-if="active === 'messages'" class="content-section">
          <h2>消息通知</h2>
          <button class="btn btn-outline btn-sm" @click="store.markAllRead">全部已读</button>
          <article v-for="notice in notices" :key="notice.id" class="order-card">
            <div class="order-header"><strong>{{ notice.type }}</strong><span>{{ new Date(notice.createdAt).toLocaleString() }}</span></div>
            <p>{{ notice.message }}</p>
          </article>
          <p v-if="!notices.length" class="empty-state">暂无消息</p>
        </div>

        <div v-if="active === 'settings'" class="content-section">
          <h2>账号设置</h2>
          <div class="settings-form">
            <label>姓名<input :value="user?.name" disabled /></label>
            <label>学号<input :value="user?.studentId" disabled /></label>
            <label>手机号<input :value="user?.phone" /></label>
            <label>角色<input :value="user?.role === 'admin' ? '管理员' : '普通用户'" disabled /></label>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
