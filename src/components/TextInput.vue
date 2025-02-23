<template>
  <div class="py-4 text-black">
    <textarea v-model="rawText" class="shadow-lg w-full h-30vh pl-2" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import {
  BboxType,
  getSection,
  bboxEquals,
  FindingList,
  safeParseJSON,
  findingList,
} from "~/utils";

// Define props with withDefaults for TypeScript support
const props = defineProps<{ boundingBoxes: BboxType[] }>();

const rawText = ref("");

watch(rawText, (newText) => {
  // probably cleared on purpose
  if (newText === "") {
    emit("update:boundingBoxes", []);
    return;
  }

  const findings = getStructured(newText);
  if (!findings) return null;

  const boxes = findings.map((f) => f.bounding_box);

  emit("update:boundingBoxes", boxes);
});

const getStructured = (text: string) => {
  const output = safeParseJSON(getSection(text, "output"));
  if (output === "") return null;

  const res = findingList.safeParse(output);
  if (!res.success) return null;

  return res.data;
};

const updateStructured = (structured: FindingList, newBoxes: BboxType[]) => {
  /*
    several cases:
    1. amount of boxes unchanged, just some dimensions changed, so we can go by index
    2. box removed, so we need to go by value
    3. box added, so we need to go by value
    */
  const prevBoxes = structured.map((f) => f.bounding_box);
  if (newBoxes.length !== prevBoxes.length) {
    if (newBoxes.length > prevBoxes.length) {
      console.log("box added");
      // box added
      structured.push({
        bounding_box: newBoxes[newBoxes.length - 1],
        label: "",
        description: "",
        severity: 5,
        explanation: "",
      });
      return structured;
    } else {
      console.log("box removed");
      // box removed
      const removedIndex = prevBoxes.findIndex(
        (oldBox) => !newBoxes.find((newBox) => bboxEquals(oldBox, newBox)),
      );
      structured.splice(removedIndex, 1);
      return structured;
    }
  } else {
    console.log("changed one value ");
    const changedIndexOld = prevBoxes.findIndex(
      (oldBox) => !newBoxes.some((newBox) => bboxEquals(oldBox, newBox)),
    );

    const changedIndexNew = newBoxes.findIndex(
      (newBox) => !prevBoxes.some((oldBox) => bboxEquals(oldBox, newBox)),
    );

    // put in a safeguard that alerts that changing multiple at the same time isn't possible
    const changedCount = prevBoxes
      .map((oldBox) => !newBoxes.some((newBox) => bboxEquals(oldBox, newBox)))
      .filter(Boolean)
      .reduce((count) => count + 1, 0);
    if (changedCount > 1) {
      console.error("changing multiple boxes at the same time is not possible");
      alert("Changing multiple boxes at the same time is not possible");

      console.error("old");
      console.error(structured);
      console.error("new");
      console.error(newBoxes);
      return structured;
    }

    if (changedIndexOld === -1 || changedIndexNew === -1) {
      console.error("could not find changed box");
      console.error("old");
      console.error(structured);
      console.error("new");
      console.error(newBoxes);
      alert("Could not find changed box, code is wrong");
      return structured;
    }

    // do the update to the dimensions
    structured[changedIndexOld].bounding_box = newBoxes[changedIndexNew];
    return structured;
  }
};

function customFindingsStringify(findings: FindingList): string {
  return JSON.stringify(findings, null, 4).replace(
    /"bounding_box": \[\s*([^\]]+?)\s*\]/gs,
    (match, arrayContent) => {
      return `"bounding_box": [${arrayContent.replace(/,\s*/g, ", ")}]`;
    },
  );
}

const updateRawText = (newBoxes: BboxType[]) => {
  // assume that the text is invalid and needs to be discarded
  const structured = getStructured(rawText.value) ?? [];

  const newStructured = updateStructured(structured, newBoxes);

  const jsonified = customFindingsStringify(newStructured);

  const newOutputText = `<output>\n${jsonified}\n</output>`;

  const fullText = rawText.value;

  const updated = fullText.replace(/<output>.*<\/output>/s, newOutputText);

  rawText.value = updated;
};

const getCurrentBoxes = () => {
  const structured = getStructured(rawText.value) ?? [];
  return structured.map((box) => box.bounding_box);
};

const compareAllBoxes = (boxes1: BboxType[], boxes2: BboxType[]) => {
  if (boxes1.length !== boxes2.length) return false;
  for (let i = 0; i < boxes1.length; i++) {
    if (!bboxEquals(boxes1[i], boxes2[i])) return false;
  }

  return true;
};

// Define emits
const emit = defineEmits<{
  (e: "update:boundingBoxes", boxes: BboxType[]): void;
}>();

// Watch for changes in the prop
watch(
  () => props.boundingBoxes,
  (newBoxes) => {
    console.log("props boundingBoxes changed");
    // don't end up in an infinite loop
    const currentBoxes = getCurrentBoxes();
    if (compareAllBoxes(currentBoxes, newBoxes)) {
      console.log("boxes are equal, exiting");
      return;
    }

    console.log("updating raw text");
    updateRawText(newBoxes);
    emit("update:boundingBoxes", newBoxes);
    console.log("sent out update event to parent");
  },
  { deep: true },
);
</script>
