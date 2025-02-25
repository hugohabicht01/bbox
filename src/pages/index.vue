<template>
  <div class="min-h-screen text-black pt-8">
    <div class="max-w-6xl mx-auto bg-white rounded-lg shadow-lg p-6 flex gap-6">
      <!-- Sidebar with image thumbnails -->
      <div class="w-48 border-r pr-4 h-[calc(100vh-8rem)] flex flex-col">
        <h2 class="text-lg font-semibold mb-4">Images</h2>
        <div class="space-y-3 overflow-y-auto flex-1">
          <div
            v-for="(img, index) in images"
            :key="index"
            class="cursor-pointer relative group"
            @click="selectImage(index)"
          >
            <img
              :src="img.url"
              class="w-full h-24 object-cover rounded-lg border-2"
              :class="
                selectedImageIndex === index
                  ? 'border-blue-500'
                  : 'border-transparent'
              "
            />
            <button
              @click.stop="deleteImage(index)"
              class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <div class="i-carbon-trash-can w-4 h-4"></div>
            </button>
          </div>
        </div>
      </div>

      <!-- Main content -->
      <div class="flex-1">
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
            multiple
            class="mb-4"
          />
          <p class="text-gray-500 text-center">or drag and drop images here</p>
        </div>

        <!-- Render the image and bounding boxes -->
        <ImageCanvas :imageUrl="selectedImage?.url" v-if="selectedImage" />
        <p>{{ selectedImage?.file.name }}</p>

        <TextInput />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import ImageCanvas from "~/components/ImageCanvas.vue";

interface ImageItem {
  url: string;
  file: File;
}

const images = ref<ImageItem[]>([]);
const selectedImageIndex = ref<number>(-1);

const selectedImage = computed(() =>
  selectedImageIndex.value >= 0 ? images.value[selectedImageIndex.value] : null,
);

const handleFileSelect = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (files) {
    Array.from(files).forEach((file) => {
      loadImage(file);
    });
  }
};

const handleDrop = (event: DragEvent): void => {
  const files = event.dataTransfer?.files;
  if (files) {
    Array.from(files)
      .filter((file) => file.type === "image/png" || file.type === "image/jpeg")
      .forEach((file) => {
        loadImage(file);
      });
  }
};

const loadImage = (file: File): void => {
  const reader = new FileReader();
  reader.onload = (e: ProgressEvent<FileReader>) => {
    const result = e.target?.result;
    if (typeof result === "string") {
      images.value.push({
        url: result,
        file: file,
      });
      // Select the first image if none is selected
      if (selectedImageIndex.value === -1) {
        selectedImageIndex.value = 0;
      }
    }
  };
  reader.readAsDataURL(file);
};

const selectImage = (index: number): void => {
  selectedImageIndex.value = index;
};

const deleteImage = (index: number): void => {
  images.value.splice(index, 1);
  if (selectedImageIndex.value === index) {
    selectedImageIndex.value = Math.min(index, images.value.length - 1);
  } else if (selectedImageIndex.value > index) {
    selectedImageIndex.value--;
  }
};
</script>

<style scoped>
.group:hover .opacity-0 {
  opacity: 1;
}
</style>
