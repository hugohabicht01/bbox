<!-- App.vue -->
<template>
  <div class="min-h-screen text-black pt-8">
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
      <ImageCanvas :imageUrl="imageUrl" v-if="imageUrl" />

      <!-- Bounding box inputs -->
      <!-- <div v-if="imageUrl" class="space-y-4">
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
      </div> -->

      <TextInput />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import ImageCanvas from "~/components/ImageCanvas.vue";

const imageUrl = ref<string | null>(null);

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
      // boundingBoxes.value.splice(0);
      // boundingBoxInputs.splice(0);
      // boundingBoxInputs.push({ value: "" });
    }
  };
  reader.readAsDataURL(file);
};

// const parseBoundingBox = (
//   input: string,
// ): [number, number, number, number] | string => {
//   try {
//     const coords = JSON.parse(input.replace(/\s/g, ""));
//     const res = bboxSchema.safeParse(coords);
//     if (res.success) {
//       return res.data;
//     }
//     return res.error.message;
//   } catch (e) {
//     return "invalid format";
//   }
// };

// const deleteBox = (index: number) => {
//   boundingBoxes.value.splice(index, 1);
// };
</script>
