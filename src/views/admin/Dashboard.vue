<script setup>
import { computed } from 'vue'
import { store, statusText } from '../../stores/appStore'

const stats = computed(() => [
  { label: '器材总数', value: store.state.equipment.length },
  { label: '进行中订单', value: store.state.orders.filter(item => item.status === 'renting').length },
  { label: '待处理报修', value: store.state.repairs.filter(item => item.status === 'pending').length },
  { label: '注册用户', value: store.state.users.length }
])
function equipment(id) {
  return store.state.equipment.find(item => item.id === id)
}
function user(id) {
  return store.state.users.find(item => item.id === id)
}
</script>

<template>
  <main class="section">
    <div class="container dashboard-page">
      <div class="section-header">
        <div>
          <h1 class="section-title">管理后台</h1>
          <p class="section-subtitle">管理员可处理订单押金退还、报修状态和器材库存。</p>
        </div>
      </div>
      <section class="stats">
        <article v-for="item in stats" :key="item.label"><strong>{{ item.value }}</strong><span>{{ item.label }}</span></article>
      </section>

      <section class="admin-section">
        <h2>订单与押金</h2>
        <article v-for="order in store.state.orders" :key="order.id" class="order-card admin-row">
          <div>
            <strong>{{ equipment(order.equipmentId)?.name }}</strong>
            <p>{{ user(order.userId)?.name }} · 租期 {{ order.days }} 天 · 押金 {{ order.depositStatus === 'refunded' ? '已退还' : '已支付' }}</p>
          </div>
          <span class="badge badge-primary">{{ statusText(order.status) }}</span>
          <button class="btn btn-primary btn-sm" :disabled="order.status === 'completed'" @click="store.returnDeposit(order.id)">确认归还并退押金</button>
        </article>
        <p v-if="!store.state.orders.length" class="empty-state">暂无订单</p>
      </section>

      <section class="admin-section">
        <h2>报修处理</h2>
        <article v-for="repair in store.state.repairs" :key="repair.id" class="order-card admin-row">
          <div>
            <strong>{{ repair.type }} · {{ equipment(repair.equipmentId)?.name || '未知器材' }}</strong>
            <p>{{ user(repair.userId)?.name }}：{{ repair.description }}</p>
          </div>
          <span class="badge badge-warning">{{ statusText(repair.status) }}</span>
          <button class="btn btn-outline btn-sm" @click="store.updateRepair(repair.id, 'processing')">处理中</button>
          <button class="btn btn-primary btn-sm" @click="store.updateRepair(repair.id, 'done')">完成</button>
        </article>
        <p v-if="!store.state.repairs.length" class="empty-state">暂无报修</p>
      </section>

      <section class="admin-section">
        <h2>器材状态</h2>
        <article v-for="item in store.state.equipment" :key="item.id" class="order-card admin-row">
          <div><strong>{{ item.name }}</strong><p>{{ item.brand }} · ¥{{ item.price }}/天 · 押金 ¥{{ item.deposit }}</p></div>
          <select :value="item.status" @change="store.updateEquipmentStatus(item.id, $event.target.value)">
            <option value="available">可租赁</option>
            <option value="rented">租赁中</option>
            <option value="maintenance">维护中</option>
          </select>
          <span class="badge badge-primary">{{ statusText(item.status) }}</span>
        </article>
      </section>

      <section class="admin-section">
        <h2>用户权限</h2>
        <article v-for="account in store.state.users" :key="account.id" class="order-card admin-row">
          <div>
            <strong>{{ account.name }}</strong>
            <p>{{ account.studentId }} · {{ account.phone }}</p>
          </div>
          <span class="badge badge-primary">{{ account.role === 'admin' ? '管理员' : '普通用户' }}</span>
          <select :value="account.role" :disabled="account.id === store.currentUser.value?.id" @change="store.updateUserRole(account.id, $event.target.value)">
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
        </article>
      </section>
    </div>
  </main>
</template>
