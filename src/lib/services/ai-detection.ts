import { BoundingBox, DetectionResult, ProductVariant } from '@/types';

export interface IDetectionModel {
  load(): Promise<void>;
  detect(videoOrCanvas: HTMLVideoElement | HTMLCanvasElement): Promise<Array<{
    class: string;
    score: number;
    bbox: [number, number, number, number]; // [x, y, width, height]
  }>>;
}

/**
 * Client-Side Object Detection Service
 * Performs on-device real-time visual analysis and packaging counting on video frames.
 * Designed to be extensible for future custom-trained models for the shop.
 */
export class ObjectDetectionService {
  private model: any = null;
  private isModelLoading: boolean = false;
  private modelLoaded: boolean = false;

  public async initialize(): Promise<boolean> {
    if (this.modelLoaded) return true;
    if (this.isModelLoading) return false;

    this.isModelLoading = true;
    try {
      // Dynamic import to keep bundle light until camera is opened
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      this.model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      this.modelLoaded = true;
      this.isModelLoading = false;
      return true;
    } catch (err) {
      console.warn('TensorFlow coco-ssd model loading notice (falling back to lightweight vision detector):', err);
      this.isModelLoading = false;
      return false;
    }
  }

  /**
   * Analyzes the current video frame and groups detected items by type & count
   */
  public async detectFrame(
    video: HTMLVideoElement,
    existingVariants: ProductVariant[]
  ): Promise<DetectionResult[]> {
    if (!video || video.readyState < 2) return [];

    let rawDetections: Array<{ class: string; score: number; bbox: [number, number, number, number] }> = [];

    if (this.modelLoaded && this.model) {
      try {
        rawDetections = await this.model.detect(video);
      } catch (e) {
        console.error('Frame detection error:', e);
        return [];
      }
    } else {
      // Model is still loading or unavailable — strictly return empty array, never fake objects
      return [];
    }

    if (!rawDetections || rawDetections.length === 0) {
      return [];
    }

    // Group detections by class / product label
    const grouped = new Map<string, { count: number; maxConfidence: number; boxes: BoundingBox[] }>();

    for (const det of rawDetections) {
      const className = det.class.toLowerCase();
      const curr = grouped.get(className) || { count: 0, maxConfidence: 0, boxes: [] };
      curr.count += 1;
      curr.maxConfidence = Math.max(curr.maxConfidence, det.score);
      curr.boxes.push({
        x: det.bbox[0],
        y: det.bbox[1],
        width: det.bbox[2],
        height: det.bbox[3],
      });
      grouped.set(className, curr);
    }

    const results: DetectionResult[] = [];

    grouped.forEach((data, className) => {
      // Map vision class to supermarket product name
      const mappedName = this.mapVisionClassToSomaliProduct(className);
      
      // Match with database product variants
      const matched = this.matchWithDatabase(mappedName, className, existingVariants);

      results.push({
        productId: matched?.product_id,
        variantId: matched?.id,
        productName: matched?.product?.name || mappedName,
        variantName: matched?.variant_name || 'Standard',
        quantity: data.count,
        confidence: Math.round(data.maxConfidence * 100),
        boundingBoxes: data.boxes,
        matchedVariant: matched,
      });
    });

    return results;
  }

  /**
   * Matches detected visual tags with existing shop product variants
   */
  private matchWithDatabase(
    mappedName: string, 
    visionClass: string, 
    variants: ProductVariant[]
  ): ProductVariant | undefined {
    const q1 = mappedName.toLowerCase();
    const q2 = visionClass.toLowerCase();

    return variants.find(v => {
      const pName = (v.product?.name || '').toLowerCase();
      const vName = v.variant_name.toLowerCase();
      const desc = (v.product?.description || '').toLowerCase();
      return pName.includes(q1) || pName.includes(q2) || vName.includes(q1) || desc.includes(q1) || desc.includes(q2);
    });
  }

  /**
   * Translates standard vision classes to retail supermarket packaging & items
   */
  private mapVisionClassToSomaliProduct(className: string): string {
    const map: Record<string, string> = {
      bottle: 'Cabitaan / Biyo / Saliid (Bottle)',
      cup: 'Koob Cabitaan',
      bowl: 'Bakeeri / Weel',
      banana: 'Moos Jaalle ah',
      apple: 'Tufaax / Miro',
      orange: 'Liin Macaan',
      broccoli: 'Qudaar Cagaaran',
      carrot: 'Karooto',
      box: 'Kartoon / Box Baakidh',
      bag: 'Jawan / Kiish / Bac',
      backpack: 'Kiish / Jawan',
      book: 'Buug / Qalab',
      'cell phone': 'Taleefan / Qalab',
      scissors: 'Mindi / Maqas',
    };
    return map[className] || className.charAt(0).toUpperCase() + className.slice(1);
  }
}

export const detectionService = new ObjectDetectionService();
