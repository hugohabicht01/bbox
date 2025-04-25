import type { ImageMetaData } from "api/qwen-analysis";
import { acceptHMRUpdate, defineStore } from "pinia";
import { ref } from "vue";

export const useAnonymisedStore = defineStore("anonymised", () => {
  const imageUrl = ref<string | null>(null);

  const setImage = (imageMetaData : ImageMetaData) => {
    const {url} = imageMetaData
    imageUrl.value = url;
  };

  function $reset() {
    imageUrl.value = null;
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
