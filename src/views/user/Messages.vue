<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../../stores/appStore'

const router = useRouter()
const user = store.currentUser

const conversations = computed(() => {
  if (!user.value) return []
  return store.getUserConversations(user.value.id).map(conv => {
    const otherId = conv.userAId === user.value.id ? conv.userBId : conv.userAId
    const otherUser = store.state.users.find(u => u.id === otherId)
    const equipment = store.state.equipment.find(e => e.id === conv.equipmentId)
    const unread = conv.userAId === user.value.id ? !conv.readByA : !conv.readByB
    return { ...conv, otherUser, equipment, unread }
  })
})

function openChat(conv) {
  router.push({ path: '/messages/chat', query: { id: conv.id } })
}

function startChat(equipmentId) {
  if (!user.value) {
    router.push({ path: '/login', query: { redirect: '/messages' } })
    return
  }
  const merchantId = store.getMerchantId(equipmentId)
  const conv = store.getOrCreateConversation(user.value.id, merchantId, equipmentId)
  router.push({ path: '/messages/chat', query: { id: conv.id } })
}

function formatTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<template>
  <main class="section">
    <div class="container narrow">
      <div class="section-header">
        <h1 class="section-title">💬 消息</h1>
      </div>

      <div v-if="!user" class="empty-state">
        <p style="font-size:40px;margin-bottom:12px;">🔒</p>
        <p>请先登录后查看消息</p>
        <router-link to="/login" class="btn btn-primary" style="margin-top:12px;">去登录</router-link>
      </div>

      <div v-else-if="conversations.length === 0" class="empty-state" style="padding:60px 24px;">
        <p style="font-size:48px;margin-bottom:12px;">💬</p>
        <p style="font-size:18px;font-weight:700;">暂无聊天记录</p>
        <p style="color:#94a3b8;margin:8px 0 20px;">在商品详情页点击「联系商家」即可开始对话</p>
        <router-link to="/rental" class="btn btn-primary">去租赁中心</router-link>
      </div>

      <div v-else class="conv-list">
        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="conv-item"
          :class="{ unread: conv.unread }"
          @click="openChat(conv)"
        >
          <div class="conv-avatar">{{ conv.otherUser?.role === 'admin' ? '🏪' : '👤' }}</div>
          <div class="conv-body">
            <div class="conv-top">
              <strong>{{ conv.otherUser?.name || '商家' }}</strong>
              <span class="conv-time">{{ formatTime(conv.lastMessageTime) }}</span>
            </div>
            <p class="conv-preview">{{ conv.lastMessage || '开始聊天吧' }}</p>
            <p v-if="conv.equipment" class="conv-equip">📷 {{ conv.equipment.name }}</p>
          </div>
          <span v-if="conv.unread" class="conv-badge"></span>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.conv-list {
  display: grid;
  gap: 8px;
}
.conv-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0,0,0,.04);
  cursor: pointer;
  transition: all .2s;
  position: relative;
}
.conv-item:hover { background: #f8fafc; transform: translateX(4px); }
.conv-item.unread { background: #eff6ff; }
.conv-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #f1f5f9;
  display: grid;
  place-items: center;
  font-size: 22px;
  flex-shrink: 0;
}
.conv-body { flex: 1; min-width: 0; }
.conv-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
}
.conv-top strong { font-size: 15px; }
.conv-time { font-size: 12px; color: #94a3b8; flex-shrink: 0; }
.conv-preview {
  color: #64748b;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}
.conv-equip {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}
.conv-badge {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #ef4444;
}
</style>
