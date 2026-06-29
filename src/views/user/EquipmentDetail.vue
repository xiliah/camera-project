<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, statusText } from '../../stores/appStore'

const route = useRoute()
const router = useRouter()
const days = ref(3)
const message = ref('')
const item = computed(() => store.state.equipment.find(entry => entry.id === route.params.id))
const total = computed(() => item.value ? item.value.price * Number(days.value) : 0)

function order() {
  message.value = ''
  if (!store.currentUser.value) {
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  const result = store.createOrder(item.value.id, days.value)
  if (result.ok) {
    router.push('/profile')
    return
  }
  message.value = result.message
}

function favorite() {
  if (!store.currentUser.value) {
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  store.toggleFavorite(item.value.id)
}

function chatWithMerchant() {
  if (!store.currentUser.value) {
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  const merchantId = store.getMerchantId(item.value.id)
  const conv = store.getOrCreateConversation(store.currentUser.value.id, merchantId, item.value.id)
  router.push({ path: '/messages/chat', query: { id: conv.id } })
}
</script>

<template>
  <main v-if="item" class="detail-grid">
    <img class="detail-image" :src="item.image" :alt="item.name" />
    <section class="detail-panel">
      <p class="eyebrow">{{ item.category }}</p>
      <h1>{{ item.name }}</h1>
      <p>{{ item.description }}</p>
      <div class="spec-list">
        <span v-for="spec in item.specs" :key="spec">{{ spec }}</span>
      </div>
      <div class="price-box">
        <div><span>租金</span><strong>¥{{ item.price }}/天</strong></div>
        <div><span>押金</span><strong>¥{{ item.deposit }}</strong></div>
        <div><span>状态</span><strong>{{ statusText(item.status) }}</strong></div>
      </div>
      <label>租赁天数<input v-model="days" type="number" min="1" max="30" /></label>
      <p class="muted">模拟支付金额：租金 ¥{{ total }} + 押金 ¥{{ item.deposit }}</p>
      <p v-if="message" class="error">{{ message }}</p>
      <div class="actions">
        <button class="btn btn-primary" :disabled="item.status !== 'available'" @click="order">支付押金并下单</button>
        <button class="btn btn-outline" @click="favorite">
          {{ store.userFavorites.value.includes(item.id) ? '取消收藏' : '收藏器材' }}
        </button>
        <button class="btn btn-accent" @click="chatWithMerchant">💬 联系商家</button>
      </div>
    </section>
  </main>
</template>
