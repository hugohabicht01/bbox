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
        class="max-w-full h-auto"
        id="main-image"
      />
      <!-- Render each bounding box -->
      <div
        v-for="box in findingsStore.findingsBoxes"
        :key="box.id"
        :style="{
          left: `${box.x_min}px`,
          top: `${box.y_min}px`,
          width: `${box.x_max - box.x_min}px`,
          height: `${box.y_max - box.y_min}px`,
          border: showBoxes ? 'solid' : 'inherit',
          'border-color': box.color,
          borderWidth: showBoxes ? '2px' : 'inherit',
          position: 'absolute',
          // Optionally show a dashed border if the box is being drawn
          borderStyle: box.id === drawingBoxId ? 'dashed' : 'solid',
          backdropFilter: showBlur ? 'blur(15px)' : 'none',
        }"
        @mouseenter="setHoveredBox(box.id)"
        @mouseleave="clearHoveredBox"
      >
        <!-- Box label -->
        <span
          v-if="showLabels && showBoxes"
          class="absolute -top-6 left-0 px-2 py-1 text-sm text-white rounded"
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
            !(box.x_max - box.x_min < 50 || box.y_max - box.y_min < 50) &&
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

      <div class="flex items-center">
        <span class="mr-2 text-sm">Generate prefill:</span>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            v-model="findingsStore.enablePrefill"
            class="sr-only peer"
          />
          <div
            class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
          ></div>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from "vue";
import { useFindingsStore } from "~/stores/findings";

interface BoundingBox {
  id: string;
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
  color: string;
  label: string;
}

type ResizeHandle = "n" | "s" | "e" | "w" | "nw" | "ne" | "se" | "sw";

interface ResizeState {
  active: boolean;
  boxId: string | null;
  handle: ResizeHandle | null;
  startX: number;
  startY: number;
  originalBox: BoundingBox | null;
}

// Props: imageUrl (one‑way)
const props = defineProps({
  imageUrl: String,
});

const imageRef = ref<HTMLImageElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const showBoxes = ref(true); // Toggle for showing/hiding bounding boxes
const showLabels = ref(true); // Toggle for showing/hiding labels
const showBlur = ref(false); // Toggle for applying blur effect to bounding boxes

const findingsStore = useFindingsStore();

// --- RESIZE LOGIC (for existing boxes) ---
const resizeState = reactive<ResizeState>({
  active: false,
  boxId: null,
  handle: null,
  startX: 0,
  startY: 0,
  originalBox: null,
});

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
  e.preventDefault();
  const box = findingsStore.getBox(boxId);
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

  const handle = resizeState.handle;
  const original = resizeState.originalBox;
  const imgWidth = imageRef.value.width;
  const imgHeight = imageRef.value.height;

  let x_min = original.x_min;
  let y_min = original.y_min;
  let x_max = original.x_max;
  let y_max = original.y_max;

  if (handle?.includes("w")) x_min += deltaX;
  if (handle?.includes("e")) x_max += deltaX;
  if (handle?.includes("n")) y_min += deltaY;
  if (handle?.includes("s")) y_max += deltaY;

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
  x_min = Math.max(0, Math.min(x_min, imgWidth));
  y_min = Math.max(0, Math.min(y_min, imgHeight));
  x_max = Math.max(0, Math.min(x_max, imgWidth));
  y_max = Math.max(0, Math.min(y_max, imgHeight));

  const updatedBox = [x_min, y_min, x_max, y_max].map(Math.round) as [
    number,
    number,
    number,
    number,
  ];
  findingsStore.updateBox(resizeState.boxId, updatedBox);
};

const stopResize = () => {
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
  // Only start drawing if the target is the image
  if (e.target !== imageRef.value) return;
  e.preventDefault();
  isDrawing.value = true;

  const rect = containerRef.value?.getBoundingClientRect();
  const imgWidth = imageRef.value?.width || 0;
  const imgHeight = imageRef.value?.height || 0;

  let startX = e.clientX - (rect?.left ?? 0);
  let startY = e.clientY - (rect?.top ?? 0);

  // Constrain to image boundaries
  startX = Math.max(0, Math.min(startX, imgWidth));
  startY = Math.max(0, Math.min(startY, imgHeight));

  drawStartX.value = startX;
  drawStartY.value = startY;

  const newId = findingsStore.addBox([startX, startY, startX, startY]);
  drawingBoxId.value = newId;

  window.addEventListener("mousemove", handleDrawing);
  window.addEventListener("mouseup", stopDrawing);
};

const handleDrawing = (e: MouseEvent) => {
  if (!isDrawing.value) return;
  if (!containerRef.value || !imageRef.value) return;

  const rect = containerRef.value.getBoundingClientRect();
  const imgWidth = imageRef.value.width;
  const imgHeight = imageRef.value.height;

  // Calculate current position
  let currentX = e.clientX - rect.left;
  let currentY = e.clientY - rect.top;

  // Constrain to image boundaries
  currentX = Math.max(0, Math.min(currentX, imgWidth));
  currentY = Math.max(0, Math.min(currentY, imgHeight));

  const x_min = Math.round(Math.min(drawStartX.value, currentX));
  const x_max = Math.round(Math.max(drawStartX.value, currentX));
  const y_min = Math.round(Math.min(drawStartY.value, currentY));
  const y_max = Math.round(Math.max(drawStartY.value, currentY));
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
