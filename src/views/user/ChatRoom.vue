<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store } from '../../stores/appStore'
import EmojiPicker from '../../components/EmojiPicker.vue'

const route = useRoute()
const router = useRouter()
const user = store.currentUser

const conversationId = computed(() => route.query.id)
const inputText = ref('')
const showEmoji = ref(false)
const showCamera = ref(false)
const cameraStream = ref(null)
const cameraReady = ref(false)
const photoTaken = ref(null)
const previewImage = ref(null)
const previewVisible = ref(false)
const videoRef = ref(null)
const canvasRef = ref(null)
const messagesContainer = ref(null)
const fileInput = ref(null)
const imageInput = ref(null)

const conversation = computed(() => store.state.conversations.find(c => c.id === conversationId.value))
const messages = computed(() => store.getConversationMessages(conversationId.value))
const otherUser = computed(() => {
  if (!conversation.value || !user.value) return null
  const otherId = conversation.value.userAId === user.value.id ? conversation.value.userBId : conversation.value.userAId
  return store.state.users.find(u => u.id === otherId)
})
const equipment = computed(() => {
  if (!conversation.value) return null
  return store.state.equipment.find(e => e.id === conversation.value.equipmentId)
})

onMounted(() => {
  if (!user.value) {
    router.push({ path: '/login', query: { redirect: `/messages/chat?id=${conversationId.value}` } })
    return
  }
  if (conversationId.value) {
    store.markConversationRead(conversationId.value, user.value.id)
  }
  nextTick(() => scrollToBottom())
})

watch(() => messages.value?.length, () => {
  nextTick(() => scrollToBottom())
})

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function sendText() {
  const text = inputText.value.trim()
  if (!text || !user.value || !conversationId.value) return
  store.sendMessage(conversationId.value, user.value.id, text, 'text')
  inputText.value = ''
  nextTick(() => scrollToBottom())
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendText()
  }
}

function insertEmoji(emoji) {
  inputText.value += emoji
  showEmoji.value = false
}

/* --- Image --- */
function selectImage() {
  imageInput.value?.click()
}

function onImageSelected(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    previewImage.value = reader.result
    previewVisible.value = true
  }
  reader.readAsDataURL(file)
  imageInput.value.value = ''
}

function sendImage() {
  if (!previewImage.value || !user.value || !conversationId.value) return
  store.sendMessage(conversationId.value, user.value.id, previewImage.value, 'image')
  previewImage.value = null
  previewVisible.value = false
}

function cancelImage() {
  previewImage.value = null
  previewVisible.value = false
}

/* --- Camera --- */
async function openCamera() {
  showCamera.value = true
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    cameraStream.value = stream
    cameraReady.value = false
    nextTick(() => {
      if (videoRef.value) {
        videoRef.value.srcObject = stream
        videoRef.value.play()
        cameraReady.value = true
      }
    })
  } catch (err) {
    alert('无法访问摄像头: ' + err.message)
    showCamera.value = false
  }
}

function capturePhoto() {
  if (!videoRef.value || !canvasRef.value) return
  const video = videoRef.value
  const canvas = canvasRef.value
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0)
  photoTaken.value = canvas.toDataURL('image/jpeg', 0.9)
  closeCamera()
}

function sendPhoto() {
  if (!photoTaken.value || !user.value || !conversationId.value) return
  store.sendMessage(conversationId.value, user.value.id, photoTaken.value, 'image')
  photoTaken.value = null
}

function discardPhoto() {
  photoTaken.value = null
}

function closeCamera() {
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach(t => t.stop())
    cameraStream.value = null
  }
  cameraReady.value = false
  showCamera.value = false
}

/* --- File --- */
function selectFile() {
  fileInput.value?.click()
}

function onFileSelected(e) {
  const file = e.target.files[0]
  if (!file || !user.value || !conversationId.value) return
  store.sendMessage(conversationId.value, user.value.id, file.name, 'file', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type
  })
  fileInput.value.value = ''
}

/* --- Link --- */
function insertLink() {
  const url = prompt('请输入链接地址（以 http:// 或 https:// 开头）:')
  if (!url || !url.startsWith('http')) return
  if (!user.value || !conversationId.value) return
  store.sendMessage(conversationId.value, user.value.id, url, 'link', { linkUrl: url })
}

function formatTime(iso) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function isOwnMessage(msg) {
  return msg.senderId === user.value?.id
}

function getSenderName(msg) {
  if (msg.senderId === user.value?.id) return '我'
  return otherUser.value?.name || '商家'
}

onUnmounted(() => {
  closeCamera()
})
</script>

<template>
  <div class="chat-page" v-if="user">
    <!-- Header -->
    <header class="chat-header">
      <button class="btn-back" @click="router.push('/messages')">← 返回</button>
      <div class="chat-header-info">
        <span class="chat-avatar">{{ otherUser?.role === 'admin' ? '🏪' : '👤' }}</span>
        <div>
          <strong>{{ otherUser?.name || '商家' }}</strong>
          <p v-if="equipment" class="chat-equip-name">📷 {{ equipment.name }}</p>
        </div>
      </div>
      <router-link v-if="equipment" :to="`/rental/${equipment.id}`" class="btn btn-outline btn-sm">查看商品</router-link>
    </header>

    <!-- Messages -->
    <div class="chat-messages" ref="messagesContainer">
      <div v-if="messages.length === 0" class="chat-empty">
        <p style="font-size:40px;">💬</p>
        <p>开始和商家对话吧</p>
      </div>
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="msg-row"
        :class="{ own: isOwnMessage(msg) }"
      >
        <div class="msg-bubble" :class="{ own: isOwnMessage(msg) }">
          <!-- Text -->
          <div v-if="msg.type === 'text'" class="msg-text">{{ msg.content }}</div>

          <!-- Image -->
          <div v-else-if="msg.type === 'image'" class="msg-image-wrap">
            <img
              :src="msg.content"
              class="msg-image"
              @click="previewImage = msg.content; previewVisible = true"
              alt="图片"
            />
          </div>

          <!-- File -->
          <div v-else-if="msg.type === 'file'" class="msg-file">
            <span class="file-icon">📎</span>
            <div>
              <span class="file-name">{{ msg.fileName }}</span>
              <span v-if="msg.fileSize" class="file-size">{{ (msg.fileSize / 1024).toFixed(1) }} KB</span>
            </div>
          </div>

          <!-- Link -->
          <div v-else-if="msg.type === 'link'" class="msg-link">
            <span>🔗</span>
            <a :href="msg.linkUrl || msg.content" target="_blank" rel="noopener">{{ msg.content }}</a>
          </div>

          <span class="msg-time">{{ formatTime(msg.createdAt) }}</span>
        </div>
      </div>
    </div>

    <!-- Image Preview Overlay -->
    <Teleport to="body">
      <div v-if="previewVisible && previewImage" class="img-preview-overlay" @click="previewVisible = false">
        <img :src="previewImage" class="img-preview-large" @click.stop />
      </div>
    </Teleport>

    <!-- Image Send Preview -->
    <div v-if="previewVisible && previewImage && !(previewImage && messages.some(m => m.content === previewImage))" :key="'send-preview'" class="image-send-preview">
      <img :src="previewImage" alt="预览" />
      <div class="preview-actions">
        <button class="btn btn-outline btn-sm" @click="cancelImage">取消</button>
        <button class="btn btn-primary btn-sm" @click="sendImage">发送图片</button>
      </div>
    </div>

    <!-- Photo Taken Preview -->
    <div v-if="photoTaken" class="image-send-preview">
      <img :src="photoTaken" alt="拍照预览" />
      <div class="preview-actions">
        <button class="btn btn-outline btn-sm" @click="discardPhoto">重拍</button>
        <button class="btn btn-primary btn-sm" @click="sendPhoto">发送照片</button>
      </div>
    </div>

    <!-- Input Area -->
    <div class="chat-input-area">
      <div class="chat-input-row">
        <button class="input-tool-btn" title="表情" @click="showEmoji = !showEmoji">😊</button>
        <button class="input-tool-btn" title="图片" @click="selectImage">🖼️</button>
        <button class="input-tool-btn" title="拍照" @click="openCamera">📸</button>
        <button class="input-tool-btn" title="文件" @click="selectFile">📎</button>
        <button class="input-tool-btn" title="链接" @click="insertLink">🔗</button>
      </div>
      <div class="chat-input-bottom">
        <textarea
          v-model="inputText"
          class="chat-textarea"
          placeholder="输入消息..."
          rows="1"
          @keydown="onKeydown"
        ></textarea>
        <button class="btn btn-primary btn-sm" :disabled="!inputText.trim()" @click="sendText">发送</button>
      </div>
    </div>

    <!-- Hidden file inputs -->
    <input ref="imageInput" type="file" accept="image/*" style="display:none" @change="onImageSelected" />
    <input ref="fileInput" type="file" style="display:none" @change="onFileSelected" />

    <!-- Camera Modal -->
    <Teleport to="body">
      <div v-if="showCamera" class="camera-overlay" @click.self="closeCamera">
        <div class="camera-modal">
          <div class="camera-top">
            <span>📸 拍照</span>
            <button class="btn btn-outline btn-sm" @click="closeCamera">关闭</button>
          </div>
          <div class="camera-view">
            <video ref="videoRef" autoplay playsinline muted></video>
            <canvas ref="canvasRef" style="display:none"></canvas>
          </div>
          <div class="camera-bottom">
            <button class="btn-capture" :disabled="!cameraReady" @click="capturePhoto">
              <span>📷</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <EmojiPicker v-model="showEmoji" @select="insertEmoji" />
  </div>

  <!-- Not logged in -->
  <div v-else class="section" style="text-align:center;padding:80px 0;">
    <p style="font-size:40px;">🔒</p>
    <p>请先登录后使用聊天功能</p>
    <router-link to="/login" class="btn btn-primary" style="margin-top:12px;">去登录</router-link>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 72px);
  background: #f8fafc;
  margin-top: 72px;
}

/* Header */
.chat-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 72px;
  z-index: 50;
}
.btn-back {
  background: none;
  color: #2563eb;
  font-weight: 700;
  font-size: 14px;
  white-space: nowrap;
}
.chat-header-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.chat-avatar { font-size: 28px; }
.chat-equip-name { font-size: 12px; color: #94a3b8; }

/* Messages */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.chat-empty {
  text-align: center;
  color: #94a3b8;
  padding-top: 80px;
}
.msg-row { display: flex; }
.msg-row.own { justify-content: flex-end; }
.msg-bubble {
  max-width: 72%;
  padding: 10px 14px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
  position: relative;
}
.msg-bubble.own {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #fff;
}
.msg-text { font-size: 15px; line-height: 1.5; word-break: break-word; white-space: pre-wrap; }
.msg-time {
  display: block;
  font-size: 10px;
  color: #94a3b8;
  margin-top: 4px;
  text-align: right;
}
.msg-bubble.own .msg-time { color: rgba(255,255,255,.7); }

.msg-image-wrap { max-width: 240px; }
.msg-image {
  width: 100%;
  border-radius: 10px;
  cursor: pointer;
}

.msg-file {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: rgba(0,0,0,.04);
  border-radius: 10px;
}
.msg-bubble.own .msg-file { background: rgba(255,255,255,.15); }
.file-icon { font-size: 24px; }
.file-name { font-size: 13px; font-weight: 700; display: block; }
.file-size { font-size: 11px; color: #94a3b8; }

.msg-link {
  display: flex;
  align-items: center;
  gap: 8px;
}
.msg-link a {
  color: #2563eb;
  word-break: break-all;
  font-size: 14px;
}
.msg-bubble.own .msg-link a { color: #fff; text-decoration: underline; }

/* Image Preview Overlay */
.img-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(0,0,0,.85);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.img-preview-large {
  max-width: 92vw;
  max-height: 92vh;
  border-radius: 12px;
}

/* Image send preview bar */
.image-send-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
}
.image-send-preview img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 10px;
  flex-shrink: 0;
}
.preview-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

/* Input */
.chat-input-area {
  background: #fff;
  border-top: 1px solid #e2e8f0;
  padding: 8px 16px 12px;
}
.chat-input-row {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.input-tool-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  font-size: 18px;
  background: #f1f5f9;
  display: grid;
  place-items: center;
  transition: background .2s;
}
.input-tool-btn:hover { background: #e2e8f0; }
.chat-input-bottom {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}
.chat-textarea {
  flex: 1;
  min-height: 38px;
  max-height: 100px;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  font-size: 14px;
  resize: none;
  outline: none;
  line-height: 1.5;
}
.chat-textarea:focus { border-color: #2563eb; }

/* Camera Modal */
.camera-overlay {
  position: fixed;
  inset: 0;
  z-index: 2500;
  background: rgba(0,0,0,.85);
  display: grid;
  place-items: center;
}
.camera-modal {
  width: min(420px, 94vw);
  border-radius: 16px;
  background: #1e293b;
  overflow: hidden;
}
.camera-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  color: #fff;
  font-weight: 700;
}
.camera-view {
  width: 100%;
  aspect-ratio: 4/3;
  background: #000;
}
.camera-view video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.camera-bottom {
  display: flex;
  justify-content: center;
  padding: 16px;
}
.btn-capture {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #fff;
  font-size: 24px;
  display: grid;
  place-items: center;
  box-shadow: 0 0 0 3px rgba(255,255,255,.3);
  transition: transform .15s;
}
.btn-capture:hover:not(:disabled) { transform: scale(1.1); }
.btn-capture:disabled { opacity: .4; }
</style>
