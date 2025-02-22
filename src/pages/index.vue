<!-- App.vue -->
<template>
  <div class="min-h-screen bg-gray-100 p-8">
    <div class="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <h1 class="text-3xl font-bold mb-6 text-gray-800">
        Image Annotation Tool
      </h1>

      <!-- Image upload section -->
      <div
        class="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-6"
        @dragover.prevent
        @drop.prevent="handleDrop"
      >
        <input
          type="file"
          @change="handleFileSelect"
          accept="image/png,image/jpeg"
          class="mb-4"
        />
        <p class="text-gray-500 text-center">or drag and drop an image here</p>
      </div>

      <!-- Image display and annotation section -->
      <div v-if="imageUrl" class="mb-6">
        <div class="relative inline-block" ref="containerRef">
          <img
            :src="imageUrl"
            ref="imageRef"
            @load="handleImageLoad"
            class="max-w-full h-auto"
          />
          <!-- Bounding boxes -->
          <div
            v-for="box in scaledBoundingBoxes"
            :key="box.id"
            class="absolute border-2"
            :style="{
              left: `${box.x_min}px`,
              top: `${box.y_min}px`,
              width: `${box.x_max - box.x_min}px`,
              height: `${box.y_max - box.y_min}px`,
              borderColor: box.color,
            }"
          >
            <span
              class="absolute -top-6 left-0 px-2 py-1 text-sm text-white rounded"
              :style="{ backgroundColor: box.color }"
            >
              ID: {{ box.id }}
            </span>
          </div>
        </div>
      </div>

      <!-- Bounding box inputs -->
      <div v-if="imageUrl" class="space-y-4 text-black">
        <div
          v-for="(box, index) in boundingBoxInputs"
          :key="index"
          class="flex gap-4 items-center"
        >
          <input
            type="text"
            v-model="box.value"
            placeholder="[x_min, y_min, x_max, y_max]"
            class="flex-1 px-4 py-2 border rounded"
            @keyup.enter="handleBoundingBoxInput(index)"
          />
          <button
            @click="handleBoundingBoxInput(index)"
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Box
          </button>
        </div>
      </div>

      <!-- Export button -->
      <button
        v-if="boundingBoxes.length > 0"
        @click="exportBoundingBoxes"
        class="mt-6 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
      >
        Export Bounding Boxes
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";

// Types and interfaces
interface BoundingBox {
  id: number;
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
  color: string;
}

interface BoundingBoxInput {
  value: string;
}

interface ExportData {
  id: number;
  coordinates: [number, number, number, number];
}

// Refs and reactive state
const imageUrl = ref<string | null>(null);
const imageRef = ref<HTMLImageElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const boundingBoxes = reactive<BoundingBox[]>([]);
const boundingBoxInputs = reactive<BoundingBoxInput[]>([{ value: "" }]);
const naturalWidth = ref<number>(0);
const naturalHeight = ref<number>(0);

// Computed scaled bounding boxes based on image display size
const scaledBoundingBoxes = computed(() => {
  if (!imageRef.value) return boundingBoxes;

  const scale = imageRef.value.width / naturalWidth.value;

  return boundingBoxes.map((box) => ({
    ...box,
    x_min: box.x_min * scale,
    y_min: box.y_min * scale,
    x_max: box.x_max * scale,
    y_max: box.y_max * scale,
  }));
});

// Handle window resize
const handleResize = () => {
  // Force recomputation of scaled boxes
  if (imageRef.value) {
    naturalWidth.value = imageRef.value.naturalWidth;
    naturalHeight.value = imageRef.value.naturalHeight;
  }
};

// Setup resize observer
onMounted(() => {
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
});

// Generate random color
const getRandomColor = (): string => {
  const letters: string = "0123456789ABCDEF";
  let color: string = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

// Handle file selection
const handleFileSelect = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    loadImage(file);
  }
};

// Handle drag and drop
const handleDrop = (event: DragEvent): void => {
  const file = event.dataTransfer?.files[0];
  if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
    loadImage(file);
  }
};

// Load image
const loadImage = (file: File): void => {
  const reader = new FileReader();
  reader.onload = (e: ProgressEvent<FileReader>) => {
    const result = e.target?.result;
    if (typeof result === "string") {
      imageUrl.value = result;
      // Reset bounding boxes and inputs
      boundingBoxes.splice(0);
      boundingBoxInputs.splice(0);
      boundingBoxInputs.push({ value: "" });
    }
  };
  reader.readAsDataURL(file);
};

// Handle image load
const handleImageLoad = (): void => {
  if (imageRef.value) {
    naturalWidth.value = imageRef.value.naturalWidth;
    naturalHeight.value = imageRef.value.naturalHeight;
  }
};

// Parse bounding box input
const parseBoundingBox = (
  input: string,
): [number, number, number, number] | null => {
  try {
    const coords = JSON.parse(input.replace(/\s/g, ""));
    if (
      Array.isArray(coords) &&
      coords.length === 4 &&
      coords.every((n) => typeof n === "number")
    ) {
      return coords as [number, number, number, number];
    }
  } catch (e) {
    return null;
  }
  return null;
};

// Handle bounding box input
const handleBoundingBoxInput = (index: number): void => {
  const input = boundingBoxInputs[index].value;
  const coords = parseBoundingBox(input);

  if (coords) {
    const [x_min, y_min, x_max, y_max] = coords;

    // Store coordinates relative to natural image size
    boundingBoxes.push({
      id: boundingBoxes.length,
      x_min,
      y_min,
      x_max,
      y_max,
      color: getRandomColor(),
    });

    // Clear current input and add new one if needed
    boundingBoxInputs[index].value = "";
    if (index === boundingBoxInputs.length - 1) {
      boundingBoxInputs.push({ value: "" });
    }
  } else {
    alert("Invalid format. Please use [x_min, y_min, x_max, y_max]");
  }
};

// Export bounding boxes
const exportBoundingBoxes = (): void => {
  const exportData: ExportData[] = boundingBoxes.map(
    ({ id, x_min, y_min, x_max, y_max }) => ({
      id,
      coordinates: [x_min, y_min, x_max, y_max],
    }),
  );

  const dataStr: string = JSON.stringify(exportData, null, 2);
  const dataUri: string =
    "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

  const linkElement: HTMLAnchorElement = document.createElement("a");
  linkElement.setAttribute("href", dataUri);
  linkElement.setAttribute("download", "bounding_boxes.json");
  linkElement.click();
};
</script>
