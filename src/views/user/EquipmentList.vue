<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { store, statusText } from '../../stores/appStore'

const router = useRouter()
const keyword = ref('')
const category = ref('all')
const items = computed(() => store.state.equipment.filter(item => {
  const matchKeyword = `${item.name}${item.brand}${item.category}`.toLowerCase().includes(keyword.value.toLowerCase())
  const matchCategory = category.value === 'all' || item.category === category.value
  return matchKeyword && matchCategory
}))
const categories = computed(() => ['all', ...new Set(store.state.equipment.map(item => item.category))])

function favorite(id) {
  if (!store.currentUser.value) {
    router.push({ path: '/login', query: { redirect: '/rental' } })
    return
  }
  store.toggleFavorite(id)
}

function chatWithMerchant(item) {
  if (!store.currentUser.value) {
    router.push({ path: '/login', query: { redirect: '/rental' } })
    return
  }
  const merchantId = store.getMerchantId(item.id)
  const conv = store.getOrCreateConversation(store.currentUser.value.id, merchantId, item.id)
  router.push({ path: '/messages/chat', query: { id: conv.id } })
}
</script>

<template>
  <main>
    <div class="section-title">
      <h1>器材中心</h1>
      <input v-model="keyword" class="search" placeholder="搜索品牌、型号或类别" />
    </div>
    <div class="chips">
      <button v-for="item in categories" :key="item" :class="{ active: category === item }" @click="category = item">
        {{ item === 'all' ? '全部' : item }}
      </button>
    </div>
    <div class="card-grid">
      <article v-for="item in items" :key="item.id" class="equipment-card">
        <img :src="item.image" :alt="item.name" />
        <div>
          <p class="eyebrow">{{ item.brand }}</p>
          <h3>{{ item.name }}</h3>
          <p>{{ item.description }}</p>
          <div class="row">
            <strong>¥{{ item.price }}/天</strong>
            <span class="pill">{{ statusText(item.status) }}</span>
          </div>
          <div class="actions">
            <router-link class="btn btn-primary btn-sm" :to="`/rental/${item.id}`">查看详情</router-link>
            <button class="btn btn-outline btn-sm" @click="favorite(item.id)">
              {{ store.userFavorites.value.includes(item.id) ? '已收藏' : '收藏' }}
            </button>
            <button class="btn btn-accent btn-sm" @click="chatWithMerchant(item)">💬 联系商家</button>
          </div>
        </div>
      </article>
    </div>
  </main>
</template>
