import { acceptHMRUpdate, defineStore } from "pinia";
import { ref, computed } from "vue";
import { useFindingsStore } from "./findings";
import {
  basicFinding,
  Finding,
  InternalRepr,
  getRandomColor,
} from "~/utils";
import { z } from "zod";

const migrateToInternalRepr = (json: string) => {
  try {
    const data = JSON.parse(json);
    
    const migrated = Object.keys(data).map((key) => {
      // Expecting data directly in InternalRepr format or compatible format
      const fileData = data[key];
      let internalRepr: InternalRepr;
      
      if (fileData.think !== undefined && Array.isArray(fileData.output)) {
        // Already in InternalRepr format
        const basicFindings = fileData.output;
        const output = basicToNormalized(basicFindings);
        internalRepr = { 
          think: fileData.think,
          output 
        };
      } else if (typeof fileData === 'string') {
        // Legacy format - try to parse from string with tags
        try {
          // Check if it's using the old <think></think> and <o></o> format
          const thinkMatch = fileData.match(/<think>([\s\S]*?)<\/think>/);
          const outputMatch = fileData.match(/<o>([\s\S]*?)<\/o>/);
          
          if (thinkMatch && outputMatch) {
            const thinkContent = thinkMatch[1].trim();
            const outputContent = outputMatch[1].trim();
            
            // Parse output JSON
            const basicFindings = JSON.parse(outputContent);
            const output = basicToNormalized(basicFindings);
            
            internalRepr = { 
              think: thinkContent,
              output 
            };
          } else {
            throw new Error(`Invalid format for ${key}`);
          }
        } catch (parseError) {
          console.error(`Error parsing legacy format for ${key}:`, parseError);
          throw parseError;
        }
      } else {
        throw new Error(`Unknown data format for ${key}`);
      }

      return { labels: internalRepr, file_name: key };
    }) satisfies { file_name: string; labels: InternalRepr }[];

    return migrated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`Error parsing JSON labels: ${error.errors}`);
    } else {
      console.error(`Error parsing JSON labels: ${error}`);
    }
    return null;
  }
};

const basicToNormalized = (basicFindings: basicFinding[]): Finding[] => {
  let id = 1;
  const migrated: Finding[] = [];
  for (const bf of basicFindings) {
    migrated.push({
      id: id++,
      label: bf.label,
      description: bf.description,
      explanation: bf.explanation,
      bounding_box: bf.bounding_box,
      severity: bf.severity,
      color: getRandomColor(),
    });
  }
  return migrated;
};

function naturalSortFilenames(filenames: ImageItem[]) {
  return filenames.sort((a, b) =>
    new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    }).compare(a.file.name, b.file.name),
  );
}

export interface ImageItem {
  url: string;
  file: File;
}

export const useImagesStore = defineStore("images", () => {
  const images = ref<ImageItem[]>([]);
  const selectedImageIndex = ref<number>(-1);
  const allLabels = ref<{ [key: string]: InternalRepr }>({});

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
      // Save the current internal representation directly
      allLabels.value[key] = findingStore.internalRepr;
    }
  };

  const loadJSON = (json: string) => {
    const migrated = migrateToInternalRepr(json);
    if (!migrated) {
      console.error("Failed to migrate JSON");
      return null;
    }

    migrated.forEach((data) => {
      const { file_name, labels } = data;
      allLabels.value[file_name] = labels;
    });

    if (currentFileName.value) {
      // Update the current file's data with the loaded labels
      const currentLabels = allLabels.value[currentFileName.value];
      if (currentLabels) {
        findingStore.setInternalRepr(currentLabels);
      }
    }

    return true;
  };

  const selectImage = (index: number): void => {
    // Save current image data
    saveCurrentToAllLabels();
    // Reset store and select new image
    findingStore.$reset();
    selectedImageIndex.value = index;
    
    // Load data for the new image
    const imageLabels = allLabels.value[currentFileName.value ?? ""];
    if (imageLabels) {
      findingStore.setInternalRepr(imageLabels);
    }
  };

  const deleteImage = (index: number): void => {
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

  const sortedImages = computed(() => {
    return naturalSortFilenames(images.value);
  });

  return {
    images,
    sortedImages,
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
    loadJSON,
  };
});

if (import.meta.hot)
  import.meta.hot.accept(
    acceptHMRUpdate(useImagesStore as any, import.meta.hot),
  );