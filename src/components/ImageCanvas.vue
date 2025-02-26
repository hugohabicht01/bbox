<template>
  <div v-if="imageUrl" class="mb-6">
    <!-- Attach mousedown on the container -->
    <div
      class="relative inline-block"
      ref="containerRef"
      @mousedown="startDrawing"
    >
      <img :src="imageUrl" ref="imageRef" class="max-w-full h-auto" />
      <!-- Render each bounding box -->
      <div
        v-for="box in findingsStore.findingsBoxes"
        :key="box.id"
        class="absolute border-2"
        :style="{
          left: `${box.x_min}px`,
          top: `${box.y_min}px`,
          width: `${box.x_max - box.x_min}px`,
          height: `${box.y_max - box.y_min}px`,
          borderColor: box.color,
          // Optionally show a dashed border if the box is being drawn
          borderStyle: box.id === drawingBoxId ? 'dashed' : 'solid',
        }"
        @mouseenter="setHoveredBox(box.id)"
        @mouseleave="clearHoveredBox"
      >
        <!-- Box label -->
        <span
          class="absolute -top-6 left-0 px-2 py-1 text-sm text-white rounded"
          :style="{ backgroundColor: box.color }"
        >
          {{ box.label || `Box ${box.id}` }}
        </span>

        <!-- Resize handles (corners) -->
        <div
          v-for="handle in ['nw', 'ne', 'se', 'sw'] as ResizeHandle[]"
          :key="handle"
          class="absolute w-3 h-3 bg-white border-2 rounded-sm"
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
          class="absolute bg-white border-2"
          :style="{
            borderColor: box.color,
            ...getEdgePosition(handle),
            cursor: getHandleCursor(handle),
          }"
          @mousedown.stop="(e) => startResize(e, box.id, handle)"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from "vue";
import { useFindingsStore } from "~/stores/findings";

interface BoundingBox {
  id: number;
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
  boxId: number | null;
  handle: ResizeHandle | null;
  startX: number;
  startY: number;
  originalBox: BoundingBox | null;
}

// Props: imageUrl (one‑way)
defineProps({
  imageUrl: String,
});

const imageRef = ref<HTMLImageElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);

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
  nw: { top: "-5px", left: "-5px" },
  ne: { top: "-5px", right: "-5px" },
  se: { bottom: "-5px", right: "-5px" },
  sw: { bottom: "-5px", left: "-5px" },
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

const startResize = (e: MouseEvent, boxId: number, handle: ResizeHandle) => {
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
const drawingBoxId = ref<number | null>(null);

const startDrawing = (e: MouseEvent) => {
  // Only start drawing if the target is the image
  if (e.target !== imageRef.value) return;
  e.preventDefault();
  isDrawing.value = true;

  const rect = containerRef.value?.getBoundingClientRect();
  const startX = e.clientX - (rect?.left ?? 0);
  const startY = e.clientY - (rect?.top ?? 0);
  drawStartX.value = startX;
  drawStartY.value = startY;

  const newId = findingsStore.addBox([startX, startY, startX, startY]);
  drawingBoxId.value = newId;

  window.addEventListener("mousemove", handleDrawing);
  window.addEventListener("mouseup", stopDrawing);
};

const handleDrawing = (e: MouseEvent) => {
  if (!isDrawing.value) return;
  if (!containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;

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
const hoveredBoxId = ref<number | null>(null);
const setHoveredBox = (id: number) => {
  hoveredBoxId.value = id;
};
const clearHoveredBox = () => {
  hoveredBoxId.value = null;
};

// Listen for keydown events (specifically Backspace) to delete the hovered box.
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Backspace" && hoveredBoxId.value !== null) {
    e.preventDefault();
    findingsStore.removeFinding(hoveredBoxId.value);
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>
