<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../../stores/appStore'

const router = useRouter()
const items = computed(() => store.state.equipment.map((item, index) => ({
  ...item,
  salePrice: Math.round(item.deposit * (0.42 + index * 0.05)),
  condition: ['95新', '9成新', '轻微使用痕迹', '认证良品'][index % 4]
})))

function favorite(id) {
  if (!store.currentUser.value) {
    router.push({ path: '/login', query: { redirect: '/secondhand' } })
    return
  }
  store.toggleFavorite(id)
}

function chatWithMerchant(item) {
  if (!store.currentUser.value) {
    router.push({ path: '/login', query: { redirect: '/secondhand' } })
    return
  }
  const merchantId = store.getMerchantId(item.id)
  const conv = store.getOrCreateConversation(store.currentUser.value.id, merchantId, item.id)
  router.push({ path: '/messages/chat', query: { id: conv.id } })
}
</script>

<template>
  <main class="section">
    <div class="container">
      <div class="section-header">
        <div>
          <h1 class="section-title">💰 二手好物</h1>
          <p class="section-subtitle">延续原站二手交易入口，增加收藏、AI保真和发布联动。</p>
        </div>
        <router-link class="btn btn-accent" to="/publish">发布闲置</router-link>
      </div>
      <div class="products-grid">
        <article v-for="item in items" :key="item.id" class="product-card">
          <img :src="item.image" :alt="item.name" />
          <div class="product-body">
            <span class="badge badge-success">{{ item.condition }}</span>
            <h3>{{ item.name }}</h3>
            <p>{{ item.description }}</p>
            <div class="row"><strong>¥{{ item.salePrice }}</strong><span>AI检测通过</span></div>
            <div class="row" style="margin-top:8px;">
              <button class="btn btn-ghost btn-sm" @click="favorite(item.id)">
                {{ store.userFavorites.value.includes(item.id) ? '已收藏' : '收藏' }}
              </button>
              <button class="btn btn-accent btn-sm" @click="chatWithMerchant(item)">💬 联系商家</button>
            </div>
          </div>
        </article>
      </div>
    </div>
  </main>
</template>
