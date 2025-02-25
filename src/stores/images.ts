import { acceptHMRUpdate, defineStore } from "pinia";
import { ref, computed } from "vue";
import { formatForExport, useFindingsStore } from "./findings";

export interface ImageItem {
  url: string;
  file: File;
}

export const useImagesStore = defineStore("images", () => {
  const images = ref<ImageItem[]>([]);
  const selectedImageIndex = ref<number>(-1);
  const allLabels = ref<{ [key: string]: string }>({});

  const findingStore = useFindingsStore();

  const currentFileName = computed(() => {
    const image = images.value[selectedImageIndex.value];
    return image ? image.file.name : null;
  });

  const selectedImage = computed(() =>
    selectedImageIndex.value >= 0
      ? images.value[selectedImageIndex.value]
      : null,
  );

  const addImage = (image: ImageItem) => {
    images.value.push(image);
    // If no image is selected, select the first one
    if (selectedImageIndex.value === -1) {
      selectedImageIndex.value = 0;
    }
  };

  const loadImage = (file: File): void => {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const result = e.target?.result;
      if (typeof result === "string") {
        addImage({
          url: result,
          file,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const saveCurrentToAllLabels = () => {
    const key = currentFileName.value;
    if (key) {
      const formatted = findingStore.formattedForExport();
      if (formatted) {
        allLabels.value[key] = formatted;
      }
    }
  };

  const selectImage = (index: number): void => {
    // save
    saveCurrentToAllLabels();
    // then do reset and get the next one
    findingStore.$reset();
    selectedImageIndex.value = index;
    // load new
    const oldLabels = allLabels.value[currentFileName.value ?? ""];
    if (!oldLabels) {
      return;
    }

    findingStore.setRawText(oldLabels);
  };

  const deleteImage = (index: number): void => {
    // TODO: does not delete the bounding box
    images.value.splice(index, 1);
    if (selectedImageIndex.value === index) {
      const newIndex = Math.min(index, images.value.length - 1);
      selectImage(newIndex);
    } else if (selectedImageIndex.value > index) {
      const newIndex = selectedImageIndex.value - 1;
      selectImage(newIndex);
    }
  };

  const deleteAllImages = () => {
    images.value = [];
    selectedImageIndex.value = -1;
    clearAllLabels();
  };

  const exportAllFindings = () => {
    saveCurrentToAllLabels();
    return JSON.stringify(allLabels.value);
  };

  const clearAllLabels = () => {
    allLabels.value = {};
    findingStore.$reset();
  };

  return {
    images,
    selectedImageIndex,
    selectedImage,
    addImage,
    loadImage,
    selectImage,
    deleteImage,
    allLabels,
    exportAllFindings,
    clearAllLabels,
    deleteAllImages,
  };
});

if (import.meta.hot)
  import.meta.hot.accept(
    acceptHMRUpdate(useImagesStore as any, import.meta.hot),
  );
