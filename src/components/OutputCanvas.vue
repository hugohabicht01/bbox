<template>
  <div class="mb-6 relative inline-block">
    <img
      :src="anonymised.imageUrl"
      ref="imageRef"
      class="max-w-full h-auto"
      id="main-image"
    />
    <div class="flex justify-between items-center mb-3">
      <p class="text-lg font-semibold text-gray-700">Final anonymised image</p>
      <button
        @click="downloadImage"
        class="btn bg-purple-500 hover:bg-purple-600 text-white text-sm px-3 py-1 rounded-lg flex items-center gap-1 m-1"
      >
        <span class="i-carbon-download inline-block"></span>
        Download
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useAnonymisedStore } from "~/stores/anonymised";

const imageRef = ref<HTMLImageElement | null>(null);
const anonymised = useAnonymisedStore();

// Function to download the anonymised image
const downloadImage = () => {
  if (!imageRef.value) return;
  
  // Create a canvas element to draw the image
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Set canvas dimensions to match the image
  canvas.width = imageRef.value.naturalWidth;
  canvas.height = imageRef.value.naturalHeight;
  
  // Draw the image onto the canvas
  if (ctx) {
    ctx.drawImage(imageRef.value, 0, 0);
    
    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL('image/png');
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'anonymised-image.png';
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

</script>
