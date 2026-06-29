<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { store } from '../stores/appStore'

const router = useRouter()
const route = useRoute()
const user = store.currentUser
const unread = computed(() => store.state.notifications.filter(item => item.userId === user.value?.id && !item.read).length)
const chatUnread = computed(() => user.value ? store.getUnreadChatCount(user.value.id) : 0)
const totalUnread = computed(() => unread.value + chatUnread.value)
const isOpen = ref(false)

onMounted(() => store.checkDueReminders())

watch(() => route.path, () => { isOpen.value = false })

function logout() {
  store.logout()
  router.push('/')
}
</script>

<template>
  <div>
    <header class="navbar">
      <div class="navbar-inner">
        <router-link class="logo" to="/">
          <span class="logo-icon">📷</span>
          <span class="logo-text">CameraHub</span>
        </router-link>
        <nav class="nav-links" :class="{ open: isOpen }">
          <router-link to="/" @click="isOpen = false">首页</router-link>
          <router-link to="/rental" @click="isOpen = false">租赁</router-link>
          <router-link to="/secondhand" @click="isOpen = false">二手交易</router-link>
          <router-link to="/publish" @click="isOpen = false">发布闲置</router-link>
          <router-link to="/ai-detection" @click="isOpen = false">AI检测</router-link>
          <router-link v-if="user" to="/messages" @click="isOpen = false">消息 <b v-if="chatUnread">{{ chatUnread }}</b></router-link>
          <router-link v-if="user" to="/profile" @click="isOpen = false">我的 <b v-if="unread">{{ unread }}</b></router-link>
          <router-link v-if="store.isAdmin.value" to="/dashboard" @click="isOpen = false">管理后台</router-link>
        </nav>
        <div class="nav-right">
          <router-link v-if="!user" class="btn btn-ghost btn-sm" to="/login">登录</router-link>
          <button v-else class="nav-user" @click="router.push('/profile')">
            <span>👤</span>
            <span>{{ user.name }}</span>
          </button>
          <button v-if="user" class="btn btn-outline btn-sm" @click="logout">退出</button>
          <button class="menu-btn" @click="isOpen = !isOpen"><span :class="{ open: isOpen }"></span></button>
        </div>
      </div>
    </header>
    <section class="main-content">
      <router-view />
    </section>
    <footer class="footer">
      <div class="container footer-grid">
        <div>
          <div class="footer-logo"><span>📷</span><span class="logo-text">CameraHub</span></div>
          <p>专业、安全、透明的一站式相机租赁与二手交易平台。</p>
        </div>
        <div><h4>服务</h4><router-link to="/rental">器材租赁</router-link><router-link to="/secondhand">二手交易</router-link></div>
        <div><h4>账户</h4><router-link to="/profile">个人中心</router-link><router-link to="/messages">我的消息</router-link><router-link to="/publish">发布闲置</router-link></div>
        <div><h4>保障</h4><router-link to="/ai-detection">AI保真检测</router-link><router-link to="/profile">订单提醒</router-link></div>
      </div>
    </footer>
  </div>
</template>
