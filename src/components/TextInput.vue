<template>
  <div class="py-4 text-black">
    <textarea v-model="rawText" class="shadow-lg w-full h-40vh pl-2" />
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
import { useFindingsStore } from "~/stores/findings";

const rawText = ref("");

const findingsStore = useFindingsStore();
const textIsValid = ref<boolean>(false);
const errorText = ref<string>("");

// TODO: watch out with cyclical effects, such as findingsStore updates which update the text
watch(rawText, (newText) => {
  // probably cleared on purpose
  if (newText === "") {
    findingsStore.clearFindings();
    textIsValid.value = true;
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
      textIsValid.value = true;
      errorText.value = "";
      return;
    }
    textIsValid.value = false;
    errorText.value = "Invalid JSON";
    return;
  }

  const res = findingList.safeParse(output);
  if (res.success) return;

  // text might be still in basic form
  const basicRes = basicFindingList.safeParse(output);
  if (!basicRes.success) {
    textIsValid.value = false;
    errorText.value = basicRes.error.message;
    return;
  }

  // this doesn't feel like the right place to do this
  textIsValid.value = true;
  errorText.value = "";
  return findingsStore.addFindings(basicRes.data);
};

const updateRawText = (newOutputText: string) => {
  const fullText = rawText.value;

  const updated = fullText.replace(/<output>.*<\/output>/s, newOutputText);

  rawText.value = updated;
};
</script>
