import type { ImageMetaData } from "api/qwen-analysis";
import { acceptHMRUpdate, defineStore } from "pinia";
import { ref, computed } from "vue";

export const useAnonymisedStore = defineStore("anonymised", () => {
  const _imageUrl = ref<string | null>(null);

  const setImage = (imageMetaData : ImageMetaData) => {
    const {url} = imageMetaData
    _imageUrl.value = url;
  };

  const imageUrl = computed(() => _imageUrl.value ?? 'https://placehold.co/400x600' )

  function $reset() {
    _imageUrl.value = null;
  }

  return {
    imageUrl,
    setImage,
    $reset,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAnonymisedStore, import.meta.hot));
}
