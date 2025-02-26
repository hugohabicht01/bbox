<template>
  <div class="finding-card p-3 rounded-lg shadow-md mb-2" :style="{ borderLeft: `4px solid ${finding.color}` }">
    <div class="flex justify-between items-start">
      <h3 class="font-medium text-base">{{ finding.label }}</h3>
      <span class="bg-gray-100 px-2 py-1 rounded text-sm">Severity: {{ finding.severity }}</span>
    </div>
    <p class="text-sm text-gray-700 my-1">{{ finding.description }}</p>
    <div class="flex text-xs text-gray-500 mt-1">
      <div class="flex-1">ID: {{ finding.id }}</div>
      <div class="bbox-coords text-right">
        {{ formatBbox(finding.bounding_box) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Finding } from '~/utils';

const props = defineProps<{
  finding: Finding
}>();

const formatBbox = (bbox: [number, number, number, number]) => {
  return `[${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}]`;
};
</script>

<style scoped>
.finding-card {
  background-color: white;
  transition: all 0.2s ease;
}

.finding-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
}
</style>