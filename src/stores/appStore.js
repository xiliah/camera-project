import { reactive, computed } from 'vue'
import { equipmentSeed } from '../data/mockEquipment'

const saved = JSON.parse(localStorage.getItem('camerahub-state') || 'null')

const defaultUsers = [
  { id: 'u-001', studentId: '20240001', name: 'Student User', phone: '13800000001', role: 'user', password: '123456' },
  { id: 'a-001', studentId: 'admin', name: 'Admin', phone: '13800000000', role: 'admin', password: 'admin123' },
  { id: 'm-001', studentId: 'merchant01', name: '索尼专卖店', phone: '13800000002', role: 'merchant', password: '123456', shopName: '索尼官方器材店' },
  { id: 'm-002', studentId: 'merchant02', name: '佳能旗舰店', phone: '13800000003', role: 'merchant', password: '123456', shopName: '佳能影像中心' }
]

const defaultMerchants = {
  'cam-001': 'a-001', 'cam-002': 'a-001', 'cam-003': 'a-001', 'cam-004': 'a-001',
  'cam-005': 'a-001', 'cam-006': 'a-001', 'cam-007': 'a-001', 'cam-008': 'a-001',
  'cam-009': 'a-001', 'cam-010': 'a-001', 'cam-011': 'a-001', 'cam-012': 'a-001'
}

const initialState = saved || {
  currentUserId: '',
  users: defaultUsers,
  equipment: equipmentSeed,
  favorites: {},
  orders: [],
  repairs: [],
  notifications: [],
  conversations: [],
  chatMessages: {}
}

if (saved) {
  initialState.users = saved.users?.length ? saved.users : defaultUsers
  initialState.equipment = [
    ...(saved.equipment || []),
    ...equipmentSeed.filter(item => !(saved.equipment || []).some(existing => existing.id === item.id))
  ]
  initialState.favorites = saved.favorites || {}
  initialState.orders = saved.orders || []
  initialState.repairs = saved.repairs || []
  initialState.notifications = saved.notifications || []
  initialState.conversations = saved.conversations || []
  initialState.chatMessages = saved.chatMessages || {}
}

const state = reactive(initialState)

function persist() {
  localStorage.setItem('camerahub-state', JSON.stringify(state))
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`
}

export const store = {
  state,
  currentUser: computed(() => state.users.find(user => user.id === state.currentUserId) || null),
  isAdmin: computed(() => {
    const user = state.users.find(item => item.id === state.currentUserId)
    return user?.role === 'admin'
  }),
  userFavorites: computed(() => state.favorites[state.currentUserId] || []),
  loginByStudent(studentId, password) {
    const user = state.users.find(item => item.studentId === studentId && item.password === password)
    if (!user) return { ok: false, message: '学号或密码不正确' }
    state.currentUserId = user.id
    persist()
    return { ok: true, user }
  },
  loginByCode(phone, code) {
    const user = state.users.find(item => item.phone === phone)
    if (!user || code !== '246810') return { ok: false, message: '手机号或验证码不正确' }
    state.currentUserId = user.id
    persist()
    return { ok: true, user }
  },
  register(payload) {
    if (state.users.some(item => item.studentId === payload.studentId)) {
      return { ok: false, message: '该账号已注册' }
    }
    const isMerchant = payload.role === 'merchant'
    const prefix = isMerchant ? 'm' : 'u'
    const user = {
      id: uid(prefix),
      role: isMerchant ? 'merchant' : 'user',
      shopName: isMerchant ? (payload.shopName || '未命名店铺') : undefined,
      ...payload
    }
    state.users.push(user)
    state.currentUserId = user.id
    const welcomeMsg = isMerchant
      ? `欢迎入驻 CameraHub！你的店铺「${user.shopName}」已创建成功。`
      : '欢迎加入 CameraHub，已为你创建租赁账户。'
    this.notify(user.id, welcomeMsg, 'account')
    persist()
    return { ok: true, user }
  },
  logout() {
    state.currentUserId = ''
    persist()
  },
  toggleFavorite(equipmentId) {
    if (!state.currentUserId) return { ok: false, message: '请先登录后再收藏' }
    const list = state.favorites[state.currentUserId] || []
    state.favorites[state.currentUserId] = list.includes(equipmentId)
      ? list.filter(id => id !== equipmentId)
      : [...list, equipmentId]
    persist()
    return { ok: true }
  },
  createOrder(equipmentId, days) {
    if (!state.currentUserId) return { ok: false, message: '请先登录后再下单' }
    const item = state.equipment.find(entry => entry.id === equipmentId)
    if (!item || item.status !== 'available') return { ok: false, message: '该器材暂不可租赁' }
    const due = new Date()
    due.setDate(due.getDate() + Number(days))
    const order = {
      id: uid('ord'),
      userId: state.currentUserId,
      equipmentId,
      days: Number(days),
      rentTotal: Number(days) * item.price,
      deposit: item.deposit,
      status: 'renting',
      paid: true,
      depositStatus: 'paid',
      createdAt: new Date().toISOString(),
      dueAt: due.toISOString()
    }
    state.orders.unshift(order)
    item.status = 'rented'
    this.notify(state.currentUserId, `${item.name} 押金支付成功，订单已开始。`, 'order')
    persist()
    return { ok: true, order }
  },
  returnDeposit(orderId) {
    const order = state.orders.find(item => item.id === orderId)
    if (!order) return
    order.status = 'completed'
    order.depositStatus = 'refunded'
    const item = state.equipment.find(entry => entry.id === order.equipmentId)
    if (item) item.status = 'available'
    this.notify(order.userId, `${item?.name || '器材'} 已确认归还，押金已模拟退还。`, 'deposit')
    persist()
  },
  createRepair(payload) {
    const repair = {
      id: uid('rep'),
      userId: state.currentUserId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...payload
    }
    state.repairs.unshift(repair)
    this.notify(state.currentUserId, '报修单已提交，管理员会尽快处理。', 'repair')
    persist()
    return repair
  },
  updateRepair(id, status) {
    const repair = state.repairs.find(item => item.id === id)
    if (!repair) return
    repair.status = status
    this.notify(repair.userId, `你的报修单状态已更新为：${statusText(status)}。`, 'repair')
    persist()
  },
  addEquipment(payload) {
    state.equipment.unshift({ id: uid('cam'), status: 'available', specs: [], ...payload })
    persist()
  },
  updateEquipmentStatus(id, status) {
    const item = state.equipment.find(entry => entry.id === id)
    if (!item) return
    item.status = status
    persist()
  },
  updateUserRole(userId, role) {
    const user = state.users.find(item => item.id === userId)
    if (!user || user.id === state.currentUserId) return
    user.role = role
    this.notify(user.id, `你的账户权限已调整为：${role === 'admin' ? '管理员' : '普通用户'}。`, 'account')
    persist()
  },
  notify(userId, message, type = 'system') {
    state.notifications.unshift({ id: uid('msg'), userId, message, type, read: false, createdAt: new Date().toISOString() })
  },
  markAllRead() {
    state.notifications.forEach(item => {
      if (item.userId === state.currentUserId) item.read = true
    })
    persist()
  },
  getMerchantId(equipmentId) {
    const equip = state.equipment.find(e => e.id === equipmentId)
    return (equip && equip.merchantId) || defaultMerchants[equipmentId] || 'a-001'
  },
  getOrCreateConversation(userId, otherUserId, equipmentId) {
    const existing = state.conversations.find(c =>
      ((c.userAId === userId && c.userBId === otherUserId) || (c.userAId === otherUserId && c.userBId === userId)) &&
      c.equipmentId === equipmentId
    )
    if (existing) {
      if (existing.userAId === userId) existing.readByA = true
      else existing.readByB = true
      persist()
      return existing
    }
    const conv = {
      id: uid('conv'),
      userAId: userId,
      userBId: otherUserId,
      equipmentId,
      lastMessage: '',
      lastMessageTime: new Date().toISOString(),
      readByA: true,
      readByB: false,
      createdAt: new Date().toISOString()
    }
    state.conversations.unshift(conv)
    state.chatMessages[conv.id] = []
    persist()
    return conv
  },
  sendMessage(conversationId, senderId, content, type = 'text', extra = {}) {
    const conv = state.conversations.find(c => c.id === conversationId)
    if (!conv) return null
    if (!state.chatMessages[conversationId]) state.chatMessages[conversationId] = []
    const msg = {
      id: uid('chat'),
      conversationId,
      senderId,
      content,
      type,
      ...extra,
      createdAt: new Date().toISOString()
    }
    state.chatMessages[conversationId].push(msg)
    if (type === 'text') conv.lastMessage = content
    else if (type === 'image') conv.lastMessage = '[图片]'
    else if (type === 'file') conv.lastMessage = `[文件] ${extra.fileName || ''}`
    else if (type === 'link') conv.lastMessage = '[链接]'
    conv.lastMessageTime = msg.createdAt
    conv.readByA = senderId === conv.userAId
    conv.readByB = senderId === conv.userBId
    const otherId = conv.userAId === senderId ? conv.userBId : conv.userAId
    this.notify(otherId, `你有新的聊天消息`, 'chat')
    persist()
    return msg
  },
  getUserConversations(userId) {
    return state.conversations
      .filter(c => c.userAId === userId || c.userBId === userId)
      .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime))
  },
  getConversationMessages(conversationId) {
    return state.chatMessages[conversationId] || []
  },
  markConversationRead(conversationId, userId) {
    const conv = state.conversations.find(c => c.id === conversationId)
    if (!conv) return
    if (conv.userAId === userId) conv.readByA = true
    else if (conv.userBId === userId) conv.readByB = true
    persist()
  },
  getUnreadChatCount(userId) {
    return state.conversations.filter(c => {
      if (c.userAId === userId) return !c.readByA
      if (c.userBId === userId) return !c.readByB
      return false
    }).length
  },
  checkDueReminders() {
    const now = Date.now()
    state.orders
      .filter(item => item.userId === state.currentUserId && item.status === 'renting')
      .forEach(order => {
        const hours = (new Date(order.dueAt).getTime() - now) / 36e5
        if (hours <= 48) {
          const exists = state.notifications.some(msg => msg.userId === order.userId && msg.type === 'due' && msg.message.includes(order.id))
          if (!exists) this.notify(order.userId, `订单 ${order.id} 将在 48 小时内到期，请及时归还或联系管理员。`, 'due')
        }
      })
    persist()
  }
}

export function statusText(status) {
  return {
    available: '可租赁',
    rented: '租赁中',
    maintenance: '维护中',
    pending: '待处理',
    processing: '处理中',
    done: '已完成',
    renting: '租赁中',
    completed: '已完成'
  }[status] || status
}
