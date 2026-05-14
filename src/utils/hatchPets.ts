import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { InstalledHatchPet } from "../styles/profiles/hatchPet";

export const HATCH_PETS_STORAGE_KEY = "limulu_hatch_pets_v1";

type NativeInstalledHatchPet = {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
  theme?: {
    primaryColor?: string;
  };
};

type InstallHatchPetZipResult = {
  pet: NativeInstalledHatchPet;
};

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

const toHex = ({ r, g, b }: RgbColor) =>
  `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;

const rgbToHsl = ({ r, g, b }: RgbColor) => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { hue: 0, saturation: 0, lightness };

  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;
  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return { hue: hue / 6, saturation, lightness };
};

const isValidHexColor = (value: string | undefined) => Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value.trim()));

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`failed to load hatch-pet spritesheet: ${src}`));
    image.src = src;
  });

const loadImageForCanvas = async (src: string) => {
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`failed to fetch hatch-pet spritesheet: ${response.status}`);
    const blobUrl = URL.createObjectURL(await response.blob());
    const image = await loadImage(blobUrl);
    return { image, revoke: () => URL.revokeObjectURL(blobUrl) };
  } catch {
    const image = await loadImage(src);
    return { image, revoke: () => undefined };
  }
};

const extractDominantColor = async (spritesheetUrl: string): Promise<string | undefined> => {
  if (typeof document === "undefined") return undefined;

  let revokeLoadedImage: () => void = () => undefined;
  try {
    const { image, revoke } = await loadImageForCanvas(spritesheetUrl);
    revokeLoadedImage = revoke;
    const canvas = document.createElement("canvas");
    const width = Math.min(128, Math.max(1, image.naturalWidth));
    const height = Math.min(128, Math.max(1, image.naturalHeight));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return undefined;

    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const buckets = new Map<string, { color: RgbColor; weight: number }>();

    for (let index = 0; index < pixels.length; index += 16) {
      const alpha = pixels[index + 3] / 255;
      if (alpha < 0.45) continue;

      const color = {
        r: pixels[index],
        g: pixels[index + 1],
        b: pixels[index + 2],
      };
      const { saturation, lightness } = rgbToHsl(color);
      if (lightness > 0.96 || lightness < 0.08) continue;

      const chromaWeight = 0.24 + saturation * 1.75;
      const lightnessWeight = 0.65 + (1 - Math.abs(lightness - 0.56)) * 0.35;
      const weight = alpha * chromaWeight * lightnessWeight;
      const bucketColor = {
        r: Math.round(color.r / 24) * 24,
        g: Math.round(color.g / 24) * 24,
        b: Math.round(color.b / 24) * 24,
      };
      const key = `${bucketColor.r},${bucketColor.g},${bucketColor.b}`;
      const bucket = buckets.get(key) ?? { color: { r: 0, g: 0, b: 0 }, weight: 0 };
      bucket.color.r += color.r * weight;
      bucket.color.g += color.g * weight;
      bucket.color.b += color.b * weight;
      bucket.weight += weight;
      buckets.set(key, bucket);
    }

    let selected: { color: RgbColor; weight: number } | undefined;
    for (const bucket of buckets.values()) {
      if (!selected || bucket.weight > selected.weight) {
        selected = bucket;
      }
    }

    if (!selected || selected.weight <= 0) return undefined;
    return toHex({
      r: selected.color.r / selected.weight,
      g: selected.color.g / selected.weight,
      b: selected.color.b / selected.weight,
    });
  } catch {
    return undefined;
  } finally {
    revokeLoadedImage();
  }
};

const normalizeInstalledPet = async (pet: NativeInstalledHatchPet): Promise<InstalledHatchPet> => {
  const spritesheetUrl = convertFileSrc(pet.spritesheetPath);
  const configuredPrimary = pet.theme?.primaryColor?.trim();
  const primaryColor = isValidHexColor(configuredPrimary) ? configuredPrimary : await extractDominantColor(spritesheetUrl);

  return {
    ...pet,
    spritesheetUrl,
    theme: {
      ...pet.theme,
      primaryColor,
    },
  };
};

const toStoredPet = (pet: InstalledHatchPet): NativeInstalledHatchPet => ({
  id: pet.id,
  displayName: pet.displayName,
  description: pet.description,
  spritesheetPath: pet.spritesheetPath,
  theme: pet.theme,
});

export const saveInstalledHatchPets = (pets: InstalledHatchPet[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HATCH_PETS_STORAGE_KEY, JSON.stringify(pets.map(toStoredPet)));
  } catch {
    // Ignore storage failures so manual installation does not break current runtime state.
  }
};

export const loadInstalledHatchPets = async (): Promise<InstalledHatchPet[]> => {
  if (typeof window === "undefined") return [];

  try {
    const rawPets = JSON.parse(window.localStorage.getItem(HATCH_PETS_STORAGE_KEY) || "[]") as NativeInstalledHatchPet[];
    if (!Array.isArray(rawPets)) return [];
    return Promise.all(rawPets.map(normalizeInstalledPet));
  } catch {
    return [];
  }
};

export const installHatchPetZip = async (file: File): Promise<InstalledHatchPet> => {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  const result = await invoke<InstallHatchPetZipResult>("install_hatch_pet_zip", {
    fileName: file.name,
    bytes,
  });
  const installedPet = await normalizeInstalledPet(result.pet);
  const pets = await loadInstalledHatchPets();
  const mergedPets = [installedPet, ...pets.filter((pet) => pet.id !== installedPet.id)].sort((a, b) =>
    a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase()),
  );
  saveInstalledHatchPets(mergedPets);
  return installedPet;
};
