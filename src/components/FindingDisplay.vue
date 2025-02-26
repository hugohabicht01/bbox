<template>
  <div
    class="finding-card p-3 rounded-lg shadow-md mb-2"
    :style="{ borderLeft: `4px solid ${finding.color}` }"
    tabindex="0"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <div class="flex justify-between items-start mb-2">
      <input
        v-model="editedFinding.label"
        placeholder="Label"
        class="font-medium text-base border-b border-transparent focus:border-gray-300 focus:outline-none w-2/3"
        @change="updateFinding"
      />
      <div class="flex items-center">
        <span class="text-sm mr-1">Severity:</span>
        <input
          v-model.number="editedFinding.severity"
          type="number"
          min="1"
          max="10"
          class="bg-gray-100 px-2 py-1 rounded text-sm w-12 focus:outline-none focus:ring-1 focus:ring-blue-500"
          @change="updateFinding"
        />
        <button
          class="ml-2 p-1 text-red-500 hover:text-red-700 transition-colors"
          @click="deleteFinding"
          title="Delete finding"
        >
          <div class="i-carbon-trash-can text-lg"></div>
        </button>
      </div>
    </div>

    <input
      v-model="editedFinding.description"
      placeholder="Description"
      class="text-sm text-gray-700 my-1 w-full border-b border-transparent focus:border-gray-300 focus:outline-none"
      @change="updateFinding"
    />

    <input
      v-model="editedFinding.explanation"
      placeholder="Explanation"
      class="text-sm text-gray-700 my-1 w-full border-b border-transparent focus:border-gray-300 focus:outline-none"
      @change="updateFinding"
    />

    <div class="flex text-xs text-gray-500 mt-2 items-center">
      <div class="flex-1">ID: {{ finding.id }}</div>
      <div class="bbox-coords text-right">
        {{ formatBbox(finding.bounding_box) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from "vue";
import type { Finding } from "~/utils";
import { useFindingsStore } from "~/stores/findings";

const props = defineProps<{
  finding: Finding;
}>();

const emit = defineEmits<{
  (e: "update:finding", finding: Finding): void;
  (e: "delete", id: number): void;
}>();

// Create state for hover detection
const isHovered = ref(false);

// Access the findings store
const findingsStore = useFindingsStore();

// Create a reactive copy of the finding to edit
const editedFinding = reactive<Finding>({
  ...props.finding,
});

// Watch for changes in the original finding prop
watch(
  () => props.finding,
  (newFinding) => {
    // Update only if different to avoid circular updates
    if (JSON.stringify(newFinding) !== JSON.stringify(editedFinding)) {
      Object.assign(editedFinding, newFinding);
    }
  },
  { deep: true },
);

// Function to format bounding box for display
const formatBbox = (bbox: [number, number, number, number]) => {
  return `[${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}]`;
};

// Function to emit update event
const updateFinding = () => {
  emit("update:finding", { ...editedFinding });
};

// Function to delete the finding
const deleteFinding = () => {
  findingsStore.removeFinding(props.finding.id);
  emit("delete", props.finding.id);
};
</script>

<style scoped>
.finding-card {
  background-color: white;
  transition: all 0.2s ease;
}

.finding-card:hover {
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
}

input {
  background: transparent;
  transition: all 0.2s ease;
}

input:hover {
  border-color: #e2e8f0;
}

input:focus {
  background-color: #f8fafc;
}
</style>
