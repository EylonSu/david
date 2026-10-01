import type { ImageSegmenter } from '@mediapipe/tasks-vision';

const base = import.meta.env.BASE_URL;

export async function createSegmenter(): Promise<ImageSegmenter> {
  const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`);
  const make = (delegate: 'GPU' | 'CPU') =>
    ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${base}models/selfie_segmenter.tflite`, delegate },
      runningMode: 'VIDEO',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
  try {
    return await make('GPU');
  } catch {
    return make('CPU');
  }
}
