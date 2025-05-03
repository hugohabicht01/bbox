<template>
  <div class="py-4 text-black">
    <div class="mainboxes gap-4">
      <!-- Think Section -->
      <div class="thinkheading flex justify-between items-center mb-3">
        <h2 class="text-lg font-semibold text-gray-700">Thinking</h2>
        <div class="flex items-center space-x-2">
          <button
            @click="analyzeWithQwen"
            class="btn bg-purple-500 hover:bg-purple-600 text-white text-sm px-3 py-1 rounded-lg flex items-center gap-1 m-1"
            :disabled="isAnalyzing"
            :class="{ 'opacity-70 cursor-not-allowed': isAnalyzing }"
            title="Analyze current image with Qwen"
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
            title="Anonymise current image (requires Qwen analysis first or manual labels)"
          >
            <div
              v-if="isAnonymising"
              class="i-carbon-circle-dash inline-block animate-spin"
            ></div>
            <span class="i-carbon-paint-brush inline-block"></span>
            {{ isAnonymising ? "Anonymising..." : "Anonymise" }}
          </button>
        </div>
      </div>
      <textarea
        v-model="localThinkText"
        @input="updateThinkStore"
        class="thinkcontent rounded-lg border border-gray-200 shadow-lg h-40vh p-4 w-full font-mono text-sm"
        placeholder="Enter thinking notes here..."
        :disabled="isAnalyzing"
      />

      <h2 class="outputheading font-semibold mb-3 text-gray-700">Boxes</h2>
      <div
        class="outputcontent overflow-y-auto h-40vh p-2 custom-scrollbar rounded-lg border border-gray-200"
      >
        <div
          v-if="findingsStore.findings.length === 0"
          class="text-gray-500 italic text-sm"
        >
          No findings to display. Add bounding boxes to the image or edit the
          Output JSON.
        </div>
        <FindingDisplay
          v-for="finding in findingsStore.findings"
          :key="finding.id"
          :finding="finding"
          @update:finding="updateFinding"
          @delete="handleDeleteFinding"
        />
      </div>

      <!-- Output/Findings Section -->
    </div>

    <div class="border-t border-gray-200 mt-8">
      <h2 class="outputheading font-semibold my-3 text-gray-700">raw JSON</h2>
      <textarea
        v-model="localOutputText"
        @blur="updateOutputStore"
        class="outputcontent rounded-lg border border-gray-200 shadow-lg flex-grow p-4 w-full font-mono text-sm"
        :class="{ 'border-red-500': outputError }"
      />
      <p v-if="outputError" class="errormsg text-red-600 text-xs mt-1">
        {{ outputError }}
      </p>
    </div>

    <!-- Action Buttons -->
    <div class="flex flex-col p-4 items-center">
      <p
        class="bg-sky-400 text-white rounded-lg p-1 mb-2 text-sm"
        :class="[
          copied
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
          'transition-opacity duration-100',
        ]"
      >
        {{ clipboardActionText }}
      </p>
      <div class="flex [&>*]:m-2 [&>*]:px-4 [&>*]:py-2">
        <button
          @click="resetText"
          class="btn bg-red-500 hover:bg-red-600 text-white text-sm"
        >
          Reset Text
        </button>
        <button
          @click="clearAllLabels"
          class="btn bg-red-500 hover:bg-red-600 text-white text-sm"
        >
          Reset All Labels
        </button>
        <button
          @click="exportToClipboard"
          class="btn active:bg-gray-200 text-sm"
        >
          Copy Tagged Text
          <div class="i-carbon-copy inline-block vertical-sub"></div>
        </button>
        <button
          @click="importFromClipboard"
          class="btn active:bg-gray-200 text-sm"
        >
          Paste Tagged Text
          <div class="i-carbon-paste inline-block vertical-sub"></div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useDebounceFn } from "@vueuse/core";

import type { Finding, InternalRepr } from "~/utils/schemas";
import { ClaudeService } from "~/utils"; // Assuming Qwen logic is within ClaudeService for now
import {
  formatInternalReprForExport,
  formatInternalReprForDisplay, // Use display version if needed, currently using custom stringify
  parseTaggedText,
  parseOutputString,
  _customFindingsStringify, // Import directly for local output formatting - consider if needed
} from "~/services/importExportService";

import { useFindingsStore } from "~/stores/findings";
import { useAnonymisedStore } from "~/stores/anonymised";
import { useImagesStore } from "~/stores/images";
import FindingDisplay from "~/components/FindingDisplay.vue";

// --- State Refs ---
const localThinkText = ref("");
const localOutputText = ref(""); // Holds the JSON string for the output textarea
const outputError = ref<string | null>(null);
const isAnalyzing = ref(false);
const isAnonymising = ref(false);
const copied = ref(false);
const clipboardActionText = ref("Copied!");

// --- Stores ---
const findingsStore = useFindingsStore();
const imageStore = useImagesStore();
const anonymisedStore = useAnonymisedStore();
const claudeService = ClaudeService.getInstance(); // Rename if using a different service class

// --- Computed Properties ---
// Formats the current findings store output for the textarea
const formattedOutputForTextarea = computed(() => {
  // Use the internal service helper _customFindingsStringify for consistency
  // Convert Findings[] to BasicFinding[] first
  const basicFindings = findingsStore.findings.map((f) => ({
    label: f.label,
    description: f.description,
    explanation: f.explanation,
    bounding_box: f.bounding_box,
    severity: f.severity,
  }));
  return _customFindingsStringify(basicFindings);
});

// --- Watchers to sync local state with store ---

// Update localThinkText when store changes (e.g., loading new image)
watch(
  () => findingsStore.thinkText,
  (newThink) => {
    if (newThink !== localThinkText.value) {
      localThinkText.value = newThink;
    }
  },
  { immediate: true }, // Run on component mount
);

// Update localOutputText when store.findings change (e.g., adding a box via UI)
watch(
  () => findingsStore.findings,
  (newFindings) => {
    const newOutputString = formattedOutputForTextarea.value;
    if (newOutputString !== localOutputText.value) {
      localOutputText.value = newOutputString;
      // Clear error if store update was successful (e.g. from UI interaction)
      outputError.value = null;
    }
  },
  { deep: true, immediate: true }, // Deep watch needed for array changes
);

// --- Methods for Updating Store ---

// Debounced update for think text to avoid excessive store updates on typing
const updateThinkStore = useDebounceFn(() => {
  if (findingsStore.thinkText !== localThinkText.value) {
    findingsStore.setThinkText(localThinkText.value);
  }
}, 300);

// Update store when output textarea loses focus
const updateOutputStore = () => {
  const result = findingsStore.updateFindingsFromOutputString(
    localOutputText.value,
  );
  if (!result.success) {
    outputError.value = result.error;
  } else {
    outputError.value = null;
    // Optionally re-format the textarea content based on the successfully parsed data
    // This ensures consistent formatting if the user's input was slightly off but parseable.
    // localOutputText.value = formattedOutputForTextarea.value;
  }
};

// --- Component Logic/Event Handlers ---

const resetText = () => {
  // findingsStore.clearFindings() handles both think and output reset
  findingsStore.clearFindings();
  localThinkText.value = "";
  localOutputText.value = "[]"; // Reset output text to empty array representation
  outputError.value = null;
};

const updateFinding = (updatedFinding: Finding) => {
  findingsStore.updateFinding(updatedFinding);
  // findings watcher will update localOutputText
};

const handleDeleteFinding = (findingId: string) => {
  findingsStore.removeFinding(findingId);
  // findings watcher will update localOutputText
};

const showClipboardMessage = (message: string) => {
  clipboardActionText.value = message;
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1500);
};

const exportToClipboard = () => {
  // Get the current findings directly from the store
  const currentInternalRepr = findingsStore.getFindings;
  // Use the EXPORT formatting function from the service
  const formattedOutput = formatInternalReprForExport(currentInternalRepr);

  navigator.clipboard
    .writeText(formattedOutput)
    .then(() => {
      showClipboardMessage("Tagged text copied!");
    })
    .catch((err) => {
      console.error("Failed to copy to clipboard:", err);
      showClipboardMessage("Failed to copy!");
    });
};

const importFromClipboard = async () => {
  try {
    const clipboardText = await navigator.clipboard.readText();
    // Use the service function to parse the full tagged text
    const parseResult = parseTaggedText(clipboardText);

    if (parseResult.data) {
      // Update the store with the successfully parsed InternalRepr
      findingsStore.setFindings(parseResult.data);
      // Watchers will update localThinkText and localOutputText
      outputError.value = null; // Clear any previous error
      showClipboardMessage("Pasted from clipboard!");
      if (parseResult.error) {
        // Show non-fatal errors/warnings if any occurred during parsing
        alert(`Pasted with warnings: ${parseResult.error}`);
      }
    } else {
      console.error("Failed to parse clipboard text:", parseResult.error);
      alert(`Failed to import data: ${parseResult.error}`);
      showClipboardMessage("Paste failed!");
    }
  } catch (error: any) {
    console.error("Error importing from clipboard:", error);
    alert(`Error reading clipboard: ${error.message}`);
    showClipboardMessage("Paste failed!");
  }
};

// --- External API Calls ---

// Example: Rename function if using Qwen directly
const analyzeWithQwen = async () => {
  const currentImage = imageStore.selectedImage;
  if (!currentImage) {
    alert("Please select an image first");
    return;
  }

  try {
    isAnalyzing.value = true;
    const analysisResponse = await claudeService.analyzeImage(
      currentImage.file,
    );

    // Assuming analysisResponse.analysis contains the tagged text
    const parseResult = parseTaggedText(analysisResponse.analysis);

    if (parseResult.data) {
      findingsStore.setFindings(parseResult.data);
      showClipboardMessage("Analysis completed!");
      if (analysisResponse.anonymized_image) {
        anonymisedStore.setImage(analysisResponse.anonymized_image);
      } else {
        anonymisedStore.clearImage();
        console.warn("Analysis completed, but no anonymized image returned.");
      }
      if (parseResult.error) {
        alert(`Analysis completed with warnings: ${parseResult.error}`);
      }
    } else {
      findingsStore.setThinkText(
        `Qwen analysis failed or returned invalid format. Error: ${parseResult.error}\nRaw response: ${analysisResponse.analysis}`,
      );
      findingsStore.clearFindings(); // Clear potentially inconsistent findings
      alert(`Analysis failed: ${parseResult.error}`);
      showClipboardMessage("Analysis failed!");
    }
  } catch (error: any) {
    console.error("Error analyzing image:", error);
    alert(`Failed to analyze image: ${error.message || "Unknown error"}`);
    showClipboardMessage("Analysis failed!");
  } finally {
    isAnalyzing.value = false;
  }
};

const anonymiseImage = async () => {
  const currentImage = imageStore.selectedImage;
  if (!currentImage) {
    alert("Please select an image first");
    return;
  }

  try {
    isAnonymising.value = true;

    // Get current state and format for export
    const currentFindings = findingsStore.getFindings;
    const formattedForApi = formatInternalReprForExport(currentFindings);

    const anonymisedResponse = await claudeService.anonymiseImage(
      currentImage.file,
      formattedForApi,
    );

    // Assuming response has { anonymized_image: string | null }
    if (anonymisedResponse.anonymized_image) {
      anonymisedStore.setImage(anonymisedResponse.anonymized_image);
      showClipboardMessage("Anonymisation successful!");
    } else {
      alert(
        "Anonymisation call succeeded but no anonymized image was returned.",
      );
      showClipboardMessage("Anonymisation failed!");
    }
  } catch (error: any) {
    console.error("Error anonymising image:", error);
    alert(`Failed to anonymise image: ${error.message || "Unknown error"}`);
    showClipboardMessage("Anonymisation failed!");
  } finally {
    isAnonymising.value = false;
  }
};

const clearAllLabels = () => {
  if (
    window.confirm("Do you really want to clear ALL labels for ALL images?")
  ) {
    imageStore.deleteAllImages();
    // findingsStore is cleared automatically by deleteAllImages -> loadFindingsFromMap(null)
    localThinkText.value = "";
    localOutputText.value = "[]";
    outputError.value = null;
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

/* Minimal mono font style */
textarea.font-mono {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
}

.mainboxes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: min-content 1fr;
  grid-template-areas:
    "thinkheading outputheading"
    "thinkcontent outputcontent";
}

.thinkheading {
  grid-area: thinkheading;
}

.outputheading {
  grid-area: outputheading;
}

.thinkcontent {
  grid-area: thinkcontent;
}

.outputcontent {
  grid-area: outputcontent;
}

.errormsg {
  grid-area: errormsg;
}
</style>
