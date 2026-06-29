<script setup>
import { computed, reactive, ref } from 'vue'

const HF_MODEL_URL = 'https://api-inference.huggingface.co/models/google/vit-base-patch16-224'
const MAX_PHOTOS = 6

const deviceTypes = ['相机机身', '镜头', '无人机', '云台相机', '稳定器', '其他器材']
const conditionOptions = ['全新未拆', '99新', '95新', '9成新', '轻微使用痕迹', '明显使用痕迹', '待维修']
const riskWords = ['暗病', '进水', '拆修', '维修', '摔过', '改码', '序列号磨损', '无法开机', '不退不换', '低价急出', '无包装', '无发票']
const trustedBrands = ['sony', 'canon', 'nikon', 'fujifilm', 'fuji', 'dji', 'leica', 'hasselblad', 'panasonic', 'olympus', 'sigma', 'tamron', 'gopro']

const form = reactive({
  deviceType: '相机机身',
  model: 'Sony A7 IV',
  serial: '',
  condition: '95新',
  price: 6800,
  description: '外观轻微使用痕迹，功能正常，屏幕和卡口无明显磕碰。'
})

const modelConfig = reactive({
  token: sessionStorage.getItem('camerahub-hf-token') || '',
  enabled: Boolean(sessionStorage.getItem('camerahub-hf-token'))
})

const photos = ref([])
const report = ref(null)
const scanning = ref(false)
const error = ref('')
const dragActive = ref(false)
const modelStatus = ref('本地检测就绪')
const itemCategoryWarning = ref('')

function scrollToWorkbench() {
  const el = document.getElementById('ai-workbench')
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

const hasPhotos = computed(() => photos.value.length > 0)
const primaryActionText = computed(() => scanning.value ? '检测中...' : '开始检测')
const resultClass = computed(() => {
  if (!report.value) return ''
  if (report.value.overall >= 82) return 'pass'
  if (report.value.overall >= 65) return 'review'
  return 'risk'
})

function onFileChange(event) {
  addFiles(event.target.files)
  event.target.value = ''
}

function onDrop(event) {
  dragActive.value = false
  addFiles(event.dataTransfer.files)
}

function addFiles(fileList) {
  error.value = ''
  const incoming = Array.from(fileList || []).filter(file => file.type.startsWith('image/'))
  const available = MAX_PHOTOS - photos.value.length
  if (!incoming.length) {
    error.value = '请上传 JPG、PNG 或 WebP 图片。'
    return
  }
  if (available <= 0) {
    error.value = `最多上传 ${MAX_PHOTOS} 张图片。`
    return
  }
  const selected = incoming.slice(0, available).map(file => ({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    file,
    name: file.name,
    size: formatSize(file.size),
    url: URL.createObjectURL(file)
  }))
  photos.value = [...photos.value, ...selected]
  if (incoming.length > available) error.value = `已保留前 ${MAX_PHOTOS} 张图片。`
}

function removePhoto(id) {
  const target = photos.value.find(item => item.id === id)
  if (target) URL.revokeObjectURL(target.url)
  photos.value = photos.value.filter(item => item.id !== id)
  if (!photos.value.length) report.value = null
}

function resetAll() {
  photos.value.forEach(item => URL.revokeObjectURL(item.url))
  photos.value = []
  report.value = null
  error.value = ''
  itemCategoryWarning.value = ''
  modelStatus.value = '本地检测就绪'
}

async function runDetection() {
  if (!hasPhotos.value) {
    error.value = '请先上传至少一张器材图片。'
    return
  }

  scanning.value = true
  error.value = ''
  itemCategoryWarning.value = ''
  report.value = null
  modelStatus.value = '分析图片质量'

  try {
    if (modelConfig.token.trim()) {
      sessionStorage.setItem('camerahub-hf-token', modelConfig.token.trim())
    } else {
      sessionStorage.removeItem('camerahub-hf-token')
    }

    const analyses = await Promise.all(photos.value.map(item => analyzeImage(item)))
    
    // ====== 物品分类识别：逐张检查所有上传图片 ======
    modelStatus.value = '物品与型号识别中'
    const itemChecks = await Promise.all(photos.value.map(item => classifyItemCategory(item)))
    
    // 统计识别结果
    const failedChecks = itemChecks.filter(c => !c.isCamera)
    const matchedChecks = itemChecks.filter(c => c.isCamera)
    const totalCameraScore = itemChecks.reduce((s, c) => s + c.score, 0) / itemChecks.length
    const totalModelMatch = itemChecks.reduce((s, c) => s + c.modelMatchScore, 0) / itemChecks.length

    // 只要有一张图片识别为非器材，就拦截
    if (failedChecks.length > 0 || matchedChecks.length === 0) {
      const failedLabels = itemChecks.map((c, i) => {
        const name = photos.value[i]?.name || `图片${i + 1}`
        return c.isCamera ? `${name}：通过` : `${name}：非摄影器材（${c.topLabels.join('、') || '未识别'}）`
      }).join('；')
      
      itemCategoryWarning.value = '⚠️ 请重新上传图片'
      modelStatus.value = '物品识别未通过'
      scanning.value = false
      report.value = {
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
        decision: '⚠️ 检测不通过 - 请重新上传图片',
        riskLevel: '无效',
        overall: 0,
        aiResult: { status: 'skipped', labels: [] },
        images: analyses,
        issueWords: [],
        issues: [
          `上传的 ${photos.value.length} 张图片中，有 ${failedChecks.length} 张未识别为摄影器材。`,
          `检测到的内容类型：${itemChecks.map(c => c.topLabels[0] || '未知').join('、')}`,
          `器材得分：${Math.round(totalCameraScore)}（需 ≥ 30），型号匹配：${Math.round(totalModelMatch)}（需 ≥ 15）`
        ],
        scores: [
          { label: '物品识别', value: 0, status: '非摄影器材' },
          { label: '图片清晰度', value: Math.round(average(analyses.map(a => a.sharpness))), status: '--' },
          { label: '曝光质量', value: Math.round(average(analyses.map(a => a.exposure))), status: '--' },
          { label: '细节覆盖', value: Math.round(average(analyses.map(a => a.detail))), status: '--' },
          { label: '序列号规范', value: 0, status: '--' },
          { label: '型号一致性', value: 0, status: '--' },
          { label: '描述风险', value: 0, status: '--' },
          { label: '价格合理性', value: 0, status: '--' }
        ],
        checks: [
          { name: '图片检测', result: `${analyses.length} 张图片完成质量扫描` },
          { name: '物品识别', result: failedLabels },
          { name: '序列号', result: '物品识别未通过，跳过' },
          { name: '交易风险', result: '请重新上传与器材类型和型号相符的图片' }
        ],
        suggestions: [
          '请上传相机机身、镜头、无人机、云台等摄影器材的清晰照片。',
          '确保照片包含器材的正面、铭牌、卡口等特征部位。',
          '请确认上传的图片与填写的器材类型和型号一致。'
        ]
      }
      return
    }
    // ====== 物品识别全部通过，继续正常检测 ======

    modelStatus.value = modelConfig.enabled ? '调用免费视觉模型' : '生成本地报告'
    const aiResult = modelConfig.enabled ? await classifyWithFreeModel(photos.value[0].file) : { status: 'skipped', labels: [] }
    report.value = buildReport(analyses, aiResult, itemChecks)
    modelStatus.value = aiResult.status === 'ok' ? '免费模型已参与识别' : '本地检测已完成'
  } catch (err) {
    error.value = err.message || '检测失败，请换一张图片后重试。'
    modelStatus.value = '检测失败'
  } finally {
    scanning.value = false
  }
}

// ====== 本地物品分类识别（增强版）======
// 多维度像素分析 + 型号关键词匹配，确保上传图片与器材/型号相符
async function classifyItemCategory(photo) {
  const image = await loadImage(photo.url)
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 400 / Math.max(image.naturalWidth, image.naturalHeight))
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = canvas.width * canvas.height
  const w = canvas.width, h = canvas.height

  // ===== 1. 颜色直方图分析 =====
  let darkPixels = 0, midPixels = 0, brightPixels = 0
  let metalReflect = 0, glassReflect = 0
  let warmPixels = 0, coolPixels = 0
  let totalSat = 0, skinPixels = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const lum = r * 0.299 + g * 0.587 + b * 0.114
    const sat = max === 0 ? 0 : (max - min) / max

    totalSat += sat
    if (lum < 50) darkPixels++
    else if (lum > 200) brightPixels++
    else midPixels++

    if (r > g && r > b && sat > 0.15) warmPixels++
    if (b > r && b > g && sat > 0.08) coolPixels++

    // 金属反光：高亮 + 低饱和度 + 偏灰白
    if (lum > 170 && sat < 0.18 && Math.abs(r - g) < 40 && Math.abs(g - b) < 40 && Math.abs(r - b) < 40) metalReflect++
    // 玻璃/镜片反光：极高亮 + 极低饱和度
    if (lum > 215 && sat < 0.06) glassReflect++

    // 肤色检测：特定 RGB 范围
    if (r > 95 && g > 40 && b > 20 && max - min > 15 && Math.abs(r - g) > 15 && r > g && r > b) skinPixels++
  }

  const darkRatio = darkPixels / pixels
  const brightRatio = brightPixels / pixels
  const metalRatio = metalReflect / pixels
  const glassRatio = glassReflect / pixels
  const warmRatio = warmPixels / pixels
  const coolRatio = coolPixels / pixels
  const skinRatio = skinPixels / pixels
  const avgSat = totalSat / pixels

  // ===== 2. 纹理与边缘分析 =====
  const gray = new Float32Array(pixels)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
  }

  // Sobel 边缘检测
  let edgeDensity = 0, strongEdgeDensity = 0
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const idx = y * w + x
      const gx = gray[idx - 1] - gray[idx + 1]
      const gy = gray[idx - w] - gray[idx + w]
      const mag = Math.sqrt(gx * gx + gy * gy)
      if (mag > 25) edgeDensity++
      if (mag > 55) strongEdgeDensity++
    }
  }
  edgeDensity /= pixels
  strongEdgeDensity /= pixels

  // ===== 3. 网格结构分析 =====
  const gridSize = 8
  const gridCols = Math.floor(w / gridSize)
  const gridRows = Math.floor(h / gridSize)
  const gridBrightness = []
  for (let gy = 0; gy < gridRows; gy++) {
    for (let gx = 0; gx < gridCols; gx++) {
      let sum = 0, count = 0
      for (let y = gy * gridSize; y < (gy + 1) * gridSize && y < h; y++) {
        for (let x = gx * gridSize; x < (gx + 1) * gridSize && x < w; x++) {
          const idx = (y * w + x) * 4
          sum += data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114
          count++
        }
      }
      gridBrightness.push(sum / count)
    }
  }

  // 中心区域（镜头通常在图片中央）
  const cx = Math.floor(gridCols / 2), cy = Math.floor(gridRows / 2)
  let centerBrightness = 0, centerCount = 0
  let edgeBrightness = 0, edgeCount = 0
  for (let gy = 0; gy < gridRows; gy++) {
    for (let gx = 0; gx < gridCols; gx++) {
      const idx = gy * gridCols + gx
      const isCenter = Math.abs(gx - cx) <= 1 && Math.abs(gy - cy) <= 1
      const isEdge = gx <= 1 || gx >= gridCols - 2 || gy <= 1 || gy >= gridRows - 2
      if (isCenter) { centerBrightness += gridBrightness[idx]; centerCount++ }
      if (isEdge) { edgeBrightness += gridBrightness[idx]; edgeCount++ }
    }
  }
  centerBrightness /= centerCount || 1
  edgeBrightness /= edgeCount || 1

  // 中心-边缘亮度差（镜头区域通常更亮，形成圆形结构）
  const centerEdgeDiff = Math.abs(centerBrightness - edgeBrightness)

  // 网格亮度方差（器材结构通常有规律的亮度变化）
  let gridVariance = 0
  const gridAvg = gridBrightness.reduce((s, v) => s + v, 0) / gridBrightness.length
  for (const v of gridBrightness) gridVariance += (v - gridAvg) ** 2
  gridVariance /= gridBrightness.length

  // ===== 4. 轮廓形状分析 - 检测矩形/规则轮廓 =====
  // 扫描四边是否有连续的深色-浅色边界（器材轮廓特征）
  let topBorder = 0, bottomBorder = 0, leftBorder = 0, rightBorder = 0
  const topY = Math.floor(h * 0.1), bottomY = Math.floor(h * 0.9)
  const leftX = Math.floor(w * 0.1), rightX = Math.floor(w * 0.9)
  for (let x = 0; x < w; x++) {
    const topIdx = topY * w + x
    const topBelow = (topY + 3) * w + x
    if (Math.abs(gray[topIdx] - gray[topBelow]) > 20) topBorder++
  }
  for (let x = 0; x < w; x++) {
    const botIdx = bottomY * w + x
    const botAbove = (bottomY - 3) * w + x
    if (Math.abs(gray[botIdx] - gray[botAbove]) > 20) bottomBorder++
  }
  for (let y = 0; y < h; y++) {
    const leftIdx = y * w + leftX
    const leftRight = y * w + (leftX + 3)
    if (Math.abs(gray[leftIdx] - gray[leftRight]) > 20) leftBorder++
  }
  for (let y = 0; y < h; y++) {
    const rightIdx = y * w + rightX
    const rightLeft = y * w + (rightX - 3)
    if (Math.abs(gray[rightIdx] - gray[rightLeft]) > 20) rightBorder++
  }
  const borderScore = (topBorder + bottomBorder + leftBorder + rightBorder) / (w * 2 + h * 2)

  // ===== 5. 综合评分（严格版）======
  let cameraScore = 0
  const labels = []
  const details = []

  // --- 器材正向特征 ---
  // 深色机身：大量深色像素是相机/镜头的核心特征
  if (darkRatio > 0.2 && darkRatio < 0.75) { cameraScore += 20; labels.push('深色机身'); details.push(`深色占比${Math.round(darkRatio * 100)}%`) }
  else if (darkRatio >= 0.75) { cameraScore += 8; labels.push('极深色物体'); details.push('深色区域过多') }

  // 金属质感：适度的金属反光是器材外壳特征
  if (metalRatio > 0.012 && metalRatio < 0.25) { cameraScore += 18; labels.push('金属质感'); details.push(`金属反光${(metalRatio * 100).toFixed(1)}%`) }

  // 镜片反光：少量极高亮点是镜头镀膜特征
  if (glassRatio > 0.003 && glassRatio < 0.12) { cameraScore += 16; labels.push('镜片反光'); details.push(`镜面反射${(glassRatio * 100).toFixed(1)}%`) }
  else if (glassRatio >= 0.12) { cameraScore -= 5; details.push('镜面反射过多') }

  // 规则纹理：适中的边缘密度 = 器材的按钮/转盘/刻字
  if (edgeDensity > 0.06 && edgeDensity < 0.35) { cameraScore += 16; labels.push('规则纹理'); details.push(`纹理密度${(edgeDensity * 100).toFixed(1)}%`) }
  else if (edgeDensity >= 0.35) { cameraScore -= 6; details.push('纹理过于复杂') }

  // 专业色调：低饱和度是摄影器材的典型特征
  if (avgSat < 0.38) { cameraScore += 12; labels.push('专业色调'); details.push(`饱和度${Math.round(avgSat * 100)}%`) }

  // 中心结构：镜头通常在图片中央，亮度与边缘有差异
  if (centerEdgeDiff > 15 && centerEdgeDiff < 120 && centerBrightness > 70) { cameraScore += 10; labels.push('中心结构'); details.push(`中心-边缘差${Math.round(centerEdgeDiff)}`) }

  // 规则轮廓：器材通常有明显的矩形/规则边界
  if (borderScore > 0.25 && borderScore < 0.7) { cameraScore += 10; labels.push('规则轮廓') }
  else if (borderScore >= 0.7) { cameraScore += 4; details.push('轮廓过于尖锐') }

  // 网格亮度方差（器材有规律的明暗分布）
  if (gridVariance > 400 && gridVariance < 8000) { cameraScore += 6; labels.push('结构分布') }

  // --- 非器材负向特征 ---
  // 人物/皮肤：肤色占比高 + 暖色调 + 低纹理
  if (skinRatio > 0.25 && warmRatio > 0.3 && edgeDensity < 0.08) { cameraScore -= 35; labels.push('人物/皮肤'); details.push(`肤色${Math.round(skinRatio * 100)}%`) }
  else if (skinRatio > 0.15 && warmRatio > 0.35) { cameraScore -= 20; details.push('疑似人物照片') }

  // 自然风景：冷色调/绿色占比高 + 高纹理
  if (coolRatio > 0.28 && edgeDensity > 0.25) { cameraScore -= 30; labels.push('自然风景'); details.push('冷色高纹理') }
  else if (coolRatio > 0.2 && avgSat > 0.35 && edgeDensity > 0.2) { cameraScore -= 18; details.push('疑似风景照片') }

  // 文档/屏幕：极高亮度 + 极低纹理 + 高饱和度
  if (brightRatio > 0.45 && edgeDensity < 0.05) { cameraScore -= 38; labels.push('文档/屏幕'); details.push('高亮低纹理') }
  else if (brightRatio > 0.35 && edgeDensity < 0.04) { cameraScore -= 22; details.push('疑似屏幕截图') }

  // 食物：高暖色 + 高饱和度 + 中高纹理
  if (warmRatio > 0.35 && avgSat > 0.42 && edgeDensity > 0.06) { cameraScore -= 30; labels.push('食物'); details.push('暖色高饱和') }

  // 纯色/空白：极低纹理 + 极低饱和度
  if (edgeDensity < 0.025 && avgSat < 0.12) { cameraScore -= 42; labels.push('空白/纯色'); details.push('无内容') }

  // 抽象/艺术：极高饱和度 + 不规则纹理
  if (avgSat > 0.55 && edgeDensity > 0.3) { cameraScore -= 20; details.push('高饱和艺术图片') }

  // 桌面/杂货：中高亮度 + 中高纹理 + 无金属无镜片
  if (brightRatio > 0.25 && edgeDensity > 0.15 && metalRatio < 0.005 && glassRatio < 0.002) { cameraScore -= 15; details.push('疑似日常物品') }

  // ===== 6. 型号关键词匹配验证 =====
  const modelText = `${form.model} ${form.deviceType}`.toLowerCase()
  const modelTokens = modelText.split(/[\s\-/]+/).filter(t => t.length > 1)
  const cameraKeywords = [
    'sony', 'canon', 'nikon', 'fujifilm', 'fuji', 'dji', 'leica', 'hasselblad',
    'panasonic', 'olympus', 'sigma', 'tamron', 'gopro', 'pentax', 'ricoh',
    'a7', 'a9', 'a1', 'fx', 'z6', 'z7', 'z8', 'z9', 'r5', 'r6', 'r3', 'r1',
    'x-t', 'x-h', 'x100', 'gfx', 'mavic', 'pocket', 'osmo', 'rs',
    'dslr', 'mirrorless', 'lens', 'camera', 'stabilizer', 'drone', 'gimbal'
  ]

  // 匹配度：用户填写的型号关键词在识别标签中的命中率
  let modelMatchScore = 0
  const matchedTokens = []
  const allRecognitionText = [...labels, ...details].join(' ').toLowerCase()
  for (const token of modelTokens) {
    if (allRecognitionText.includes(token)) {
      modelMatchScore += 25
      matchedTokens.push(token)
    }
  }

  // 器材类型关键词匹配
  const typeKeywords = {
    '相机机身': ['camera', 'dslr', 'mirrorless', '机身'],
    '镜头': ['lens', '镜头'],
    '无人机': ['drone', 'aerial', 'propeller', '无人机'],
    '云台相机': ['gimbal', 'pocket', 'osmo', '云台'],
    '稳定器': ['stabilizer', 'gimbal', '稳定器', 'rs']
  }
  const typeHints = typeKeywords[form.deviceType] || []
  const typeMatch = typeHints.some(kw => allRecognitionText.includes(kw))
  if (typeMatch) modelMatchScore += 15

  // 器材总词命中
  const cameraWordHits = cameraKeywords.filter(kw => allRecognitionText.includes(kw)).length
  if (cameraWordHits >= 2) modelMatchScore += 10

  const isCamera = cameraScore >= 30 && modelMatchScore >= 15

  return {
    isCamera,
    score: cameraScore,
    modelMatchScore,
    topLabels: labels.slice(0, 4),
    matchedTokens,
    details: {
      darkRatio: Math.round(darkRatio * 100),
      metalRatio: Math.round(metalRatio * 1000) / 10,
      glassRatio: Math.round(glassRatio * 1000) / 10,
      edgeDensity: Math.round(edgeDensity * 1000) / 10,
      avgSat: Math.round(avgSat * 100),
      cameraScore,
      modelMatchScore,
      borderScore: Math.round(borderScore * 100)
    }
  }
}

async function classifyWithFreeModel(file) {
  const token = modelConfig.token.trim()
  if (!token) return { status: 'skipped', labels: [] }

  try {
    const response = await fetch(HF_MODEL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    })

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}))
      return {
        status: 'failed',
        labels: [],
        message: detail.error || `模型接口返回 ${response.status}`
      }
    }

    const payload = await response.json()
    const labels = Array.isArray(payload)
      ? payload.slice(0, 5).map(item => ({
        label: item.label,
        score: Math.round((item.score || 0) * 100)
      }))
      : []

    return { status: 'ok', labels }
  } catch (err) {
    return { status: 'failed', labels: [], message: err.message }
  }
}

function buildReport(analyses, aiResult, itemChecks) {
  const averageQuality = average(analyses.map(item => item.quality))
  const sharpness = average(analyses.map(item => item.sharpness))
  const exposure = average(analyses.map(item => item.exposure))
  const detail = average(analyses.map(item => item.detail))
  const serialScore = scoreSerial(form.serial)
  const descriptionRisk = scoreDescriptionRisk(form.description)
  const modelScore = scoreModelConsistency(aiResult.labels)
  const conditionScore = scoreCondition(form.condition)
  const priceScore = scorePriceRisk()

  // 物品识别得分（基于 classifyItemCategory 的结果）
  const itemRecognitionScore = itemChecks && itemChecks.length
    ? clamp(Math.round(
        itemChecks.reduce((s, c) => s + Math.min(100, Math.max(0, c.score * 2.5 + c.modelMatchScore * 1.5)), 0) / itemChecks.length
      ), 0, 100)
    : 66

  const appearance = clamp(Math.round(averageQuality * 0.72 + conditionScore * 0.28), 0, 100)
  const overall = clamp(Math.round(
    appearance * 0.24 +
    serialScore * 0.16 +
    descriptionRisk * 0.16 +
    modelScore * 0.18 +
    priceScore * 0.12 +
    itemRecognitionScore * 0.14
  ), 0, 100)
  const issueWords = riskWords.filter(word => form.description.includes(word))
  const imageIssues = buildImageIssues(analyses)
  const serialIssue = serialScore < 70 ? ['序列号为空或格式不完整'] : []
  const modelIssue = modelScore < 68 ? ['图片识别结果与器材描述匹配度偏低'] : []
  const issues = [...imageIssues, ...serialIssue, ...modelIssue]
  const riskLevel = overall >= 82 ? '低' : overall >= 65 ? '中' : '高'
  const decision = overall >= 82 ? 'AI检测通过' : overall >= 65 ? '建议人工复核' : '高风险拦截'

  // 物品识别摘要
  const itemSummary = itemChecks && itemChecks.length
    ? itemChecks.map((c, i) => {
        const name = photos.value[i]?.name || `图片${i + 1}`
        return `${name}：器材得分${c.score}、型号匹配${c.modelMatchScore}`
      }).join('；')
    : '未进行物品识别'

  return {
    createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    decision,
    riskLevel,
    overall,
    aiResult,
    images: analyses,
    issueWords,
    issues: issues.length ? issues : ['未发现明显高风险信号'],
    scores: [
      { label: '物品识别', value: itemRecognitionScore, status: itemRecognitionScore >= 75 ? '通过' : itemRecognitionScore >= 50 ? '待核验' : '不通过' },
      { label: '外观完整度', value: appearance, status: appearance >= 82 ? '通过' : '复核' },
      { label: '图片清晰度', value: sharpness, status: sharpness >= 70 ? '清晰' : '偏低' },
      { label: '曝光质量', value: exposure, status: exposure >= 70 ? '正常' : '需补拍' },
      { label: '细节覆盖', value: detail, status: detail >= 62 ? '足够' : '不足' },
      { label: '序列号规范', value: serialScore, status: serialScore >= 80 ? '通过' : '待补充' },
      { label: '型号一致性', value: modelScore, status: modelScore >= 75 ? '匹配' : '待核验' },
      { label: '描述风险', value: descriptionRisk, status: issueWords.length ? '有风险词' : '正常' },
      { label: '价格合理性', value: priceScore, status: priceScore >= 75 ? '正常' : '偏离' }
    ],
    checks: [
      { name: '图片检测', result: `${analyses.length} 张图片完成质量扫描` },
      { name: '物品识别', result: itemSummary },
      { name: '免费模型', result: modelResultText(aiResult) },
      { name: '序列号', result: serialScore >= 80 ? '格式可用于人工验机' : '建议补充机身铭牌或完整序列号' },
      { name: '交易风险', result: `风险等级 ${riskLevel}` }
    ],
    suggestions: buildSuggestions(overall, analyses, serialScore, issueWords)
  }
}

async function analyzeImage(photo) {
  const image = await loadImage(photo.url)
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 360 / Math.max(image.naturalWidth, image.naturalHeight))
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = canvas.width * canvas.height
  const gray = new Float32Array(pixels)
  let total = 0
  let saturationTotal = 0
  let clipped = 0

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const value = r * 0.299 + g * 0.587 + b * 0.114
    gray[p] = value
    total += value
    saturationTotal += max === 0 ? 0 : (max - min) / max
    if (value < 8 || value > 247) clipped += 1
  }

  const brightness = total / pixels
  let variance = 0
  for (let i = 0; i < gray.length; i += 1) variance += (gray[i] - brightness) ** 2
  const contrast = Math.sqrt(variance / pixels)

  let laplacian = 0
  let edgeCount = 0
  for (let y = 1; y < canvas.height - 1; y += 1) {
    for (let x = 1; x < canvas.width - 1; x += 1) {
      const idx = y * canvas.width + x
      const edge = Math.abs(gray[idx] * 4 - gray[idx - 1] - gray[idx + 1] - gray[idx - canvas.width] - gray[idx + canvas.width])
      laplacian += edge ** 2
      if (edge > 38) edgeCount += 1
    }
  }

  const sharpness = clamp(Math.round((laplacian / pixels) / 14), 0, 100)
  const exposure = clamp(Math.round(100 - Math.abs(brightness - 128) / 1.28 - (clipped / pixels) * 22), 0, 100)
  const detail = clamp(Math.round(edgeCount / pixels * 450 + contrast * 0.8), 0, 100)
  const color = clamp(Math.round((saturationTotal / pixels) * 150), 0, 100)
  const resolution = clamp(Math.round((image.naturalWidth * image.naturalHeight) / 18000), 0, 100)
  const quality = clamp(Math.round(sharpness * 0.34 + exposure * 0.24 + detail * 0.22 + color * 0.08 + resolution * 0.12), 0, 100)

  return {
    id: photo.id,
    name: photo.name,
    width: image.naturalWidth,
    height: image.naturalHeight,
    sharpness,
    exposure,
    detail,
    color,
    resolution,
    quality
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片读取失败'))
    image.src = url
  })
}

function scoreSerial(serial) {
  const value = serial.trim().toUpperCase()
  if (!value) return 42
  const basic = /^[A-Z0-9][A-Z0-9-]{5,23}$/.test(value) ? 88 : 58
  const repeated = /(.)\1{5,}/.test(value) ? -24 : 0
  const lengthBonus = value.length >= 8 && value.length <= 18 ? 8 : 0
  return clamp(basic + lengthBonus + repeated, 0, 100)
}

function scoreDescriptionRisk(description) {
  const hits = riskWords.filter(word => description.includes(word)).length
  return clamp(96 - hits * 16, 18, 100)
}

function scoreModelConsistency(labels) {
  const text = `${form.model} ${form.deviceType} ${form.description}`.toLowerCase()
  const labelText = labels.map(item => item.label).join(' ').toLowerCase()
  const brandHit = trustedBrands.some(brand => text.includes(brand))
  const cameraLabel = /camera|lens|reflex|digital|webcam|projector|binocular|tripod/.test(labelText)

  if (labels.length && cameraLabel) return brandHit ? 92 : 84
  if (labels.length) return brandHit ? 70 : 56
  return brandHit ? 78 : 66
}

function scoreCondition(condition) {
  return {
    '全新未拆': 98,
    '99新': 95,
    '95新': 88,
    '9成新': 80,
    '轻微使用痕迹': 72,
    '明显使用痕迹': 58,
    '待维修': 36
  }[condition] || 66
}

function scorePriceRisk() {
  const price = Number(form.price) || 0
  const text = `${form.model} ${form.description}`.toLowerCase()
  if (price <= 0) return 48
  if ((text.includes('leica') || text.includes('hasselblad')) && price < 5000) return 48
  if ((text.includes('sony') || text.includes('canon') || text.includes('nikon')) && price < 1200) return 58
  if (price < 300) return 62
  return 88
}

function buildImageIssues(analyses) {
  const issues = []
  if (analyses.some(item => item.sharpness < 45)) issues.push('存在模糊图片，建议补拍卡口、屏幕和铭牌')
  if (analyses.some(item => item.exposure < 45)) issues.push('存在过暗或过曝图片，外观细节可信度下降')
  if (analyses.length < 3) issues.push('图片数量偏少，建议补充机身正反面和序列号特写')
  return issues
}

function buildSuggestions(overall, analyses, serialScore, issueWords) {
  const suggestions = []
  if (analyses.length < 3) suggestions.push('补充机身正面、背面、底部铭牌和关键磨损点。')
  if (serialScore < 80) suggestions.push('上传清晰序列号照片，并填写完整序列号。')
  if (issueWords.length) suggestions.push(`描述中出现 ${issueWords.join('、')}，交易前需要人工确认。`)
  if (overall >= 82) suggestions.push('可展示 AI 检测通过标签，成交前仍建议线下验机。')
  if (!suggestions.length) suggestions.push('建议进入人工复核流程后再发布。')
  return suggestions
}

function modelResultText(aiResult) {
  if (aiResult.status === 'ok') return aiResult.labels.map(item => `${item.label} ${item.score}%`).join('，') || '模型未返回标签'
  if (aiResult.status === 'failed') return `免费模型未接入成功，已使用本地检测：${aiResult.message}`
  return '未启用外部模型，已使用本地图像检测'
}

function exportReport() {
  if (!report.value) return
  const text = [
    'CameraHub AI 保真检测报告',
    `生成时间：${report.value.createdAt}`,
    `检测结论：${report.value.decision}`,
    `综合评分：${report.value.overall}`,
    `风险等级：${report.value.riskLevel}`,
    '',
    '评分明细：',
    ...report.value.scores.map(item => `${item.label}：${item.value} / ${item.status}`),
    '',
    '复核建议：',
    ...report.value.suggestions.map(item => `- ${item}`)
  ].join('\n')
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `CameraHub-AI-${Date.now()}.txt`
  link.click()
  URL.revokeObjectURL(url)
}

function average(values) {
  if (!values.length) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function formatSize(size) {
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <main class="ai-page">
    <section class="ai-hero">
      <div class="container ai-hero-grid">
        <div class="ai-hero-copy">
          <span class="eyebrow">CameraHub Verify</span>
          <h1>AI 保真检测</h1>
          <p>面向二手相机交易的上传、识别、评分和报告流程。</p>
          <div class="hero-actions">
            <button class="btn btn-primary" type="button" @click="scrollToWorkbench">进入检测</button>
            <button class="btn btn-outline hero-outline" type="button" :disabled="!report" @click="exportReport">下载报告</button>
          </div>
        </div>
        <div class="live-card" :class="resultClass">
          <div class="scan-line" :class="{ paused: !scanning }"></div>
          <span>检测结果</span>
          <strong>{{ report?.decision || '等待上传' }}</strong>
          <p>综合评分 {{ report?.overall ?? '--' }}</p>
          <p>交易风险 {{ report?.riskLevel || '--' }}</p>
          <p>{{ modelStatus }}</p>
        </div>
      </div>
    </section>

    <section id="ai-workbench" class="section">
      <div class="container ai-workbench">
        <form class="detect-panel" @submit.prevent="runDetection">
          <div class="panel-head">
            <div>
              <h2>检测信息</h2>
              <p>本地视觉检测可直接运行，免费模型接入后会参与第一张图片识别。</p>
            </div>
            <span class="badge badge-primary">{{ photos.length }}/{{ MAX_PHOTOS }} 张</span>
          </div>

          <div
            class="upload-zone"
            :class="{ active: dragActive }"
            @dragenter.prevent="dragActive = true"
            @dragover.prevent="dragActive = true"
            @dragleave.prevent="dragActive = false"
            @drop.prevent="onDrop"
          >
            <input id="ai-photo-input" type="file" accept="image/*" multiple @change="onFileChange" />
            <label for="ai-photo-input">
              <strong>上传器材图片</strong>
              <span>机身、镜头、铭牌、序列号、磨损细节</span>
            </label>
          </div>

          <div v-if="photos.length" class="preview-grid">
            <article v-for="photo in photos" :key="photo.id" class="preview-item">
              <img :src="photo.url" :alt="photo.name" />
              <div>
                <strong>{{ photo.name }}</strong>
                <span>{{ photo.size }}</span>
              </div>
              <button type="button" aria-label="移除图片" @click="removePhoto(photo.id)">×</button>
            </article>
          </div>

          <div class="form-grid">
            <label>器材类型
              <select v-model="form.deviceType">
                <option v-for="item in deviceTypes" :key="item">{{ item }}</option>
              </select>
            </label>
            <label>品牌型号
              <input v-model.trim="form.model" placeholder="例如 Sony A7 IV" />
            </label>
            <label>序列号
              <input v-model.trim="form.serial" placeholder="例如 S012345678" />
            </label>
            <label>卖家成色
              <select v-model="form.condition">
                <option v-for="item in conditionOptions" :key="item">{{ item }}</option>
              </select>
            </label>
            <label>交易价格
              <input v-model.number="form.price" type="number" min="0" step="1" />
            </label>
            <label class="toggle-row">
              <input v-model="modelConfig.enabled" type="checkbox" />
              <span>启用 Hugging Face 免费视觉模型</span>
            </label>
          </div>

          <label>交易描述
            <textarea v-model.trim="form.description" />
          </label>

          <label v-if="modelConfig.enabled">免费模型 Token
            <input v-model.trim="modelConfig.token" type="password" autocomplete="off" placeholder="hf_..." />
          </label>

          <p v-if="error" class="error">{{ error }}</p>
          <p v-if="itemCategoryWarning" class="warning-message">{{ itemCategoryWarning }}</p>
          <div class="actions">
            <button class="btn btn-primary" type="submit" :disabled="scanning || !hasPhotos">
              <span v-if="scanning" class="spinner"></span>
              {{ primaryActionText }}
            </button>
            <button class="btn btn-outline" type="button" @click="resetAll">清空</button>
          </div>
        </form>

        <aside class="result-panel">
          <template v-if="report">
            <div class="score-ring" :class="resultClass" :style="{ '--score': `${report.overall}%` }">
              <strong>{{ report.overall }}</strong>
              <span>{{ report.decision }}</span>
            </div>
            <div class="result-summary">
              <p><b>报告时间</b><span>{{ report.createdAt }}</span></p>
              <p><b>风险等级</b><span>{{ report.riskLevel }}</span></p>
              <p><b>模型状态</b><span>{{ modelResultText(report.aiResult) }}</span></p>
            </div>
            <div class="score-list">
              <article v-for="item in report.scores" :key="item.label">
                <div>
                  <strong>{{ item.label }}</strong>
                  <span>{{ item.status }}</span>
                </div>
                <meter min="0" max="100" :value="item.value"></meter>
                <b>{{ item.value }}</b>
              </article>
            </div>
            <div class="report-section">
              <h3>复核要点</h3>
              <ul>
                <li v-for="item in report.issues" :key="item">{{ item }}</li>
              </ul>
            </div>
            <div class="report-section">
              <h3>处理建议</h3>
              <ul>
                <li v-for="item in report.suggestions" :key="item">{{ item }}</li>
              </ul>
            </div>
          </template>
          <div v-else class="empty-result">
            <span>AI</span>
            <strong>等待检测</strong>
            <p>上传图片后生成评分、风险标签和二手交易报告。</p>
          </div>
        </aside>
      </div>
    </section>
  </main>
</template>

<style scoped>
.ai-page {
  background: var(--bg-secondary);
}

.ai-hero {
  min-height: 500px;
  display: flex;
  align-items: center;
  color: #fff;
  background:
    linear-gradient(90deg, rgba(15, 23, 42, .88), rgba(30, 64, 175, .68)),
    url("https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1800&q=80") center/cover;
}

.ai-hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  align-items: center;
  gap: 36px;
}

.ai-hero-copy h1 {
  margin: 8px 0 12px;
  font-size: 58px;
  line-height: 1.08;
  letter-spacing: 0;
}

.ai-hero-copy p {
  max-width: 620px;
  color: rgba(255, 255, 255, .82);
  font-size: 20px;
  margin-bottom: 28px;
}

.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.hero-outline {
  color: #fff;
  border-color: rgba(255, 255, 255, .42);
}

.live-card {
  position: relative;
  min-height: 260px;
  padding: 28px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .18);
  border-radius: var(--radius-xl);
  background: rgba(37, 99, 235, .42);
  backdrop-filter: blur(16px);
  display: grid;
  align-content: center;
  gap: 8px;
}

.live-card strong {
  font-size: 28px;
}

.live-card p {
  margin: 0;
  color: rgba(255, 255, 255, .82);
}

.live-card.pass {
  background: rgba(34, 197, 94, .3);
}

.live-card.review {
  background: rgba(245, 158, 11, .32);
}

.live-card.risk {
  background: rgba(239, 68, 68, .34);
}

.warning-message {
  margin: 0;
  padding: 14px 18px;
  border-radius: var(--radius-md);
  background: rgba(245, 158, 11, .12);
  border: 1px solid rgba(245, 158, 11, .35);
  color: #b45309;
  font-weight: 600;
  font-size: 15px;
  line-height: 1.5;
}

.scan-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 20%;
  height: 3px;
  background: var(--accent);
  box-shadow: 0 0 18px rgba(245, 158, 11, .85);
  animation: scan 2.4s ease-in-out infinite;
}

.scan-line.paused {
  animation-play-state: paused;
}

@keyframes scan {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(190px); }
}

.ai-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(360px, .92fr);
  gap: 24px;
  align-items: start;
}

.detect-panel,
.result-panel {
  padding: 28px;
  border-radius: var(--radius-xl);
  background: #fff;
  box-shadow: var(--card-shadow);
}

.detect-panel {
  display: grid;
  gap: 18px;
}

.panel-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
}

.panel-head h2 {
  margin-bottom: 4px;
  font-size: 26px;
}

.panel-head p {
  color: var(--text-secondary);
}

.upload-zone {
  position: relative;
  min-height: 156px;
  display: grid;
  place-items: center;
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  transition: var(--transition);
}

.upload-zone.active,
.upload-zone:hover {
  border-color: var(--primary);
  background: rgba(37, 99, 235, .06);
}

.upload-zone input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.upload-zone label {
  width: 100%;
  min-height: 156px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 6px;
  cursor: pointer;
  text-align: center;
}

.upload-zone strong {
  font-size: 20px;
}

.upload-zone span,
.preview-item span,
.result-summary span,
.score-list span,
.empty-result p,
.report-section li {
  color: var(--text-secondary);
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.preview-item {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: #fff;
}

.preview-item img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.preview-item div {
  min-width: 0;
  padding: 10px;
  display: grid;
  gap: 2px;
}

.preview-item strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.preview-item button {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: #fff;
  background: rgba(15, 23, 42, .72);
  font-size: 18px;
  line-height: 1;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.detect-panel label {
  display: grid;
  gap: 8px;
  color: var(--text-primary);
  font-weight: 700;
}

.toggle-row {
  grid-template-columns: 20px 1fr;
  align-items: center;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: #fff;
}

.toggle-row input {
  width: 18px;
  min-height: 18px;
  padding: 0;
}

.result-panel {
  display: grid;
  gap: 18px;
}

.score-ring {
  --ring-color: var(--primary);
  width: 164px;
  height: 164px;
  margin: 0 auto;
  display: grid;
  place-items: center;
  align-content: center;
  border-radius: 50%;
  color: var(--primary);
  background:
    radial-gradient(circle at center, #fff 56%, transparent 57%),
    conic-gradient(var(--ring-color) var(--score, 82%), var(--bg-tertiary) 0);
  box-shadow: inset 0 0 0 1px var(--border);
}

.score-ring.pass {
  --ring-color: var(--success);
  color: var(--success);
}

.score-ring.review {
  --ring-color: var(--accent);
  color: var(--accent);
}

.score-ring.risk {
  --ring-color: var(--danger);
  color: var(--danger);
}

.score-ring strong {
  font-size: 42px;
  line-height: 1;
}

.score-ring span {
  font-size: 13px;
  font-weight: 800;
}

.result-summary {
  display: grid;
  gap: 10px;
}

.result-summary p {
  display: grid;
  grid-template-columns: 84px 1fr;
  gap: 12px;
}

.score-list {
  display: grid;
  gap: 12px;
}

.score-list article {
  display: grid;
  grid-template-columns: 1fr 120px 34px;
  align-items: center;
  gap: 10px;
}

.score-list article div {
  display: grid;
  gap: 2px;
}

.score-list meter {
  width: 100%;
  height: 10px;
}

.report-section {
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.report-section h3 {
  margin-bottom: 8px;
  font-size: 17px;
}

.report-section ul {
  padding-left: 20px;
}

.report-section li {
  margin: 6px 0;
}

.empty-result {
  min-height: 520px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  text-align: center;
}

.empty-result span {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: var(--primary-gradient);
  font-weight: 900;
}

.empty-result strong {
  font-size: 24px;
}

@media (max-width: 980px) {
  .ai-hero-grid,
  .ai-workbench {
    grid-template-columns: 1fr;
  }

  .ai-hero {
    padding: 80px 0;
  }
}

@media (max-width: 640px) {
  .ai-hero-copy h1 {
    font-size: 38px;
  }

  .ai-hero-copy p {
    font-size: 17px;
  }

  .detect-panel,
  .result-panel {
    padding: 20px;
  }

  .panel-head,
  .hero-actions {
    display: grid;
  }

  .form-grid,
  .preview-grid,
  .score-list article {
    grid-template-columns: 1fr;
  }

  .result-summary p {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>
