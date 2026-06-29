<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../../stores/appStore'

const router = useRouter()
const role = ref('user') // 'user' | 'merchant'
const error = ref('')
const form = reactive({ name: '', studentId: '', phone: '', password: '', shopName: '' })

function submit() {
  error.value = ''
  if (role.value === 'merchant' && !form.shopName.trim()) {
    error.value = '请输入店铺名称'
    return
  }
  const payload = {
    name: form.name,
    studentId: form.studentId,
    phone: form.phone,
    password: form.password,
    role: role.value,
    shopName: role.value === 'merchant' ? form.shopName.trim() : undefined
  }
  const result = store.register(payload)
  if (!result.ok) {
    error.value = result.message
    return
  }
  router.push('/')
}
</script>

<template>
  <main class="login-page">
    <section class="login-container register-container">
      <div class="login-left">
        <router-link to="/" class="form-logo"><span>📷</span><span class="logo-text">CameraHub</span></router-link>
        <h1 class="form-title">创建账户</h1>
        <p class="form-subtitle">{{ role === 'merchant' ? '入驻 CameraHub，上架你的摄影器材' : '注册后即可租赁器材、收藏设备并接收订单提醒。' }}</p>
        <form class="login-form" @submit.prevent="submit">
          <!-- 身份选择 -->
          <div class="segmented role-tabs">
            <button type="button" :class="{ active: role === 'user' }" @click="role = 'user'">🧑 个人用户</button>
            <button type="button" :class="{ active: role === 'merchant' }" @click="role = 'merchant'">🏪 商家入驻</button>
          </div>

          <!-- 商家专属字段 -->
          <label v-if="role === 'merchant'">店铺名称<input v-model="form.shopName" required placeholder="例如：索尼官方器材店" /></label>

          <label>姓名 / 联系人<input v-model="form.name" required :placeholder="role === 'merchant' ? '请输入联系人姓名' : '请输入姓名'" /></label>
          <label>{{ role === 'merchant' ? '商家账号' : '账号' }}<input v-model="form.studentId" required :placeholder="role === 'merchant' ? '设置登录账号' : '请输入学号'" /></label>
          <label>手机号<input v-model="form.phone" required placeholder="请输入手机号" /></label>
          <label>密码<input v-model="form.password" type="password" minlength="6" required placeholder="至少 6 位" /></label>
          <p v-if="error" class="error">{{ error }}</p>
          <button class="btn btn-primary btn-lg login-btn" type="submit">{{ role === 'merchant' ? '商家入驻' : '注册并登录' }}</button>
          <p class="to-register">已有账号？<router-link to="/login">返回登录</router-link></p>
        </form>
      </div>
      <div class="login-right compact">
        <div class="right-overlay"></div>
        <div class="right-content">
          <h2>{{ role === 'merchant' ? '商家入驻 CameraHub' : '加入 CameraHub' }}</h2>
          <p>{{ role === 'merchant' ? '上架器材 · 管理订单 · 客户沟通' : '学号认证 · 押金模拟 · 报修闭环 · 到期提醒' }}</p>
        </div>
      </div>
    </section>
  </main>
</template>
