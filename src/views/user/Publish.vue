<script setup>
import { reactive, ref } from 'vue'
import { store } from '../../stores/appStore'

const done = ref(false)
const form = reactive({ name: '', brand: '', category: '二手相机', price: 80, deposit: 1000, description: '' })
function submit() {
  store.addEquipment({
    ...form,
    price: Number(form.price),
    deposit: Number(form.deposit),
    image: 'https://images.unsplash.com/photo-1500634245200-e5245c7574ef?auto=format&fit=crop&w=1200&q=80'
  })
  done.value = true
}
</script>

<template>
  <main class="section">
    <div class="container narrow">
      <h1 class="section-title">发布闲置</h1>
      <p class="section-subtitle">保留原站发布入口，当前以模拟发布方式写入本地器材库。</p>
      <form class="form-card" @submit.prevent="submit">
        <label>器材名称<input v-model="form.name" required /></label>
        <label>品牌<input v-model="form.brand" required /></label>
        <label>分类<input v-model="form.category" required /></label>
        <label>建议日租金<input v-model="form.price" type="number" min="1" /></label>
        <label>押金<input v-model="form.deposit" type="number" min="0" /></label>
        <label>描述<textarea v-model="form.description" required /></label>
        <button class="btn btn-primary" type="submit">提交发布</button>
        <p v-if="done" class="success-text">已模拟发布，可在租赁页查看。</p>
      </form>
    </div>
  </main>
</template>
