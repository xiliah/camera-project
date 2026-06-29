<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../../stores/appStore'

const router = useRouter()
const loading = ref(true)
const activeSlide = ref(0)
let timer = null

const heroSlides = [
  {
    image: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1920&h=900&fit=crop',
    title: '租得放心，买得安心',
    subtitle: '专业相机租赁与二手保真交易平台',
    btn1: '立即租赁',
    btn1Link: '/rental',
    btn2: '浏览二手',
    btn2Link: '/secondhand'
  },
  {
    image: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1920&h=900&fit=crop',
    title: 'AI智能检测，正品保障',
    subtitle: 'AI真伪检测 · 设备估值 · 智能推荐',
    btn1: 'AI检测中心',
    btn1Link: '/ai-detection',
    btn2: '了解更多',
    btn2Link: '/rental'
  },
  {
    image: 'https://images.unsplash.com/photo-1501031170107-cfd33f0cbdcc?w=1920&h=900&fit=crop',
    title: '从入门到专业，一站配齐',
    subtitle: '20+品牌 · 100+设备 · 专业服务',
    btn1: '开始探索',
    btn1Link: '/rental',
    btn2: '发布闲置',
    btn2Link: '/publish'
  }
]

const advantages = [
  { icon: '🛡️', title: '实名认证', desc: '所有用户实名认证，交易安全有保障' },
  { icon: '🔍', title: '官方检测', desc: '专业设备检测团队，品质层层把关' },
  { icon: '🤖', title: 'AI估值', desc: 'AI智能估值系统，价格公平透明' },
  { icon: '🔧', title: '售后保障', desc: '报修处理与押金退还流程可追踪' }
]

const featured = computed(() => store.state.equipment.slice(0, 8))
const secondhand = computed(() => store.state.equipment.slice(0, 4))

onMounted(() => {
  setTimeout(() => {
    loading.value = false
  }, 600)
  timer = setInterval(() => {
    activeSlide.value = (activeSlide.value + 1) % heroSlides.length
  }, 5000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function chatWithMerchant(item) {
  if (!store.currentUser.value) {
    router.push({ path: '/login', query: { redirect: '/' } })
    return
  }
  const merchantId = store.getMerchantId(item.id)
  const conv = store.getOrCreateConversation(store.currentUser.value.id, merchantId, item.id)
  router.push({ path: '/messages/chat', query: { id: conv.id } })
}
</script>

<template>
  <main class="home">
    <section class="home-hero">
      <div class="hero-slide" :style="{ backgroundImage: `url(${heroSlides[activeSlide].image})` }"></div>
      <div class="hero-overlay"></div>
      <div class="hero-content container">
        <h1>{{ heroSlides[activeSlide].title }}</h1>
        <p>{{ heroSlides[activeSlide].subtitle }}</p>
        <div class="hero-btns">
          <router-link class="btn btn-primary btn-lg" :to="heroSlides[activeSlide].btn1Link">{{ heroSlides[activeSlide].btn1 }}</router-link>
          <router-link class="btn btn-outline btn-lg hero-outline" :to="heroSlides[activeSlide].btn2Link">{{ heroSlides[activeSlide].btn2 }}</router-link>
          <router-link class="btn btn-accent btn-lg" to="/ai-detection">🤖 AI检测</router-link>
        </div>
      </div>
      <div class="hero-indicators">
        <button v-for="(_, index) in heroSlides" :key="index" :class="{ active: index === activeSlide }" @click="activeSlide = index"></button>
      </div>
    </section>

    <section class="section featured">
      <div class="container">
        <div class="section-header">
          <div>
            <h2 class="section-title">🔥 热门设备</h2>
            <p class="section-subtitle">精选最受欢迎的相机与设备</p>
          </div>
          <router-link to="/rental" class="btn btn-ghost">查看全部 →</router-link>
        </div>
        <div class="card-grid">
          <article v-for="item in featured" :key="item.id" class="equipment-card">
            <img :src="item.image" :alt="item.name" />
            <div>
              <span class="badge badge-primary">{{ item.category }}</span>
              <h3>{{ item.name }}</h3>
              <p>{{ item.description }}</p>
              <div class="actions" style="margin-top:10px;">
                <strong>¥{{ item.price }}/天</strong>
                <router-link class="btn btn-ghost btn-sm" :to="`/rental/${item.id}`">查看详情</router-link>
                <button class="btn btn-accent btn-sm" @click="chatWithMerchant(item)">💬 联系商家</button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="section advantages">
      <div class="container">
        <h2 class="section-title center">为什么选择 CameraHub</h2>
        <p class="section-subtitle center">专业、安全、透明的一站式相机服务平台</p>
        <div class="advantages-grid">
          <article v-for="item in advantages" :key="item.title" class="advantage-card">
            <div class="adv-icon">{{ item.icon }}</div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.desc }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section secondhand-section">
      <div class="container">
        <div class="section-header">
          <div>
            <h2 class="section-title">💰 二手好物</h2>
            <p class="section-subtitle">经过AI检测认证的优质二手设备</p>
          </div>
          <router-link to="/secondhand" class="btn btn-ghost">浏览更多 →</router-link>
        </div>
        <div class="products-grid">
          <article v-for="item in secondhand" :key="item.id" class="product-card">
            <img :src="item.image" :alt="item.name" />
            <div class="product-body">
              <span class="badge badge-success">AI检测通过</span>
              <h3>{{ item.name }}</h3>
              <p>{{ item.description }}</p>
              <div class="row"><strong>¥{{ Math.round(item.deposit * 0.5) }}</strong><span>{{ item.brand }}</span></div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="cta-section">
      <div class="container cta-inner">
        <h2>准备好开始你的影像之旅了吗？</h2>
        <p>加入 CameraHub，享受专业、安全、透明的相机租赁与交易服务</p>
        <div class="hero-btns">
          <router-link to="/rental" class="btn btn-primary btn-lg">立即租赁</router-link>
          <router-link to="/publish" class="btn btn-accent btn-lg">发布闲置</router-link>
        </div>
      </div>
    </section>
  </main>
</template>
