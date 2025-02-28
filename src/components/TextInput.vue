<template>
  <div class="py-4 text-black" @keydown.ctrl.c.prevent="exportToClipboard">
    <div class="grid grid-cols-2 gap-4">
      <div class="h-40vh">
        <h2 class="text-lg font-semibold mb-3 text-gray-700">Thinking</h2>
        <textarea
          v-model="thinkText"
          class="rounded-lg border border-gray-200 shadow-lg h-36vh p-4 w-full"
          placeholder="Enter thinking notes here..."
        />
      </div>
      <div class="findings-list overflow-y-auto h-40vh pr-2 custom-scrollbar">
        <h2 class="text-lg font-semibold mb-3 text-gray-700">Findings</h2>
        <div
          v-if="findingsStore.findings.length === 0"
          class="text-gray-500 italic text-sm"
        >
          No findings to display
        </div>
        <FindingDisplay
          v-for="finding in findingsStore.findings"
          :key="finding.id"
          :finding="finding"
          @update:finding="updateFinding"
          @delete="handleDeleteFinding"
        />
      </div>
    </div>
  </div>
  <div class="flex flex-col p-4">
    <p
      class="bg-sky-400 text-white rounded-lg p-1"
      :class="[
        copied
          ? 'opacity-100 pointer-events-auto'
          : 'opacity-0 pointer-events-none',
        'transition-opacity duration-100',
      ]"
    >
      Copied!
    </p>
    <div class="flex [&>*]:m-4 [&>*]:px-4 [&>*]:py-2">
      <button @click="resetText" class="btn bg-red-500 hover:bg-red-600">
        Reset text
      </button>
      <button @click="clearAllLabels" class="btn bg-red-500 hover:bg-red-600">
        Reset all
      </button>
      <button
        @click="exportToClipboard"
        class="btn active:bg-gray-200"
      >
        Copy
        <div class="i-carbon-copy inline-block vertical-sub"></div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import {
  type Finding,
} from "~/utils";

import { useFindingsStore } from "~/stores/findings";
import { useImagesStore } from "~/stores/images";
import FindingDisplay from "~/components/FindingDisplay.vue";

const thinkText = ref("");

const findingsStore = useFindingsStore();
const imageStore = useImagesStore();

const clearAllLabels = () => {
  if (window.confirm("Do you really want to clear ALL labels?")) {
    imageStore.clearAllLabels();
  }
};

const copied = ref(false);

// Update thinkText whenever the store's thinkText changes
watch(
  () => findingsStore.thinkText,
  (newThink) => {
    thinkText.value = newThink;
  },
);

// Update the store's thinkText whenever the local thinkText changes
watch(thinkText, (newText) => {
  findingsStore.setThinkText(newText);
});

const resetText = () => {
  findingsStore.setThinkText("");
  findingsStore.clearFindings();
};

const updateFinding = (updatedFinding: Finding) => {
  findingsStore.updateFinding(updatedFinding);
};

const handleDeleteFinding = (id: number) => {
  // The actual removal is handled in the FindingDisplay component
  // This is just a hook in case we need to do additional cleanup
};

const exportToClipboard = () => {
  const formatted = findingsStore.formattedForExport();
  if (!formatted) return;
  navigator.clipboard.writeText(formatted);

  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 500);
};
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #ccc;
}
</style>