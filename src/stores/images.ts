import { acceptHMRUpdate, defineStore } from "pinia";
import { ref, computed } from "vue";
import { useFindingsStore } from "./findings";
import type { InternalRepr } from "~/utils/schemas";
import {
  parseAndMigrateJsonInput,
  exportAllFindingsToJson,
} from "~/services/importExportService";
import { useAnonymisedStore } from "~/stores/anonymised";

export interface ImageItem {
  url: string;
  file: File;
}

function naturalSortFilenames(filenames: ImageItem[]) {
  return filenames.sort((a, b) =>
    new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    }).compare(a.file.name, b.file.name),
  );
}

const createEmptyInternalRepr = (): InternalRepr => ({ think: "", output: [] });

export const useImagesStore = defineStore("images", () => {
  const findingsStore = useFindingsStore();
  const anonymisedStore = useAnonymisedStore();

  const images = ref<ImageItem[]>([]);
  const selectedImageIndex = ref<number>(-1);
  const allLabels = ref<{ [key: string]: InternalRepr }>({});

  const selectedImage = computed<ImageItem | null>(() =>
    selectedImageIndex.value >= 0 &&
    selectedImageIndex.value < images.value.length
      ? images.value[selectedImageIndex.value]
      : null,
  );

  const selectedImageKey = computed<string | null>(() => {
    return selectedImage.value ? selectedImage.value.file.name : null;
  });

  const sortedImages = computed(() => {
    return naturalSortFilenames([...images.value]);
  });

  function saveCurrentFindingsToMap() {
    const key = selectedImageKey.value;
    if (key) {
      // Ensure we get the latest state directly from findings store
      allLabels.value[key] = findingsStore.getFindings;
    }
  }

  function loadFindingsFromMap(key: string | null) {
    if (key && allLabels.value[key]) {
      findingsStore.setFindings(allLabels.value[key]);
    } else {
      // If key is explicitly null or not found, reset findings store
      findingsStore.setFindings(createEmptyInternalRepr());
    }
  }

  function selectImage(index: number): void {
    if (index < 0 || index >= images.value.length) {
      console.warn(`Attempted to select invalid image index: ${index}`);
      return;
    }

    // Save findings of the previously selected image *before* changing the index
    if (selectedImageIndex.value !== -1) {
      saveCurrentFindingsToMap();
    }

    // Avoid redundant actions if the same index is selected
    if (index === selectedImageIndex.value) {
      return;
    }

    selectedImageIndex.value = index;

    // Load findings for the newly selected image
    loadFindingsFromMap(selectedImageKey.value);

    // clear the anonymised image view
    anonymisedStore.clearImage();
  }

  function nextImage() {
    if (images.value.length === 0) return;
    const nextIndex = (selectedImageIndex.value + 1) % images.value.length;
    selectImage(nextIndex);
  }

  function previousImage() {
    if (images.value.length === 0) return;
    const prevIndex =
      (selectedImageIndex.value - 1 + images.value.length) %
      images.value.length;
    selectImage(prevIndex);
  }

  function loadImage(file: File): void {
    if (!file.type.startsWith("image/")) {
      console.error("Invalid file type. Please upload an image.");
      return;
    }
    const imageUrl = URL.createObjectURL(file);
    const newImage: ImageItem = { url: imageUrl, file: file };
    images.value.push(newImage);

    // Initialize labels for the new image if they don't exist from a previous load
    if (!allLabels.value[file.name]) {
      allLabels.value[file.name] = createEmptyInternalRepr();
    }

    // Automatically select the first image added
    if (images.value.length === 1) {
      selectImage(0);
    }
  }

  function addImages(files: FileList | null): void {
    if (!files) return;
    const sortedFiles = Array.from(files).sort((a, b) =>
      new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare(a.name, b.name)
    );
    for (const file of sortedFiles) {
      if (!file) continue;
      loadImage(file);
    }
    // Re-sort the main images array after adding new ones
    images.value = naturalSortFilenames([...images.value]);
    // If no image was selected, select the first one after adding
     if (selectedImageIndex.value === -1 && images.value.length > 0) {
       selectImage(0);
     }
  }

  function deleteImage(index: number): void {
    if (index < 0 || index >= images.value.length) return;

    const deletedImageKey = images.value[index].file.name;
    URL.revokeObjectURL(images.value[index].url);
    images.value.splice(index, 1);
    delete allLabels.value[deletedImageKey];

    if (images.value.length === 0) {
      selectedImageIndex.value = -1;
      loadFindingsFromMap(null); // Clear findings store
    } else if (selectedImageIndex.value >= images.value.length) {
      // If the last image was deleted, select the new last one
      selectImage(images.value.length - 1);
    } else if (selectedImageIndex.value === index) {
       // If the selected image was deleted, select the same index (which is now the next image)
       // or the previous one if it was the last in the list originally.
       const newIndex = Math.min(index, images.value.length - 1);
       loadFindingsFromMap(images.value[newIndex].file.name); // Load data immediately for the new image at this index
       // No need to call selectImage again, just update loaded data
    } else if (selectedImageIndex.value > index) {
      // If an image before the selected one was deleted, decrement the selected index
      selectedImageIndex.value--;
    }
  }

  function deleteAllImages() {
    images.value.forEach((img) => URL.revokeObjectURL(img.url));
    images.value = [];
    allLabels.value = {};
    selectedImageIndex.value = -1;
    loadFindingsFromMap(null); // Clear findings store
    anonymisedStore.clearImage();
  }

  /**
   * Loads findings from a JSON string (expecting a map of filename -> tagged text).
   * Updates the internal `allLabels` state and loads the findings for the currently selected image if available.
   * @param jsonString The JSON string content.
   * @returns An array of error messages ({key, message}) encountered during parsing.
   */
  function loadJSON(jsonString: string): { key: string; message: string }[] {
      const { migratedData, errors } = parseAndMigrateJsonInput(jsonString);

      // Merge successfully migrated data into the existing labels
      // This allows loading multiple JSON files without overwriting unrelated entries
      allLabels.value = { ...allLabels.value, ...migratedData };

      // Try to reload findings for the currently selected image if its data was updated
      const currentKey = selectedImageKey.value;
      if (currentKey && migratedData[currentKey]) {
        loadFindingsFromMap(currentKey);
      } else if (selectedImageIndex.value === -1 && images.value.length > 0) {
        // If no image is selected, but there are images, select the first one
        // (Its findings might have been loaded via the merge above)
        selectImage(0);
      }

      if (errors.length > 0) {
        console.warn(
          "Errors encountered during JSON import:",
          errors.map((e) => `${e.key}: ${e.message}`).join("\n"),
        );
        // Optionally, show errors to the user via a notification system
      }
      return errors; // Return the structured errors
  }

  /**
   * Exports all current findings (including the one being edited) to a single JSON string.
   * @returns The formatted JSON string.
   */
  function exportAllFindings(): string {
    saveCurrentFindingsToMap();
    return exportAllFindingsToJson(allLabels.value);
  }

  /**
   * Creates a backup string. Currently logs to console.
   * TODO: Implement actual download/saving mechanism.
   */
  function backup() {
    const jsonBackup = exportAllFindings();
    console.log("Backup created (implement download):", jsonBackup);
    // Example download trigger (can be moved to a component or helper):
    // const blob = new Blob([jsonBackup], { type: 'application/json' });
    // const url = URL.createObjectURL(blob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = `bbox_backup_${new Date().toISOString()}.json`;
    // document.body.appendChild(a);
    // a.click();
    // document.body.removeChild(a);
    // URL.revokeObjectURL(url);
  }

  function $reset() {
    deleteAllImages();
  }

  return {
    images,
    selectedImageIndex,
    allLabels,

    selectedImage,
    selectedImageKey,
    sortedImages,

    selectImage,
    nextImage,
    previousImage,
    addImages,
    deleteImage,
    deleteAllImages,
    loadJSON,
    exportAllFindings,
    backup,
    loadImage,
    $reset,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useImagesStore, import.meta.hot));
}
