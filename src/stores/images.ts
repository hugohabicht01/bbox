import { acceptHMRUpdate, defineStore } from "pinia";
import { ref, computed } from "vue";
import { customFindingsStringify, useFindingsStore } from "./findings";
import {
  basicFinding,
  basicTextValidator,
  Finding,
  getSection,
  getStructuredBasicFindings,
  InternalRepr,
  getRandomColor,
} from "~/utils";
import { z } from "zod";

const migrateToInternalRepr = (json: string) => {
  const data = JSON.parse(json);
  try {
    const migrated = Object.keys(data).map((key) => {
      const formatted = data[key];
      const validated = basicTextValidator.parse(formatted);

      // these are guaranteed to exist after the successful validation
      const thinkSection = getSection(formatted, "think");

      const structuredBasicFindings = getStructuredBasicFindings(validated);
      if (!structuredBasicFindings) {
        throw new Error(`Invalid basic findings for ${key}`);
      }

      const output = basicToNormalized(structuredBasicFindings);

      return { labels: { think: thinkSection, output }, file_name: key };
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

const internalReprToString = (internalRepr: InternalRepr) => {
  const formattedOutput = customFindingsStringify(internalRepr.output);

  return `<think>\n${internalRepr.think}\n</think>\n<output>\n${formattedOutput}\n</output>`;
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

  const loadJSON = (json: string) => {
    const migrated = migrateToInternalRepr(json);
    if (!migrated) {
      console.error("Failed to migrate JSON");
      return null;
    }

    migrated.forEach((data) => {
      const { file_name, labels } = data;
      allLabels.value[file_name] = internalReprToString(labels);
    });

    if (currentFileName.value) {
      // update the current file's data with the loaded labels
      findingStore.setRawText(allLabels.value[currentFileName.value]);
    }

    return true;
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
