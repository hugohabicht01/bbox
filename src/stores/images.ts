import { acceptHMRUpdate, defineStore } from "pinia";
import { ref, computed } from "vue";
import { useFindingsStore } from "./findings";
import type { InternalRepr } from "~/utils/schemas"; 
import { parseAndMigrateJsonInput, exportAllFindingsToJson } from "~/services/importExportService"; 

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

  const images = ref<ImageItem[]>([]);
  const selectedImageIndex = ref<number>(-1);
  const allLabels = ref<{ [key: string]: InternalRepr }>({});

  const selectedImage = computed<ImageItem | null>(() =>
    selectedImageIndex.value >= 0 && selectedImageIndex.value < images.value.length
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
      allLabels.value[key] = findingsStore.getFindings;
    }
  }

  function loadFindingsFromMap(key: string | null) {
    if (key && allLabels.value[key]) {
      findingsStore.setFindings(allLabels.value[key]);
    } else {
      findingsStore.setFindings(createEmptyInternalRepr());
    }
  }

  function selectImage(index: number): void {
    if (index < 0 || index >= images.value.length) {
      console.warn(`Attempted to select invalid image index: ${index}`);
      return; 
    }

    if (selectedImageIndex.value !== -1) {
       saveCurrentFindingsToMap();
    }

    selectedImageIndex.value = index;

    loadFindingsFromMap(selectedImageKey.value);
  }


  function nextImage() {
    if (images.value.length === 0) return;
    const nextIndex = (selectedImageIndex.value + 1) % images.value.length;
    selectImage(nextIndex);
  }

  function previousImage() {
    if (images.value.length === 0) return;
    const prevIndex =
      (selectedImageIndex.value - 1 + images.value.length) % images.value.length;
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

     if (!allLabels.value[file.name]) {
         allLabels.value[file.name] = createEmptyInternalRepr();
     }

     if (images.value.length === 1) {
         selectImage(0);
     }
  }

  function addImages(files: FileList | null): void {
     if (!files) return;
     for (let i = 0; i < files.length; i++) {
         const file = files[i];
         if (!file) continue; // Should not happen with FileList, but good practice
         loadImage(file);
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
      loadFindingsFromMap(null); 
    } else if (selectedImageIndex.value === index) {
      const newIndex = Math.max(0, index - 1);
      selectImage(newIndex);
    } else if (selectedImageIndex.value > index) {
       selectedImageIndex.value--;
    }
  }

  function deleteAllImages() {
      images.value.forEach(img => URL.revokeObjectURL(img.url));
      images.value = [];
      allLabels.value = {};
      selectedImageIndex.value = -1;
      loadFindingsFromMap(null); 
  }


  function loadJSON(jsonString: string): string[] {
     try {
        const { migratedData, errors } = parseAndMigrateJsonInput(jsonString);

        allLabels.value = { ...allLabels.value, ...migratedData };

        if (selectedImageKey.value && migratedData[selectedImageKey.value]) {
           loadFindingsFromMap(selectedImageKey.value);
        } else if (selectedImageIndex.value === -1 && images.value.length > 0) {
            selectImage(0);
        }

        if (errors.length > 0) {
            console.warn("Errors encountered during JSON import:", errors);
        }
        return errors; 

     } catch (error: any) {
        console.error("Critical error loading JSON:", error);
        return [`Critical error: ${error.message}`]; 
     }
  }


  function exportAllFindings(): string {
     saveCurrentFindingsToMap();
     return exportAllFindingsToJson(allLabels.value);
  }

  function backup() {
      const jsonBackup = exportAllFindings();
      console.log("Backup created (implement download):", jsonBackup);
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
