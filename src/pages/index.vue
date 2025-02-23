<!-- App.vue -->
<template>
  <div class="min-h-screen bg-gray-100 p-8 text-black">
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

      <!-- Render the image and bounding boxes -->
      <ImageCanvas
        :imageUrl="imageUrl"
        v-model:boundingBoxes="boundingBoxes"
        v-if="imageUrl"
      />

      <!-- Bounding box inputs -->
      <div v-if="imageUrl" class="space-y-4">
        <div
          v-for="(box, index) in boundingBoxes"
          :key="box.id"
          class="flex gap-4 items-center text-black"
        >
          <p>
            [{{ box.x_min }}, {{ box.y_min }}, {{ box.x_max }}, {{ box.y_max }}]
            <span :style="{ color: box.color }">ID: {{ box.id }}</span>
            <span class="text-red cursor-pointer" @click="deleteBox(index)"
              >&nbsp;
              <div class="i-carbon-trash-can inline-block vertical-sub"></div
            ></span>
          </p>
        </div>
        <div class="flex gap-4 items-center text-black">
          <input
            type="text"
            v-model="newBoxText"
            placeholder="[x_min, y_min, x_max, y_max]"
            class="flex-1 px-4 py-2 border rounded"
            @keyup.enter="addNewBox"
          />
          <button
            @click="addNewBox"
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Box
          </button>
        </div>
      </div>

      <TextInput v-model:bounding-boxes="extractedBoxes" />
      <div class="p-4">
        <h3>boxes:</h3>
        <ul>
          <li v-for="bbox in extractedBoxes" :key="bbox[0]">{{ bbox }}</li>
        </ul>
        <button @click="addTenToFirst" btn>Add Ten</button>
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
import { ref, reactive } from "vue";
import ImageCanvas from "~/components/ImageCanvas.vue";
import { bboxSchema, BboxType } from "~/utils";

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

const imageUrl = ref<string | null>(null);
const boundingBoxes = ref<BoundingBox[]>([]);
const boundingBoxInputs = reactive<BoundingBoxInput[]>([{ value: "" }]);

const extractedBoxes = ref<BboxType[]>([]);

const addTenToFirst = () => {
  if (extractedBoxes.value[0]) {
    extractedBoxes.value[0] = [
      extractedBoxes.value[0][0] + 10,
      extractedBoxes.value[0][1] + 10,
      extractedBoxes.value[0][2] + 10,
      extractedBoxes.value[0][3] + 10,
    ];
  }
};

const newBoxText = ref("");

const handleFileSelect = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    loadImage(file);
  }
};

const handleDrop = (event: DragEvent): void => {
  const file = event.dataTransfer?.files[0];
  if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
    loadImage(file);
  }
};

const loadImage = (file: File): void => {
  const reader = new FileReader();
  reader.onload = (e: ProgressEvent<FileReader>) => {
    const result = e.target?.result;
    if (typeof result === "string") {
      imageUrl.value = result;
      // Reset bounding boxes and inputs
      boundingBoxes.value.splice(0);
      boundingBoxInputs.splice(0);
      boundingBoxInputs.push({ value: "" });
    }
  };
  reader.readAsDataURL(file);
};

const parseBoundingBox = (
  input: string,
): [number, number, number, number] | string => {
  try {
    const coords = JSON.parse(input.replace(/\s/g, ""));
    const res = bboxSchema.safeParse(coords);
    if (res.success) {
      return res.data;
    }
    return res.error.message;
  } catch (e) {
    return "invalid format";
  }
};

const addNewBox = () => {
  const coords = parseBoundingBox(newBoxText.value);
  if (typeof coords === "string") {
    alert(coords);
    return;
  }

  const [x_min, y_min, x_max, y_max] = coords;
  boundingBoxes.value.push({
    id: boundingBoxes.value.length,
    x_min,
    y_min,
    x_max,
    y_max,
    color: getRandomColor(),
  });
  newBoxText.value = "";
};

const deleteBox = (index: number) => {
  boundingBoxes.value.splice(index, 1);
};

const getRandomColor = (): string => {
  const letters: string = "0123456789ABCDEF";
  let color: string = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

const exportBoundingBoxes = (): void => {
  const exportData: ExportData[] = boundingBoxes.value.map(
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
