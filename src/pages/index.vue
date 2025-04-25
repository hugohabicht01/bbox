<template>
  <div class="min-h-screen text-black pt-8">
    <div class="max-w-6xl mx-auto bg-white rounded-lg shadow-lg p-6 flex gap-6">
      <ImageList />
      <!-- Main content -->
      <div class="flex-1">
        <h1 class="text-3xl font-bold mb-6 text-gray-800">
          Image Anonymisation Tool
        </h1>

        <!-- Image upload section -->
        <div
          class="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-6"
          @dragover.prevent
          @drop.prevent="handleDrop"
          v-if="imagesStore.images.length === 0"
        >
          <input
            type="file"
            @change="handleFileSelect"
            accept="image/png,image/jpeg,image/webp"
            multiple
            class="mb-4"
          />
          <p class="text-gray-500 text-center">or drag and drop images here</p>
        </div>

          <ImageCanvas
            :imageUrl="imagesStore.selectedImage?.url"
            v-if="imagesStore.selectedImage"
          />

        <TextInput />

        <div
          class="flex flex-row gap-4 items-center [&>*]:px-4 [&>*]:py-2 [&>*]:w-full"
        >
          <button @click="exportAllFindings" class="btn">
            <div class="flex flex-row items-center justify-center">
              <span>Export to JSON</span>
              <div class="i-carbon-export w-4 h-4 ml-4"></div>
            </div>
          </button>

          <label class="btn cursor-pointer relative overflow-hidden">
            <div class="flex flex-row items-center justify-center">
              <span>Load from JSON</span>
              <div class="i-carbon-upload w-4 h-4 ml-4"></div>
              <input
                type="file"
                accept=".json"
                @change="handleFileUpload"
                class="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </label>
        </div>
        <OutputCanvas class="mt-20" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onKeyStroke } from "@vueuse/core";
import { useImagesStore } from "~/stores/images";
import ImageCanvas from "~/components/ImageCanvas.vue";
import TextInput from "~/components/TextInput.vue";

const imagesStore = useImagesStore();

onKeyStroke("ArrowRight", (e) => {
  if (
    document.activeElement instanceof HTMLInputElement ||
    document.activeElement instanceof HTMLTextAreaElement
  ) {
    return;
  }
  e.preventDefault();
  imagesStore.nextImage();
});

onKeyStroke("ArrowLeft", (e) => {
  if (
    document.activeElement instanceof HTMLInputElement ||
    document.activeElement instanceof HTMLTextAreaElement
  ) {
    return;
  }
  e.preventDefault();
  imagesStore.previousImage();
});

const exportAllFindings = () => {
  const exportData = imagesStore.exportAllFindings();
  // download the data as JSON, so format
  const blob = new Blob([exportData], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "export.json";
  link.click();
};

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;

  const file = target.files[0];
  const reader = new FileReader();

  reader.onload = (e) => {
    if (e.target?.result) {
      try {
        loadLabelsFromJSON(e.target.result as string);
      } catch (error) {
        console.error("Error parsing JSON file:", error);
      }
    }
  };

  reader.readAsText(file);

  // Reset the input to allow loading the same file again
  target.value = "";
};

const loadLabelsFromJSON = (jsonData: string) => {
  const success = imagesStore.loadJSON(jsonData);
  if (!success) {
    // TODO: replace with some toast
    console.error("Failed to load JSON data");
  }
};

const handleFileSelect = (event: Event): void => {
  const files = (event.target as HTMLInputElement).files;
  if (files) {
    imagesStore.addImages(files);
  }
};

const handleDrop = (event: DragEvent): void => {
  const files = event.dataTransfer?.files;
  if (files) {
    // The addImages function in the store now handles file type validation
    imagesStore.addImages(files);
  }
};
</script>

<style scoped>
.group:hover .opacity-0 {
  opacity: 1;
}
</style>
