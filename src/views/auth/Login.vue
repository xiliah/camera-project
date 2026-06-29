<script setup>
import { reactive, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store } from '../../stores/appStore'

const router = useRouter()
const route = useRoute()
const role = ref('user') // 'user' | 'merchant'
const tab = ref('student')
const error = ref('')
const codeSent = ref(false)
const loading = ref(false)
const form = reactive({ studentId: '', password: '', phone: '', code: '' })

const quickAccounts = computed(() => {
  if (role.value === 'merchant') {
    return [
      { label: '索尼专卖店', id: 'merchant01', pwd: '123456', phone: '13800000002' },
      { label: '佳能旗舰店', id: 'merchant02', pwd: '123456', phone: '13800000003' }
    ]
  }
  return [
    { label: 'Student User', id: '20240001', pwd: '123456', phone: '13800000001' },
    { label: 'Admin', id: 'admin', pwd: 'admin123', phone: '13800000000' }
  ]
})

function fillQuick(acc) {
  form.studentId = acc.id
  form.password = acc.pwd
  form.phone = acc.phone
}

function goHome(user) {
  const dest = user.role === 'admin' ? '/dashboard' : '/'
  router.push(route.query.redirect || dest)
}

async function login() {
  error.value = ''
  loading.value = true
  await new Promise(resolve => setTimeout(resolve, 500))
  const result = tab.value === 'student'
    ? store.loginByStudent(form.studentId, form.password)
    : store.loginByCode(form.phone, form.code)
  loading.value = false
  if (!result.ok) {
    error.value = result.message
    return
  }
  goHome(result.user)
}

function sendCode() {
  codeSent.value = true
  form.code = '246810'
}
</script>

<template>
  <main class="login-page">
    <section class="login-container">
      <div class="login-left">
        <router-link to="/" class="form-logo"><span>📷</span><span class="logo-text">CameraHub</span></router-link>
        <h1 class="form-title">欢迎回来</h1>
        <p class="form-subtitle">登录你的 CameraHub 账户</p>
        <form class="login-form" @submit.prevent="login">
          <!-- 身份选择 -->
          <div class="segmented role-tabs">
            <button type="button" :class="{ active: role === 'user' }" @click="role = 'user'">🧑 个人用户</button>
            <button type="button" :class="{ active: role === 'merchant' }" @click="role = 'merchant'">🏪 商家</button>
          </div>
          <!-- 登录方式 -->
          <div class="segmented">
            <button type="button" :class="{ active: tab === 'student' }" @click="tab = 'student'">账号登录</button>
            <button type="button" :class="{ active: tab === 'code' }" @click="tab = 'code'">验证码登录</button>
          </div>
          <template v-if="tab === 'student'">
            <label>{{ role === 'merchant' ? '商家账号' : '账号' }}<input v-model="form.studentId" required :placeholder="role === 'merchant' ? 'merchant01' : '20240001 或 admin'" /></label>
            <label>密码<input v-model="form.password" type="password" required placeholder="123456" /></label>
          </template>
          <template v-else>
            <label>手机号<input v-model="form.phone" required :placeholder="role === 'merchant' ? '13800000002' : '13800000001'" /></label>
            <div class="inline-field">
              <label>验证码<input v-model="form.code" required placeholder="246810" /></label>
              <button type="button" class="btn btn-outline" @click="sendCode">{{ codeSent ? '已发送' : '发送' }}</button>
            </div>
          </template>

          <!-- 快速登录账号提示 -->
          <div class="quick-accounts">
            <span class="quick-label">快速填充：</span>
            <button v-for="acc in quickAccounts" :key="acc.id" type="button" class="quick-chip" @click="fillQuick(acc)">{{ acc.label }}</button>
          </div>

          <p v-if="error" class="error">{{ error }}</p>
          <button class="btn btn-primary btn-lg login-btn" type="submit" :disabled="loading">
            <span v-if="loading" class="spinner"></span>{{ loading ? '登录中...' : (role === 'merchant' ? '商家登录' : '登录') }}
          </button>
          <p class="to-register">还没有账号？<router-link to="/register">立即注册</router-link></p>
        </form>
      </div>
      <div class="login-right">
        <div class="right-overlay"></div>
        <div class="right-content">
          <h2>记录每一刻精彩</h2>
          <p>专业设备 · AI保真 · 放心租赁</p>
          <div class="stats">
            <div><strong>10,000+</strong><span>注册用户</span></div>
            <div><strong>500+</strong><span>专业设备</span></div>
            <div><strong>99.8%</strong><span>好评率</span></div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
