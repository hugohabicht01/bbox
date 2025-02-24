<template>
  <div class="py-4 text-black" @keydown.ctrl.c.prevent="exportToClipboard">
    <textarea
      v-model="rawText"
      class="rounded-lg border border-black shadow-lg w-full h-40vh p-4"
    />
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
import { ref, watch } from "vue";
import {
  getSection,
  findingList,
  safeParseJSON,
  basicFindingList,
} from "~/utils";

import { useFindingsStore, formatFindings } from "~/stores/findings";

const rawText = ref("");

const findingsStore = useFindingsStore();

const errorText = ref<string>("");
const textIsValid = computed(() => errorText.value.length === 0);

const copied = ref(false);

// TODO: watch out with cyclical effects, such as findingsStore updates which update the text
watch(rawText, (newText) => {
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
    if (newFindings === rawText.value) return;

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

const getStructuredPure = (text: string) => {
  console.log("getStructuredPure");
  const output = safeParseJSON(getSection(text, "output"));
  if (!output) {
    return null;
  }

  const res = findingList.safeParse(output);
  if (!res.success) return null;
  return res.data;
};

const exportToClipboard = () => {
  console.log("exportToClipboard");
  const structured = getStructuredPure(rawText.value);
  if (!structured) return;

  const cleaned = structured.map((finding) => ({
    label: finding.label,
    description: finding.description,
    explanation: finding.explanation,
    bounding_box: finding.bounding_box,
    severity: finding.severity,
  }));
  console.log(cleaned);

  const formattedCleaned = formatFindings(cleaned);

  const fullText = rawText.value;
  const final = fullText.replace(/<output>.*<\/output>/s, formattedCleaned);
  navigator.clipboard.writeText(final);

  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 500);
};
</script>
