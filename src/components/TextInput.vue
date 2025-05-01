<template>
  <div class="py-4 text-black" @keydown.ctrl.c.prevent="exportToClipboard">
    <div class="grid grid-cols-2 gap-4">
      <div class="h-40vh">
        <div class="flex justify-between items-center mb-3">
          <h2 class="text-lg font-semibold text-gray-700">Thinking</h2>
          <button
            @click="analyzeWithClaude"
            class="btn bg-purple-500 hover:bg-purple-600 text-white text-sm px-3 py-1 rounded-lg flex items-center gap-1 m-1"
            :disabled="isAnalyzing"
            :class="{ 'opacity-70 cursor-not-allowed': isAnalyzing }"
          >
            <div
              v-if="isAnalyzing"
              class="i-carbon-circle-dash inline-block animate-spin"
            ></div>
            <span v-else class="i-carbon-bot inline-block"></span>
            {{ isAnalyzing ? "Analyzing..." : "Analyze with Qwen" }}
          </button>

          <button
            @click="anonymiseImage"
            class="btn bg-rose-500 hover:bg-rose-600 text-white text-sm px-3 py-1 rounded-lg flex items-center gap-1 m-1"
            :disabled="isAnonymising"
            :class="{ 'opacity-70 cursor-not-allowed': isAnonymising }"
          >
            <div
              v-if="isAnonymising"
              class="i-carbon-circle-dash inline-block animate-spin"
            ></div>
            <span class="i-carbon-paint-brush inline-block"></span>
            {{ isAnonymising ? "Anonymising..." : "Anonymise" }}
          </button>
        </div>
        <textarea
          v-model="thinkText"
          class="rounded-lg border border-gray-200 shadow-lg h-34vh p-4 w-full"
          placeholder="Enter thinking notes here..."
          :disabled="isAnalyzing"
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
      {{ clipboardActionText }}
    </p>
    <div class="flex [&>*]:m-4 [&>*]:px-4 [&>*]:py-2">
      <button @click="resetText" class="btn bg-red-500 hover:bg-red-600">
        Reset text
      </button>
      <button @click="clearAllLabels" class="btn bg-red-500 hover:bg-red-600">
        Reset all
      </button>
      <button @click="exportToClipboard" class="btn active:bg-gray-200">
        Copy
        <div class="i-carbon-copy inline-block vertical-sub"></div>
      </button>
      <button @click="importFromClipboard" class="btn active:bg-gray-200">
        Paste
        <div class="i-carbon-paste inline-block vertical-sub"></div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import type { Finding } from "~/utils/schemas";
import { basicFindingListSchema } from "~/utils/schemas";
import { getSection, safeParseJSON } from "~/utils/parsers";
import {
  formatInternalReprForExport,
  basicToNormalized,
} from "~/utils/formatting";
import { ClaudeService } from "~/utils";

import { useFindingsStore } from "~/stores/findings";
import { useAnonymisedStore } from "~/stores/anonymised";
import { useImagesStore } from "~/stores/images";
import FindingDisplay from "~/components/FindingDisplay.vue";

const thinkText = ref("");
const isAnalyzing = ref(false);
const isAnonymising = ref(false);
const copied = ref(false);
const clipboardActionText = ref("Copied!");

const findingsStore = useFindingsStore();
const imageStore = useImagesStore();
const anonymisedStore = useAnonymisedStore();
const claudeService = ClaudeService.getInstance();

const anonymiseImage = async () => {
  const currentImage = imageStore.selectedImage;
  if (!currentImage) {
    alert("Please select an image first");
    return;
  }

  try {
    isAnonymising.value = true;

    const currentFindings = findingsStore.getFindings;
    const formattedOutput = formatInternalReprForExport(currentFindings);
    console.log("formatted output:");
    console.log(formattedOutput);

    const anonymisedResponse = await claudeService.anonymiseImage(
      currentImage.file,
      formattedOutput,
    );

    anonymisedStore.setImage(anonymisedResponse.anonymized_image);
  } catch (error) {
    console.error("Error anonymising image:", error);
    alert("Failed to anonymise image. Please try again later.");
  } finally {
    isAnonymising.value = false;
  }
};

const clearAllLabels = () => {
  if (window.confirm("Do you really want to clear ALL labels?")) {
    imageStore.deleteAllImages(); // Updated function call
  }
};

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
  const currentFindings = findingsStore.getFindings;
  const formattedOutput = formatInternalReprForExport(currentFindings);

  navigator.clipboard.writeText(formattedOutput);

  clipboardActionText.value = "Copied to clipboard!";
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 500);
};

const parseTextForOneImage = (text: string) => {
  // Get think section
  const thinkSectionText = getSection(text, "think").trim();
  if (!thinkSectionText) {
    console.error("No think section found in clipboard data");
    return;
  }

  // Get output section (look for <output> tags)
  const outputSectionText = getSection(text, "output");
  if (!outputSectionText) {
    console.error("No output section found in clipboard data");
    return;
  }

  // Parse the output section JSON
  const parsedOutput = safeParseJSON(outputSectionText);
  if (!parsedOutput) {
    console.error("Failed to parse output section as JSON");
    return;
  }

  // Validate the findings format
  const validatedFindings = basicFindingListSchema.safeParse(parsedOutput);
  if (!validatedFindings.success) {
    console.error("Invalid findings format", validatedFindings.error);
    return;
  }
  return {
    think: thinkSectionText,
    output: validatedFindings.data,
  };
};

const importFromClipboard = async () => {
  try {
    const clipboardText = await navigator.clipboard.readText();
    const parsed = parseTextForOneImage(clipboardText);
    if (!parsed) {
      console.error("Failed to parse text");
      return;
    }

    // Convert BasicFinding[] to Finding[] (InternalRepr's 'output' part) and update store
    const normalizedFindings = basicToNormalized(parsed.output);
    findingsStore.setFindings({
      think: parsed.think,
      output: normalizedFindings,
    });

    clipboardActionText.value = "Pasted from clipboard!";
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 500);
  } catch (error) {
    console.error("Error importing from clipboard:", error);
    alert("Failed to import data from clipboard. Please check the format.");
  }
};

// Function to analyze the current image with Claude
const analyzeWithClaude = async () => {
  const currentImage = imageStore.selectedImage;
  if (!currentImage) {
    alert("Please select an image first");
    return;
  }

  try {
    isAnalyzing.value = true;
    // Call the Claude API through our proxy endpoint
    const analysisResponse = await claudeService.analyzeImage(
      currentImage.file,
    );

    if (analysisResponse.anonymized_image) {
      anonymisedStore.setImage(analysisResponse.anonymized_image);
    } else {
      // Handle the case when no anonymized image is returned
      // For example, show a message to the user or take some other action
      alert("No anonymized image returned");
      anonymisedStore.clearImage();
    }
    // TODO: adjust for qwen
    const parsed = parseTextForOneImage(analysisResponse.analysis);
    if (!parsed) {
      findingsStore.setThinkText(
        "Claude hallucinated bad output, sorry: " + analysisResponse,
      );
      return;
    } else {
      // Convert BasicFinding[] to Finding[] (InternalRepr's 'output' part) and update store
      const normalizedFindings = basicToNormalized(parsed.output);
      findingsStore.setFindings({
        think: parsed.think,
        output: normalizedFindings,
      });

      clipboardActionText.value = "Analysis completed!";
      copied.value = true;
      setTimeout(() => {
        copied.value = false;
      }, 500);
    }
  } catch (error) {
    console.error("Error analyzing image:", error);
    alert("Failed to analyze image. Please try again later.");
  } finally {
    isAnalyzing.value = false;
  }
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
