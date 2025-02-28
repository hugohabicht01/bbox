<template>
  <!-- Sidebar with image thumbnails -->
  <div class="w-48 border-r pr-4 h-[calc(100vh-8rem)] flex flex-col">
    <h2 class="text-lg font-semibold mb-4">Images</h2>
    <div class="space-y-3 overflow-y-auto flex-1">
      <div
        v-for="(img, index) in imagesStore.sortedImages"
        :key="index"
        class="cursor-pointer relative group"
        @click="imagesStore.selectImage(index)"
      >
        <img
          :src="img.url"
          class="w-full h-24 object-cover rounded-lg border-2"
          :class="
            imagesStore.selectedImageIndex === index
              ? 'border-blue-500'
              : 'border-transparent'
          "
        />
        <button
          @click.stop="imagesStore.deleteImage(index)"
          class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div class="i-carbon-trash-can w-4 h-4"></div>
        </button>
      </div>
    </div>
    <button
      @click="deleteAllImages"
      class="btn bg-red-500 hover:bg-red-600 mt-8"
    >
      Delete All
    </button>
  </div>
</template>

<script setup lang="ts">
import { useImagesStore } from "~/stores/images";

const imagesStore = useImagesStore();

const deleteAllImages = () => {
  if (window.confirm("Do you really wanna delete ALL images and ALL labels?")) {
    imagesStore.deleteAllImages();
  }
};
</script>
