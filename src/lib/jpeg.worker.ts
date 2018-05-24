import { MozJpegEncoder } from './codec-wrappers/mozjpeg-enc';

// sharing an instance results in out of bounds memory access
// const encoder = new MozJpegEncoder();

export async function encode(data: ImageData, options: any) {
    const encoder = new MozJpegEncoder();
    const result = await encoder.encode(data, options);
    return result;
}
