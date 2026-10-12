/** What the API records about an image besides what the media store reports. */
export interface ImageInfo {
    width: number;
    height: number;
    /** An animated WebP. */
    animated: boolean;
}

/** Reads [file]'s size (of its first frame) and whether it's an animated WebP. */
export async function readImageInfo(file: File): Promise<ImageInfo> {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    return { width, height, animated: file.type === "image/webp" && isAnimatedWebp(new Uint8Array(await file.slice(0, 21).arrayBuffer())) };
}

/**
 * An extended WebP ("RIFF" size "WEBP" "VP8X" size flags) with the animation flag set.
 * See https://developers.google.com/speed/webp/docs/riff_container#extended_file_format
 */
function isAnimatedWebp(header: Uint8Array): boolean {
    const text = (from: number, to: number) => String.fromCharCode(...header.subarray(from, to));
    return header.length >= 21 && text(0, 4) === "RIFF" && text(8, 12) === "WEBP" && text(12, 16) === "VP8X"
        && (header[20] & 0x02) !== 0;
}
