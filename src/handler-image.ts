import { PhotonImage, resize, SamplingFilter, crop } from '@cf-wasm/photon';
// import decode, {init as initPngDecode } from '@jsquash/png/decode';
// import encode, { init as initWebpEncode } from '@jsquash/webp/encode';
// import PNG_DEC_WASM from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm';
// import WEBP_ENC_WASM from '@jsquash/webp/codec/enc/webp_enc.wasm';

import { HandlerInterface } from './handler';
import { Env, ImageParams, CacheParams, MIMEPair } from './types';


export default class ImageHandler implements HandlerInterface {

    private request: Request;
    private env: Env;
    private imageParams: ImageParams;

    private paramsAlias = {
        'preset': 'p',
    }

    // tiny | 50px | 50px | crop
    // thumb | 150px | 150px | crop
    // small | 300px | 300px | resize
    // medium | 500px | 500px | resize
    // large | 800px | 800px | resize
    private preset: {[key: string]: ImageParams} = {
        'tiny': {
            'w': 50,
            'h': 50,
            'icr': 1,
            'q': 80,
        },
        'thumb': {
            'w': 150,
            'h': 150,
            'icr': 1,
            'q': 80,
        },
        'small': {
            'w': 300,
            'h': 300,
            'q': 85,
        },
        'medium': {
            'w': 500,
            'h': 500,
            'q': 85,
        },
        'large': {
            'w': 800,
            'h': 800,
            'q': 90,
        },
    }

    imageParamsFilter = {
        'p': this.filterPreset,  // preset
        'w': this.filterSize,  // width 10~860
        'h': this.filterSize,  // height 10~860
        'q': this.filterQuality,  // quality 1~100, default 85
        'icr': this.filterBool, // is crop 1 or 0, default 0
        // 'izi': this.filterBool, // is zoom in 1 or 0, default 0
        // 'brt': null, // brightness -100~100, default 0
        // 'hue': null, // hue -100~100, default 0
        // 'co': null, // contrast -100~100, default 0
        // 'shp': null, // sharpening -100~100, default 0
        // 'flp': null, // flipping h, v, hv, n, default n
        // 'fmt': null, // format, jpeg, png, webp, default jpeg
    }

    public constructor(request: Request, env: Env) {
        this.request = request;
        this.env = env;
        this.imageParams = this.filterParams();
    }

    private filterParams(): ImageParams {
        const url = new URL(this.request.url);
        const params = new URLSearchParams(url.search);

        let imageParams: ImageParams = {};
        // Alias
        for (const [name, value] of params) {
            if (name in this.paramsAlias) {
                imageParams[this.paramsAlias[name]] = value;
            }
        }
        for (const [name, value] of params) {
            if (!(name in this.imageParamsFilter) || name in this.paramsAlias) continue;
            let paramValue = this.imageParamsFilter[name](value);
            imageParams[name] = paramValue;
        }
        // Preset
        if ('p' in imageParams && imageParams['p'] in this.preset) {
            imageParams = this.preset[imageParams['p']];
        }
        return imageParams;
    }

    public getCacheParams(): CacheParams {
        return this.imageParams;
    }

    public async handle(fetcherRequest: Request, fetcherResponse: Response): Promise<Uint8Array> {
        let image = await this.streamToUint8Array(fetcherResponse.body as ReadableStream<Uint8Array>);
        if (Object.keys(this.imageParams).length > 0) {
            let photonObj = PhotonImage.new_from_byteslice(image);

            // Resize
            if ('w' in this.imageParams || 'h' in this.imageParams) {
                // Width and height ratio
                const rawWidth = photonObj.get_width();
                const rawHeight = photonObj.get_height();
                const rawRatio = this.round(rawWidth / rawHeight, 2);

                let resizeWidth = rawWidth;
                let resizeHeight = rawHeight;
                let resizeRatio = rawRatio;
                // this.imageParams['icr'] && 
                if ('w' in this.imageParams && 'h' in this.imageParams) {
                    // If width and height all exist, calculate the difference between
                    // user input width and height ratio and the original ratio,
                    // then resize to redundant size, prepare to crop lately
                    resizeWidth = this.imageParams['w'];
                    resizeHeight = this.imageParams['h'];
                    resizeRatio = this.round(resizeWidth / resizeHeight, 2);
                    if ((this.imageParams['icr'] && rawRatio > resizeRatio)
                        || (!this.imageParams['icr'] && rawRatio < resizeRatio)) {
                        // If it only has width, calculate height with the width and ratio
                        resizeHeight = this.imageParams['h'];
                        resizeWidth = Math.round(resizeHeight * rawRatio);
                    } else if ((this.imageParams['icr'] && rawRatio < resizeRatio)
                        || (!this.imageParams['icr'] && rawRatio > resizeRatio)) {
                        // If it only has height, calculate width with the height and ratio
                        resizeWidth = this.imageParams['w'];
                        resizeHeight = Math.round(resizeWidth / rawRatio);
                    }
                } else if ('w' in this.imageParams && !('h' in this.imageParams)) {
                    resizeWidth = this.imageParams['w'];
                    this.imageParams['h'] = resizeHeight = Math.round(this.imageParams['w'] / rawRatio);
                } else if (!('w' in this.imageParams) && 'h' in this.imageParams) {
                    resizeHeight = this.imageParams['h'];
                    this.imageParams['w'] = resizeWidth = Math.round(this.imageParams['h'] * rawRatio);
                }

                if (resizeWidth != rawWidth || resizeHeight != rawHeight)
                    photonObj = await resize(photonObj, resizeWidth, resizeHeight, SamplingFilter.CatmullRom);

                if ('icr' in this.imageParams && this.imageParams['icr'] && rawRatio != resizeRatio) {
                    // Crop
                    let cropX1 = 0, cropY1 = 0, cropX2 = 0, cropY2 = 0;
                    if (rawRatio > resizeRatio) {
                        cropX1 = Math.round((resizeWidth - this.imageParams['w']) / 2);
                        cropY1 = 0;
                        cropX2 = resizeWidth - cropX1;
                        cropY2 = resizeHeight;
                    } else {
                        cropX1 = 0;
                        cropY1 = Math.round((resizeHeight - this.imageParams['h']) / 2);
                        cropX2 = resizeWidth;
                        cropY2 = resizeHeight - cropY1;
                    }
                    photonObj = await crop(photonObj, cropX1, cropY1, cropX2, cropY2);
                }
            }
            image = photonObj.get_bytes_jpeg(this.imageParams['q'] || 85);

            photonObj.free();

            // Quality
            // await initPngDecode(PNG_DEC_WASM);
            // const imageData = await decode(image);
            // await initWebpEncode(WEBP_ENC_WASM);
            // const imageBuffer = await encode(imageData, {});
            // image = new Uint8Array(imageBuffer);
        }
        return image;
    }

    public getMIME(): MIMEPair {
        return {ext: 'jpg', 'mime': 'image/jpeg'}
    }

    private async streamToUint8Array(readableStream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
        try {
            const reader = readableStream.getReader();
            const chunks: Uint8Array[] = [];
            let done: boolean | undefined;
            let value: Uint8Array | undefined;
    
            while ({ done, value } = await reader.read(), !done) {
                if (value) {
                    chunks.push(value);
                }
            }
            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const arrayBuffer = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                arrayBuffer.set(chunk, offset);
                offset += chunk.length;
            }
            return arrayBuffer;
        } catch (error) {
            console.error('Error converting stream to Uint8Array:', error);
            throw error;
        }
    }
    

    private filterSize(value: string): number {
        let parsedValue = parseInt(value, 10);
        parsedValue = Math.min(parsedValue, 6000);
        parsedValue = Math.max(parsedValue, 10);
        return parsedValue;
    }

    private filterPreset(value: string): string {
        return value;
    }

    private filterQuality(value: string): number {
        let parsedValue = parseInt(value, 10);
        if (parsedValue < 1 || parsedValue > 100) {
            parsedValue = 85
        }
        return parsedValue;
    }

    private filterBool(value: string): boolean {
        return Boolean(value == '1');
    }

    private round(num: number, decimals: number): number {
        const factor = Math.pow(10, decimals);
        return Math.round(num * factor) / factor;
    }
}