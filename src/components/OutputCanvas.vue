<template>
  <div class="mb-6 relative inline-block" v-if="anonymised.imageUrl">
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

async function downloadImage() {
  const url = anonymised.imageUrl
  try {
    const response = await fetch(url, { mode: 'cors' });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    // Generate filename based on the actual filetype
    const mimeType = blob.type;
    let fileExtension = mimeType.split('/')[1] || 'jpg';
    // Remove everything after the + sign if present (e.g., svg+xml -> svg)
    fileExtension = fileExtension.split('+')[0];

    link.download = `anonymised-image.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Fetch failed, opening image in a new tab instead.', error);

    // Fallback: open the image in a new tab for manual download
    window.open(url, '_blank');
  }
}
</script>
