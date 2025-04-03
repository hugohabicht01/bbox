import { acceptHMRUpdate, defineStore } from "pinia";
import { ref, computed } from "vue";
import { useFindingsStore } from "./findings";
import {
  basicFinding,
  Finding,
  InternalRepr,
  getRandomColor,
  getSection,
  internalToExport,
} from "~/utils";
import { z } from "zod";

const migrateToInternalRepr = (json: string) => {
  try {
    const data = JSON.parse(json);

    const error_keys: string[] = [];

    const migrated = Object.keys(data).map((key) => {
      let fileData = data[key];

      // All files should use the string format with tags
      if (typeof fileData !== "string") {
        throw new Error(
          `Error: invalid data, format does not match expected schema for key ${key}`,
        );
      }

      // Parse the <think> and <o> sections
      let thinkContent = getSection(fileData, "think").trim();
      let outputContent = getSection(fileData, "output").trim();

      if (!thinkContent || !outputContent) {
        // save names for bad keys
        error_keys.push(key);
        thinkContent = "EMPTY, erroneous data";
        outputContent = "[]";
      }

      // Parse output JSON
      try {
        const basicFindings = JSON.parse(outputContent);
        const output = basicToNormalized(basicFindings);

        return {
          labels: {
            think: thinkContent,
            output,
          },
          file_name: key,
        };
      } catch (parseError) {
        console.error(
          `Error parsing JSON in output section for ${key}:`,
          parseError,
        );
        throw parseError;
      }
    }) satisfies { file_name: string; labels: InternalRepr }[];

    // if all keys are invalid, then the entire file is probably in the wrong format
    if (error_keys.length === data.length) {
      throw new Error(
        `Error: invalid data, entire format does not match expected schema`,
      );
    }

    // show warning if its just a few keys
    if (error_keys.length > 0) {
      alert(
        `Error parsing some keys, invalid data for ${error_keys.join(", ")}`,
      );
    }

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

  const nextImage = () => {
    if (selectedImageIndex.value === -1) return;
    if (selectedImageIndex.value < images.value.length - 1) {
      selectImage(selectedImageIndex.value + 1);
    }
  };

  const previousImage = () => {
    if (selectedImageIndex.value === -1) return;
    if (selectedImageIndex.value > 0) {
      selectImage(selectedImageIndex.value - 1);
    }
  };

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
      // Format internal representation as a string with tags
      const formatted = findingStore.formattedForExport();
      if (formatted) {
        allLabels.value[key] = findingStore.internalRepr;
      }
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

  const backup = () => {
    const key = Date.now().toString();
    const exportData = exportAllFindings();
    localStorage.setItem(key, exportData);
  };

  const deleteAllImages = () => {
    backup();
    images.value = [];
    selectedImageIndex.value = -1;
    clearAllLabels();
  };

  const exportAllFindings = () => {
    saveCurrentToAllLabels();

    // Convert internal representations back to tag format for export
    const exportData: Record<string, string> = {};

    for (const [key, value] of Object.entries(allLabels.value)) {
      exportData[key] = internalToExport(value);
    }

    return JSON.stringify(exportData);
  };

  const clearAllLabels = () => {
    backup();
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
    nextImage,
    previousImage,
  };
});

if (import.meta.hot)
  import.meta.hot.accept(
    acceptHMRUpdate(useImagesStore as any, import.meta.hot),
  );
