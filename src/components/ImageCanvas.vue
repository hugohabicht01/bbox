<template>
  <div v-if="imageUrl" class="mb-6">
    <!-- Attach mousedown on the container -->
    <div
      class="relative inline-block"
      ref="containerRef"
      @mousedown="startDrawing"
    >
      <img
        :src="imageUrl"
        ref="imageRef"
        class="max-w-full h-auto select-none"
        id="main-image"
      />
      <!-- Render each bounding box -->
      <div
        v-for="box in scaledBoxes"
        :key="box.id"
        :style="box.style"
        @mouseenter="setHoveredBox(box.id)"
        @mouseleave="clearHoveredBox"
      >
        <!-- Box label -->
        <span
          v-if="showLabels && showBoxes"
          class="absolute -top-6 left-0 px-2 py-1 text-sm text-white rounded select-none"
          :style="{ backgroundColor: box.color }"
        >
          {{ box.label || `Box ${box.id}` }}
        </span>

        <!-- Resize handles (corners) -->
        <div
          v-if="showBoxes"
          v-for="handle in ['nw', 'ne', 'se', 'sw'] as ResizeHandle[]"
          :key="handle"
          class="absolute w-2 h-2 bg-white border border-solid rounded-sm"
          :style="{
            borderColor: box.color,
            ...getHandlePosition(handle),
            cursor: getHandleCursor(handle),
          }"
          @mousedown.stop="(e) => startResize(e, box.id, handle)"
        ></div>

        <!-- Resize handles (edges) -->
        <div
          v-for="handle in ['n', 's', 'e', 'w'] as ResizeHandle[]"
          :key="handle"
          class="absolute bg-white border border-solid"
          :style="{
            borderColor: box.color,
            ...getEdgePosition(handle),
            cursor: getHandleCursor(handle),
          }"
          @mousedown.stop="(e) => startResize(e, box.id, handle)"
          v-if="
            !(box.box[2] - box.box[0] < 50 || box.box[3] - box.box[1] < 50) &&
            showBoxes
          "
        ></div>
      </div>
    </div>

    <!-- Toggle switches moved below the image -->
    <div class="flex items-center space-x-6 mt-3">
      <div class="flex items-center">
        <span class="mr-2 text-sm">Boxes:</span>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="showBoxes" class="sr-only peer" />
          <div
            class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
          ></div>
        </label>
      </div>

      <div class="flex items-center">
        <span class="mr-2 text-sm">Labels:</span>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="showLabels" class="sr-only peer" />
          <div
            class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
          ></div>
        </label>
      </div>

      <div class="flex items-center">
        <span class="mr-2 text-sm">Blur:</span>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="showBlur" class="sr-only peer" />
          <div
            class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
          ></div>
        </label>
      </div>
    </div>
    <p>{{ imagesStore.selectedImage?.file.name }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import { useElementSize } from "@vueuse/core";
import { useImagesStore } from "~/stores/images";
import { useFindingsStore } from "~/stores/findings";

import type { Finding, BboxType } from "~/utils/schemas";

type ResizeHandle = "n" | "s" | "e" | "w" | "nw" | "ne" | "se" | "sw";

interface ResizeState {
  active: boolean;
  boxId: string | null;
  handle: ResizeHandle | null;
  startX: number;
  startY: number;
  originalBox: Finding | null;
}

// Props: imageUrl (one‑way)
const props = defineProps({
  imageUrl: String,
});

const imageRef = ref<HTMLImageElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);

// --- SCALED IMAGE SIZE ---
// Track rendered image size
const { width: imgWidth } = useElementSize(imageRef);

// Compute scale (assume aspect ratio is preserved)
const scale = computed(() => {
  const img = imageRef.value;
  if (!img || !img.naturalWidth) return 1;
  return imgWidth.value / img.naturalWidth;
});

// --- SCALED BOUNDING BOXES ---
import type { CSSProperties } from "vue";

const scaledBoxes = computed(() =>
  findingsStore.findingsBoxes.map((box) => {
    const [x1, y1, x2, y2] = box.box;
    const s = scale.value;
    // Use CSSProperties typing for style
    const style: CSSProperties = {
      left: `${x1 * s}px`,
      top: `${y1 * s}px`,
      width: `${(x2 - x1) * s}px`,
      height: `${(y2 - y1) * s}px`,
      border: showBoxes.value ? "2px solid" : "inherit",
      borderColor: box.color,
      position: "absolute",
      borderStyle: box.id === drawingBoxId.value ? "dashed" : "solid",
      backdropFilter: showBlur.value ? "blur(15px)" : "none",
      boxSizing: "border-box",
    };
    return {
      ...box,
      style,
    };
  })
);
const showBoxes = ref(true); // Toggle for showing/hiding bounding boxes
const showLabels = ref(true); // Toggle for showing/hiding labels
const showBlur = ref(false); // Toggle for applying blur effect to bounding boxes

const findingsStore = useFindingsStore();
const imagesStore = useImagesStore();

// --- RESIZE LOGIC (for existing boxes) ---
const resizeState = reactive<ResizeState>({
  active: false,
  boxId: null,
  handle: null,
  startX: 0,
  startY: 0,
  originalBox: null,
});

// Helper to convert client (screen) coordinates to image (natural) coordinates
function clientToImageCoords(clientX: number, clientY: number) {
  const img = imageRef.value;
  if (!img) return { x: 0, y: 0 };
  const rect = img.getBoundingClientRect();
  const s = scale.value;
  return {
    x: (clientX - rect.left) / s,
    y: (clientY - rect.top) / s,
  };
}

const positions = {
  n: {
    top: "-3px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "16px",
    height: "6px",
  },
  s: {
    bottom: "-3px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "16px",
    height: "6px",
  },
  e: {
    right: "-3px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "6px",
    height: "16px",
  },
  w: {
    left: "-3px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "6px",
    height: "16px",
  },
  nw: { top: "-3px", left: "-3px" },
  ne: { top: "-3px", right: "-3px" },
  se: { bottom: "-3px", right: "-3px" },
  sw: { bottom: "-3px", left: "-3px" },
} as const;

const getHandlePosition = (handle: keyof typeof positions) => {
  return positions[handle] || {};
};

const getEdgePosition = (handle: keyof typeof positions) => {
  return positions[handle] || {};
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

const startResize = (e: MouseEvent, boxId: string, handle: ResizeHandle) => {
  if (!containerRef.value) return;
  resizeState.active = true;
  resizeState.boxId = boxId;
  resizeState.handle = handle;
  const { x, y } = clientToImageCoords(e.clientX, e.clientY);
  resizeState.startX = x;
  resizeState.startY = y;
  resizeState.originalBox = findingsStore.getFindingById(boxId);
  window.addEventListener("mousemove", handleResize);
  window.addEventListener("mouseup", stopResize);
};

const handleResize = (e: MouseEvent) => {
  if (!resizeState.active || !resizeState.originalBox) return;
  const { x, y } = clientToImageCoords(e.clientX, e.clientY);
  const originalFinding = resizeState.originalBox;
  const original = originalFinding.bounding_box;
  const dx = x - resizeState.startX;
  const dy = y - resizeState.startY;

  let [x_min, y_min, x_max, y_max] = original;

  switch (resizeState.handle) {
    case "n":
      y_min += dy;
      break;
    case "s":
      y_max += dy;
      break;
    case "e":
      x_max += dx;
      break;
    case "w":
      x_min += dx;
      break;
    case "nw":
      x_min += dx;
      y_min += dy;
      break;
    case "ne":
      x_max += dx;
      y_min += dy;
      break;
    case "se":
      x_max += dx;
      y_max += dy;
      break;
    case "sw":
      x_min += dx;
      y_max += dy;
      break;
  }

  // Ensure min values don't exceed max values
  if (x_min > x_max) {
    const temp = x_min;
    x_min = x_max;
    x_max = temp;
  }
  if (y_min > y_max) {
    const temp = y_min;
    y_min = y_max;
    y_max = temp;
  }

  // Constrain to image boundaries
  const imgNaturalWidth = imageRef.value?.naturalWidth || 0;
  const imgNaturalHeight = imageRef.value?.naturalHeight || 0;
  x_min = Math.max(0, Math.min(x_min, imgNaturalWidth));
  y_min = Math.max(0, Math.min(y_min, imgNaturalHeight));
  x_max = Math.max(0, Math.min(x_max, imgNaturalWidth));
  y_max = Math.max(0, Math.min(y_max, imgNaturalHeight));

  const updatedBbox: BboxType = [x_min, y_min, x_max, y_max];

  if (resizeState.boxId) {
    findingsStore.updateBox(resizeState.boxId, updatedBbox);
  }
};

const stopResize = () => {
  if (!resizeState.active) return;

  resizeState.active = false;
  resizeState.boxId = null;
  resizeState.handle = null;
  resizeState.originalBox = null;

  window.removeEventListener("mousemove", handleResize);
  window.removeEventListener("mouseup", stopResize);
};

// --- DRAWING NEW BOXES ---
const isDrawing = ref(false);
const drawStartX = ref(0);
const drawStartY = ref(0);

// Helper for drawing: always work in image (natural) coordinates

const drawingBoxId = ref<string | null>(null);

watch(
  () => props.imageUrl,
  () => {
    // reset entire state for new image
    isDrawing.value = false;
    drawStartX.value = 0;
    drawStartY.value = 0;
    drawingBoxId.value = null;

    resizeState.active = false;
    resizeState.boxId = null;
    resizeState.handle = null;
    resizeState.originalBox = null;

    hoveredBoxId.value = null;
  },
);

const startDrawing = (e: MouseEvent) => {
  if (!containerRef.value) return;
  isDrawing.value = true;
  const { x, y } = clientToImageCoords(e.clientX, e.clientY);
  drawStartX.value = x;
  drawStartY.value = y;
  const newId = findingsStore.addBox([x, y, x, y]);
  drawingBoxId.value = newId;
  window.addEventListener("mousemove", handleDrawing);
  window.addEventListener("mouseup", stopDrawing);
};

const handleDrawing = (e: MouseEvent) => {
  if (!isDrawing.value) return;
  const img = imageRef.value;
  if (!img) return;
  let { x, y } = clientToImageCoords(e.clientX, e.clientY);
  // clamp to natural bounds
  x = Math.max(0, Math.min(x, img.naturalWidth));
  y = Math.max(0, Math.min(y, img.naturalHeight));
  const x_min = Math.round(Math.min(drawStartX.value, x));
  const x_max = Math.round(Math.max(drawStartX.value, x));
  const y_min = Math.round(Math.min(drawStartY.value, y));
  const y_max = Math.round(Math.max(drawStartY.value, y));
  findingsStore.updateBox(drawingBoxId.value, [x_min, y_min, x_max, y_max]);
};

const stopDrawing = () => {
  if (!isDrawing.value) return;
  isDrawing.value = false;
  drawingBoxId.value = null;
  window.removeEventListener("mousemove", handleDrawing);
  window.removeEventListener("mouseup", stopDrawing);
};

// --- DELETION LOGIC ---
// Track which box is currently hovered.
const hoveredBoxId = ref<string | null>(null);
const setHoveredBox = (id: string) => {
  hoveredBoxId.value = id;
};
const clearHoveredBox = () => {
  hoveredBoxId.value = null;
};

watch(findingsStore.findingsBoxes, () => {
  // Reset hovered box when there are no boxes left.
  // otherwise you can end up with a bug where you
  // cant use backspace to delete text because the just deleted box is still "hovered"
  if (findingsStore.findingsBoxes.length === 0) {
    clearHoveredBox();
  }
});

// Listen for keydown events (specifically Backspace) to delete the hovered box.
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Backspace" && hoveredBoxId.value !== null) {
    e.preventDefault();
    findingsStore.removeFinding(hoveredBoxId.value);
    clearHoveredBox();
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>