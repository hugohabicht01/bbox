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
            v-for="box in boundingBoxes"
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
            <!-- Box label -->
            <span
              class="absolute -top-6 left-0 px-2 py-1 text-sm text-white rounded"
              :style="{ backgroundColor: box.color }"
            >
              ID: {{ box.id }}
            </span>

            <!-- Resize handles -->
            <!-- Corners -->
            <div
              v-for="handle in ['nw', 'ne', 'se', 'sw'] as ResizeHandle[]"
              :key="handle"
              class="absolute w-3 h-3 bg-white border-2 rounded-sm cursor-pointer"
              :style="{
                borderColor: box.color,
                ...getHandlePosition(handle),
                cursor: getHandleCursor(handle),
              }"
              @mousedown="(e) => startResize(e, box.id, handle)"
            ></div>

            <!-- Edges -->
            <div
              v-for="handle in ['n', 's', 'e', 'w'] as ResizeHandle[]"
              :key="handle"
              class="absolute bg-white border-2"
              :style="{
                borderColor: box.color,
                ...getEdgePosition(handle),
                cursor: getHandleCursor(handle),
              }"
              @mousedown="(e) => startResize(e, box.id, handle)"
            ></div>
          </div>
        </div>
      </div>

      <!-- Bounding box inputs -->
      <div v-if="imageUrl" class="space-y-4">
        <div
          v-for="(box, index) in boundingBoxes"
          :key="index"
          class="flex gap-4 items-center text-black"
        >
          <p>
            [{{ box.x_min }}, {{ box.y_min }}, {{ box.x_max }}, {{ box.y_max }}]
            <span :style="{ color: box.color }">ID: {{ box.id }}</span>
          </p>
        </div>
        <div
          v-for="(box, index) in boundingBoxInputs"
          :key="index"
          class="flex gap-4 items-center text-black"
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
import { ref, reactive, onMounted, onUnmounted } from "vue";

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

type ResizeHandle = "n" | "s" | "e" | "w" | "nw" | "ne" | "se" | "sw";

interface ResizeState {
  active: boolean;
  boxId: number | null;
  handle: ResizeHandle | null;
  startX: number;
  startY: number;
  originalBox: BoundingBox | null;
}

// Refs and reactive state
const imageUrl = ref<string | null>(null);
const imageRef = ref<HTMLImageElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const boundingBoxes = reactive<BoundingBox[]>([]);
const boundingBoxInputs = reactive<BoundingBoxInput[]>([{ value: "" }]);
const naturalWidth = ref<number>(0);
const naturalHeight = ref<number>(0);

const displayWidth = ref<number>(0);

// Resize state
const resizeState = reactive<ResizeState>({
  active: false,
  boxId: null,
  handle: null,
  startX: 0,
  startY: 0,
  originalBox: null,
});

// Handle positions and styles
const getHandlePosition = (handle: ResizeHandle) => {
  const positions = {
    nw: { top: "-5px", left: "-5px" },
    ne: { top: "-5px", right: "-5px" },
    se: { bottom: "-5px", right: "-5px" },
    sw: { bottom: "-5px", left: "-5px" },
  };
  return positions[handle as keyof typeof positions] || {};
};

const getEdgePosition = (handle: ResizeHandle) => {
  const positions = {
    n: {
      top: "-5px",
      left: "50%",
      transform: "translateX(-50%)",
      width: "20px",
      height: "10px",
    },
    s: {
      bottom: "-5px",
      left: "50%",
      transform: "translateX(-50%)",
      width: "20px",
      height: "10px",
    },
    e: {
      right: "-5px",
      top: "50%",
      transform: "translateY(-50%)",
      width: "10px",
      height: "20px",
    },
    w: {
      left: "-5px",
      top: "50%",
      transform: "translateY(-50%)",
      width: "10px",
      height: "20px",
    },
  };
  return positions[handle as keyof typeof positions] || {};
};

const getHandleCursor = (handle: ResizeHandle): string => {
  const cursors: Record<ResizeHandle, string> = {
    n: "ns-resize",
    s: "ns-resize",
    e: "ew-resize",
    w: "ew-resize",
    nw: "nw-resize",
    ne: "ne-resize",
    se: "se-resize",
    sw: "sw-resize",
  };
  return cursors[handle];
};

// Resize handlers
const startResize = (e: MouseEvent, boxId: number, handle: ResizeHandle) => {
  e.preventDefault();
  const box = boundingBoxes.find((b) => b.id === boxId);
  if (!box) return;

  resizeState.active = true;
  resizeState.boxId = boxId;
  resizeState.handle = handle;
  resizeState.startX = e.clientX;
  resizeState.startY = e.clientY;
  resizeState.originalBox = { ...box };

  window.addEventListener("mousemove", handleResize);
  window.addEventListener("mouseup", stopResize);
};

const handleResize = (e: MouseEvent) => {
  if (!resizeState.active || !resizeState.originalBox || !imageRef.value)
    return;

  const deltaX = e.clientX - resizeState.startX;
  const deltaY = e.clientY - resizeState.startY;

  const box = boundingBoxes.find((b) => b.id === resizeState.boxId);
  if (!box) return;

  const handle = resizeState.handle;
  const original = resizeState.originalBox;

  // Update coordinates based on handle being dragged
  if (handle?.includes("w")) box.x_min = original.x_min + deltaX;
  if (handle?.includes("e")) box.x_max = original.x_max + deltaX;
  if (handle?.includes("n")) box.y_min = original.y_min + deltaY;
  if (handle?.includes("s")) box.y_max = original.y_max + deltaY;

  // Ensure min values don't exceed max values
  if (box.x_min > box.x_max) {
    const temp = box.x_min;
    box.x_min = box.x_max;
    box.x_max = temp;
  }
  if (box.y_min > box.y_max) {
    const temp = box.y_min;
    box.y_min = box.y_max;
    box.y_max = temp;
  }

  // round all coordinates
  box.x_min = Math.round(box.x_min);
  box.x_max = Math.round(box.x_max);
  box.y_min = Math.round(box.y_min);
  box.y_max = Math.round(box.y_max);
};

const stopResize = () => {
  resizeState.active = false;
  resizeState.boxId = null;
  resizeState.handle = null;
  resizeState.originalBox = null;

  window.removeEventListener("mousemove", handleResize);
  window.removeEventListener("mouseup", stopResize);
};

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
    displayWidth.value = imageRef.value.clientWidth;
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

const handleWindowResize = () => {
  if (imageRef.value) {
    displayWidth.value = imageRef.value.clientWidth;
  }
};

// Setup resize observer
onMounted(() => {
  window.addEventListener("resize", handleWindowResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleWindowResize);
});

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
