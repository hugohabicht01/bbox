<template>
  <div class="py-4 text-black" @keydown.ctrl.c.prevent="exportToClipboard">
    <div class="flex gap-4">
      <textarea
        v-model="rawText"
        class="rounded-lg border border-gray-200 shadow-lg w-2/3 h-40vh p-4"
      />
      <div class="findings-list w-1/3 overflow-y-auto h-40vh pr-2 custom-scrollbar">
        <h2 class="text-lg font-semibold mb-3 text-gray-700">Findings</h2>
        <div v-if="findingsStore.findings.length === 0" class="text-gray-500 italic text-sm">
          No findings to display
        </div>
        <FindingDisplay 
          v-for="finding in findingsStore.findings" 
          :key="finding.id" 
          :finding="finding"
          @update:finding="updateFinding"
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
    <pre v-if="!textIsValid" class="text-red-500">{{ errorText }}</pre>
    <div class="[&>*]:m-4 [&>*]:px-4 [&>*]:py-2">
      <button @click="resetText" class="btn">Reset text</button>
      <button @click="clearAllLabels" class="btn">Reset all</button>
      <button
        @click="exportToClipboard"
        class="btn active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="!textIsValid"
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
  getSection,
  findingList,
  safeParseJSON,
  basicFindingList,
  type Finding,
} from "~/utils";

import { useFindingsStore, formatForExport } from "~/stores/findings";
import { useImagesStore } from "~/stores/images";
import FindingDisplay from "~/components/FindingDisplay.vue";

const rawText = ref("");

const findingsStore = useFindingsStore();
const imageStore = useImagesStore();

const clearAllLabels = () => {
  if (window.confirm("Do you really want to clear ALL labels?")) {
    imageStore.clearAllLabels();
  }
};

const errorText = ref<string>("");
const textIsValid = computed(() => errorText.value.length === 0);

const copied = ref(false);

watch(
  () => findingsStore.getRawText,
  (newRaw) => {
    rawText.value = newRaw; // should trigger the watcher below
  },
);

watch(rawText, (newText) => {
  findingsStore.setRawText(newText);
  // probably cleared on purpose
  if (newText === "") {
    findingsStore.clearFindings();
    return;
  }

  syncTextToStore(newText);
});

watch(
  () => findingsStore.findingsFormatted,
  (newFindings) => {
    const currentOutput = rawText.value.match(/<output>.*<\/output>/gs);
    if (currentOutput && currentOutput[0] === newFindings) return;

    // Update the raw text based on the formatted findings
    updateRawText(newFindings);
  },
);

const syncTextToStore = (text: string) => {
  const output = safeParseJSON(getSection(text, "output"));
  if (!output) {
    // we consider empty string to be ok
    if (output === "") {
      errorText.value = "";
      return;
    }
    errorText.value = "Invalid JSON";
    return;
  }

  const res = findingList.safeParse(output);
  if (res.success) {
    errorText.value = "";
    findingsStore.updateAllFindings(res.data);
    return;
  }

  // text might be still in basic form
  const basicRes = basicFindingList.safeParse(output);
  if (!basicRes.success) {
    errorText.value = basicRes.error.message;
    return;
  }

  // this doesn't feel like the right place to do this
  errorText.value = "";
  return findingsStore.addFindings(basicRes.data);
};

const updateRawText = (newOutputText: string) => {
  if (rawText.value.search("<output>") === -1) {
    rawText.value = `<think>\n</think>\n<output>\n</output>`;
  }
  rawText.value = rawText.value.replace(/<output>.*<\/output>/s, newOutputText);
};

const resetText = () => {
  rawText.value = "<think>\n</think>\n<output>\n</output>";
};

const updateFinding = (updatedFinding: Finding) => {
  // Update the finding in the store
  findingsStore.updateFinding(updatedFinding);
};

const exportToClipboard = () => {
  const formatted = formatForExport(rawText.value);
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
