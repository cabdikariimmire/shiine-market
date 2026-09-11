import { BoundingBox, DetectionResult, ProductVariant } from '@/types';

export interface IDetectionModel {
  load(): Promise<void>;
  detect(videoOrCanvas: HTMLVideoElement | HTMLCanvasElement): Promise<Array<{
    class: string;
    score: number;
    bbox: [number, number, number, number]; // [x, y, width, height]
  }>>;
}

const CLASS_CONFIG: Record<string, { somaliName: string; keywords: string[]; units?: string[] }> = {
  bottle: {
    somaliName: 'Cabitaan / Biyo / Saliid (Bottle)',
    keywords: ['bottle', 'biyo', 'water', 'saliid', 'oil', 'cabitaan', 'juice', 'cola', 'pepsi', 'fanta', 'sprite', 'caag', 'shampoo', 'dettol', 'litir', 'ltr'],
    units: ['bottle', 'caag', 'litir', 'ltr', 'xabo', 'piece'],
  },
  box: {
    somaliName: 'Kartoon / Box Baakidh',
    keywords: ['box', 'kartoon', 'karton', 'carton', 'baakidh', 'biskit', 'macmacaan', 'saabuun', 'caano', 'tea', 'shaah', 'pack'],
    units: ['kartoon', 'karton', 'box', 'carton', 'baakidh', 'pack'],
  },
  bag: {
    somaliName: 'Jawan / Kiish / Bac',
    keywords: ['bag', 'jawan', 'kiish', 'bac', 'bariis', 'rice', 'sonkor', 'sugar', 'bur', 'flour', 'baasto', 'pasta', 'digir', 'beans'],
    units: ['jawan', 'kiish', 'bag', 'bac', 'kg'],
  },
  backpack: {
    somaliName: 'Jawan / Kiish / Bac',
    keywords: ['bag', 'jawan', 'kiish', 'bac', 'bariis', 'sonkor', 'bur', 'baasto'],
    units: ['jawan', 'kiish', 'bag', 'bac'],
  },
  banana: {
    somaliName: 'Moos Jaalle ah',
    keywords: ['banana', 'moos'],
    units: ['kg', 'xabo', 'piece'],
  },
  apple: {
    somaliName: 'Tufaax / Miro',
    keywords: ['apple', 'tufaax', 'miro'],
    units: ['kg', 'kartoon', 'xabo', 'piece'],
  },
  orange: {
    somaliName: 'Liin Macaan',
    keywords: ['orange', 'liin', 'liin macaan'],
    units: ['kg', 'kartoon', 'xabo', 'piece'],
  },
  broccoli: {
    somaliName: 'Qudaar Cagaaran',
    keywords: ['broccoli', 'qudaar', 'cagaar'],
    units: ['kg', 'baakidh'],
  },
  carrot: {
    somaliName: 'Karooto',
    keywords: ['carrot', 'karooto', 'qudaar'],
    units: ['kg', 'jawan', 'kiish'],
  },
  cup: {
    somaliName: 'Koob Cabitaan',
    keywords: ['cup', 'koob', 'bakeeri'],
    units: ['xabo', 'piece', 'baakidh'],
  },
  bowl: {
    somaliName: 'Bakeeri / Weel',
    keywords: ['bowl', 'bakeeri', 'weel'],
    units: ['xabo', 'piece', 'baakidh'],
  },
  book: {
    somaliName: 'Buug / Qalab',
    keywords: ['book', 'buug', 'daftar'],
    units: ['xabo', 'piece', 'baakidh'],
  },
  'cell phone': {
    somaliName: 'Taleefan / Qalab',
    keywords: ['phone', 'cell phone', 'taleefan', 'mobayl'],
    units: ['xabo', 'piece'],
  },
  scissors: {
    somaliName: 'Mindi / Maqas',
    keywords: ['scissors', 'mindi', 'maqas'],
    units: ['xabo', 'piece'],
  },
};

/**
 * Client-Side Object Detection Service
 * Performs on-device real-time visual analysis and packaging counting on video frames.
 * Safe for both Desktop and Mobile (Android Chrome / iOS Safari).
 */
export class ObjectDetectionService {
  private model: any = null;
  private isModelLoading: boolean = false;
  private modelLoaded: boolean = false;
  private offscreenCanvas: HTMLCanvasElement | null = null;

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
      console.log('[AI Detection] TensorFlow COCO-SSD model ready');
      return true;
    } catch (err) {
      console.warn('[AI Detection] TensorFlow model loading notice:', err);
      this.isModelLoading = false;
      return false;
    }
  }

  public isReady(): boolean {
    return this.modelLoaded;
  }

  /**
   * Analyzes the current video frame and groups detected items by type & count.
   * Extracts frame via 2D Canvas bitmap to prevent WebGL texture upload errors on mobile Android Chrome.
   */
  public async detectFrame(
    video: HTMLVideoElement,
    existingVariants: ProductVariant[]
  ): Promise<DetectionResult[]> {
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      return [];
    }

    if (!this.modelLoaded && !this.isModelLoading) {
      await this.initialize();
    }

    if (!this.modelLoaded || !this.model) {
      return [];
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    // Use offscreen 2D canvas for guaranteed cross-platform frame capture on mobile and desktop
    if (!this.offscreenCanvas && typeof document !== 'undefined') {
      this.offscreenCanvas = document.createElement('canvas');
    }

    let rawDetections: Array<{ class: string; score: number; bbox: [number, number, number, number] }> = [];

    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = width;
      this.offscreenCanvas.height = height;
      const ctx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
      
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        try {
          rawDetections = await this.model.detect(this.offscreenCanvas);
        } catch (e) {
          console.warn('[AI Detection] Canvas detection error, trying video fallback:', e);
          try {
            rawDetections = await this.model.detect(video);
          } catch (videoErr) {
            console.error('[AI Detection] Frame detection failed:', videoErr);
            return [];
          }
        }
      }
    } else {
      try {
        rawDetections = await this.model.detect(video);
      } catch (e) {
        console.error('[AI Detection] Direct video detection failed:', e);
        return [];
      }
    }

    if (!rawDetections || rawDetections.length === 0) {
      return [];
    }

    // Filter detections with at least 45% confidence
    const validDetections = rawDetections.filter(d => d.score >= 0.45);
    if (validDetections.length === 0) {
      return [];
    }

    // Group detections by class / product label
    const grouped = new Map<string, { count: number; maxConfidence: number; boxes: BoundingBox[] }>();

    for (const det of validDetections) {
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
      // Map vision class to supermarket product name & find registered variant
      const mappedName = this.mapVisionClassToSomaliProduct(className);
      const matched = this.matchWithDatabase(className, existingVariants);

      const displayName = matched?.product?.name 
        ? `${matched.product.name} (${matched.variant_name})`
        : mappedName;

      results.push({
        productId: matched?.product_id,
        variantId: matched?.id,
        productName: displayName,
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
   * Matches detected visual tags with existing registered shop product variants
   */
  private matchWithDatabase(
    visionClass: string,
    variants: ProductVariant[]
  ): ProductVariant | undefined {
    if (!variants || variants.length === 0) return undefined;

    const classKey = visionClass.toLowerCase().trim();
    const config = CLASS_CONFIG[classKey];
    const searchTokens = config ? config.keywords : [classKey];
    const targetUnits = config?.units || [];

    // 1. Direct name or category keyword match
    for (const v of variants) {
      const pName = (v.product?.name || '').toLowerCase();
      const vName = (v.variant_name || '').toLowerCase();
      const catName = (v.product?.category?.name || '').toLowerCase();

      for (const token of searchTokens) {
        if (pName.includes(token) || vName.includes(token) || catName.includes(token)) {
          return v;
        }
      }
    }

    // 2. Unit match (e.g. jawan for bag, kartoon for box, bottle for bottle)
    if (targetUnits.length > 0) {
      for (const v of variants) {
        const pUnit = (v.purchase_unit || '').toLowerCase();
        const sUnit = (v.selling_unit || '').toLowerCase();
        if (targetUnits.includes(pUnit) || targetUnits.includes(sUnit)) {
          return v;
        }
      }
    }

    // 3. Description match
    for (const v of variants) {
      const desc = (v.product?.description || '').toLowerCase();
      for (const token of searchTokens) {
        if (desc.includes(token)) {
          return v;
        }
      }
    }

    return undefined;
  }

  /**
   * Translates standard vision classes to retail supermarket packaging & items
   */
  private mapVisionClassToSomaliProduct(className: string): string {
    const classKey = className.toLowerCase();
    return CLASS_CONFIG[classKey]?.somaliName || className.charAt(0).toUpperCase() + className.slice(1);
  }
}

export const detectionService = new ObjectDetectionService();

