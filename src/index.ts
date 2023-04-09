/**
 * - https://en.wikipedia.org/wiki/Truevision_TGA
 * - https://www.fileformat.info/format/tga/egff.htm
 *
 * Attentions:
 * - The TGA file format is little-endian.
 */

/**
 * total size: 18 bytes
 */
interface TgaHeader {
  // byte 0
  // size of the image id field
  idLength: number;

  // byte 1
  // color map type
  // 0: no color map included
  // 1: a color map is included
  // 0-127: reserved by Truevision
  // 128-255: available for developer use
  colorMapType: number;

  // byte 2
  // image type code
  // 0: no image data included
  // 1: uncompressed, color-mapped image
  // 2: uncompressed, true-color image
  // 3: uncompressed, grey image
  // 9: run-length encoded, color-mapped image
  // 10: run-length encoded, true-color image
  // 11: run-length encoded, grey image
  // 0-127: reserved by Truevision
  // 128-255: available for developer use
  imageType: number;

  /**
   * bytes 3-7
   * color map specification
   * If the color map type field is set to zero,
   * indicating that no color map exists,
   * then these 5 bytes should be set to zero.
   */

  // bytes 4-3
  // first color map entry index
  colorMapStart: number;
  // bytes 6-5
  // total number of color map entries
  colorMapLength: number;
  // byte 7
  // bits per color map entry
  // 15, 16: 5 bits for each primary color
  //         with 1 attribute bit.
  // 24: 8 bits for each primary color
  // 32: 8 bits for each primary color and alpha channel
  colorMapEntryDepth: number;

  /**
   * bytes 8-17
   * image specification
   */

  // bytes 9-8
  // x origin of the image
  xOrigin: number;
  // bytes 11-10
  // y origin of the image
  yOrigin: number;
  // bytes 13-12
  // width of the image
  width: number;
  // bytes 15-14
  // height of the image
  height: number;
  // byte 16
  // bits per pixel - 8, 16, 24, 32
  pixelDepth: number;
  // byte 17
  // image descriptor
  // bits 3-0: alpha channel depth
  // bits 5-4: pixel ordering
  //           00: left-to-right, top-to-bottom
  //           01: left-to-right, bottom-to-top
  //           10: right-to-left, top-to-bottom
  //           11: right-to-left, bottom-to-top
  // bits 7-6: reserved, must be zero
  descriptor: number;
}

interface TgaInfo extends TgaHeader {
  // is color mappped image
  isIndexed: boolean;
  // is monochrome image
  isGrey: boolean;
  // is run-length encoded image
  isRle: boolean;
  // bytes per pixel
  pixelSize: number;
  // number of color map entries
  pixelCount: number;
  // bytes per color map entry
  colorMapEntrySize: number;
  // bits of alpha channel
  alphaDepth: number;
}

const IMAGE_TYPE = {
  // 0: no image data included
  NO_DATA: /*******/ 0b00000000,
  // 1: uncompressed, color-mapped image
  INDEXED: /*******/ 0b00000001,
  // 2: uncompressed, true-color image
  RGB: /***********/ 0b00000010,
  // 3: uncompressed, grey image
  GREY: /**********/ 0b00000011,
  // 9: run-length encoded, color-mapped image
  RLE_INDEXED: /***/ 0b00001001,
  // 10: run-length encoded, true-color image
  RLE_RGB: /*******/ 0b00001010,
  // 11: run-length encoded, grey image
  RLE_GREY: /******/ 0b00001011,
};

interface Pointer {
  value: number;
}

/**
 * fetch tga file and parse it
 */
export function openTgaFile(url: string) {
  return fetch(url)
    .then((response) => response.arrayBuffer())
    .then((buffer) => parseTgaData(new Uint8Array(buffer)));
}

/**
 * parse tga file raw data
 */
export function parseTgaData(data: Uint8Array) {
  const pointer: Pointer = { value: 0 };
  const header = readHeader(data, pointer);
  const info = createTgaInfo(header);
  // skip image id
  pointer.value += header.idLength;
  const colorMap = readColorMap(data, info, pointer);
  const rawImageData = readImageData(data, info, pointer);
  const displayData = parseImageData(info, rawImageData, colorMap);
  return {
    imageData: displayData,
    width: info.width,
    height: info.height,
  };
}

/**
 * read header
 */
function readHeader(data: Uint8Array, pointer: Pointer): TgaHeader {
  const header = {
    idLength: readItem(data, pointer),
    colorMapType: readItem(data, pointer),
    imageType: readItem(data, pointer),
    colorMapStart: readItem(data, pointer, 2),
    colorMapLength: readItem(data, pointer, 2),
    colorMapEntryDepth: readItem(data, pointer),
    xOrigin: readItem(data, pointer, 2),
    yOrigin: readItem(data, pointer, 2),
    width: readItem(data, pointer, 2),
    height: readItem(data, pointer, 2),
    pixelDepth: readItem(data, pointer),
    descriptor: readItem(data, pointer),
  };
  if (header.colorMapEntryDepth === 15) {
    header.colorMapEntryDepth = 16;
  }
  return header;
}

/**
 * create TgaInfo from TgaHeader
 */
function createTgaInfo(header: TgaHeader): TgaInfo {
  return {
    ...header,
    isIndexed: header.imageType === 1 || header.imageType === 9,
    isGrey: !!(header.imageType & IMAGE_TYPE.GREY),
    isRle: !!(header.imageType >> 3),
    pixelSize: header.pixelDepth >> 3,
    pixelCount: header.width * header.height,
    colorMapEntrySize: header.colorMapEntryDepth >> 3,
    alphaDepth: header.descriptor & 0b00001111,
  };
}

/**
 * Read data item from raw data.
 * Note that the data items are stored in little-endian order.
 */
function readItem(
  data: Uint8Array,
  pointer: Pointer,
  length: number = 1,
): number {
  const start = pointer.value;
  const end = start + length;
  if (end > data.length) {
    throw new Error(`No enough data to read from ${start} to ${end}.`);
  }
  let result = 0;
  for (let i = end - 1; i >= start; i--) {
    result = (result << 8) | data[i];
  }
  pointer.value = end;
  return result;
}

/**
 * read color map data
 */
function readColorMap(
  data: Uint8Array,
  info: TgaInfo,
  pointer: Pointer,
): Uint8Array | null {
  if (!info.colorMapType) {
    return null;
  }
  const entrySize = info.colorMapEntryDepth >> 3;
  const byteCount = info.colorMapLength * entrySize;
  return data.subarray(pointer.value, (pointer.value += byteCount));
}

/**
 * read image data, decode it if it's a run-length encoded image
 */
function readImageData(data: Uint8Array, info: TgaInfo, pointer: Pointer) {
  const { pixelSize, pixelCount: totalPixelCount, isRle } = info;
  const totalByteCount = totalPixelCount * pixelSize;
  // if it's not a run-length encoded image, just read the data
  if (!isRle) {
    return data.subarray(pointer.value, (pointer.value += totalByteCount));
  }
  // store decoded image data
  const result = new Uint8Array(totalByteCount);
  // current position in the result
  let current = 0;
  // fill the result
  while (current < totalByteCount) {
    // read packet header
    const header = data[pointer.value++];
    // bit 7: packet type, 0 for raw, 1 for RLE
    const type = (header & 0b10000000) >> 7;
    // bits 0-6: the number of pixels in the packet
    const pixelCount = (header & 0b01111111) + 1;
    // RLE packet
    if (type === 1) {
      // get the repeated pixel
      const pixel = data.subarray(pointer.value, (pointer.value += pixelSize));
      // copy pixels
      for (let i = 0; i < pixelCount; i++) {
        result.set(pixel, current);
        current += pixelSize;
      }
    } else {
      const byteCount = pixelCount * pixelSize;
      // copy bytes
      for (let i = 0; i < byteCount; i += 1) {
        result[current++] = data[pointer.value++];
      }
    }
  }
  return result;
}

/**
 * parse image data and return image display data
 */
function parseImageData(
  info: TgaInfo,
  imageData: Uint8Array,
  colorMap: Uint8Array | null,
): Uint8ClampedArray {
  const { pixelCount } = info;
  const displayData = new Uint8ClampedArray(pixelCount * 4);

  for (let i = 0; i < pixelCount; i++) {
    const pixel = getPixel(info, imageData, colorMap, i);
    const start = i * 4;
    displayData[start] = pixel[0];
    displayData[start + 1] = pixel[1];
    displayData[start + 2] = pixel[2];
    displayData[start + 3] = pixel[3];
  }

  return displayData;
}

/**
 * get pixel color from image data
 */
function getPixel(
  info: TgaInfo,
  imageData: Uint8Array,
  colorMap: Uint8Array | null,
  index: number,
) {
  const { pixelSize, isIndexed, isGrey, alphaDepth } = info;
  const start = index * pixelSize;
  const entry = imageData.subarray(start, start + pixelSize);
  switch (pixelSize) {
    case 1:
      if (isIndexed) {
        return getColorMapPixel(info, colorMap!, entry[0]);
      } else if (isGrey) {
        return getColorFrom1ByteEntry(entry);
      } else {
        throw new Error(
          `Unsupported pixel size: ${pixelSize} for true-color image.`,
        );
      }
    case 2:
      if (isIndexed) {
        const word = (entry[1] << 8) | entry[0];
        return getColorMapPixel(info, colorMap!, word);
      } else if (isGrey) {
        return getGreyColorFrom2ByteEntry(entry, alphaDepth);
      } else {
        return getColorFrom2ByteEntry(entry);
      }
    case 3:
      return getColorFrom3ByteEntry(entry);
    case 4:
      return getColorFrom4ByteEntry(entry, alphaDepth);
    default:
      throw new Error(`Unsupported pixel size: ${pixelSize}.`);
  }
}

/**
 * get pixel color from color map
 */
function getColorMapPixel(info: TgaInfo, colorMap: Uint8Array, index: number) {
  const { colorMapEntrySize, alphaDepth } = info;
  const start = index * colorMapEntrySize;
  const entry = colorMap.subarray(start, start + colorMapEntrySize);
  switch (colorMapEntrySize) {
    case 2:
      return getColorFrom2ByteEntry(entry);
    case 3:
      return getColorFrom3ByteEntry(entry);
    case 4:
      return getColorFrom4ByteEntry(entry, alphaDepth);
    default:
      throw new Error(
        `Unsupported color map entry size: ${colorMapEntrySize}.`,
      );
  }
}

/**
 * get RGBA color from 1-byte entry
 */
function getColorFrom1ByteEntry(entry: Uint8Array) {
  return [entry[0], entry[0], entry[0], 255];
}

/**
 * get RGBA color from 2-byte entry
 */
function getColorFrom2ByteEntry(entry: Uint8Array) {
  const value = (entry[1] << 8) | entry[0];
  const r = (value & 0b0111110000000000) >> 10;
  const g = (value & 0b0000001111100000) >> 5;
  const b = (value & 0b0000000000011111) >> 0;
  return [
    // transform 5-bit to 8-bit
    (r << 3) | (r >> 2),
    (g << 3) | (g >> 2),
    (b << 3) | (b >> 2),
    255,
  ];
}

/**
 * get grey color with RGBA format from 2-byte entry
 */
function getGreyColorFrom2ByteEntry(entry: Uint8Array, alphaDepth: number) {
  return [entry[0], entry[0], entry[0], alphaDepth === 8 ? entry[1] : 255];
}

/**
 * get RGBA color from 3-byte entry
 */
function getColorFrom3ByteEntry(entry: Uint8Array) {
  return [entry[2], entry[1], entry[0], 255];
}

/**
 * get RGBA color from 4-byte entry
 */
function getColorFrom4ByteEntry(entry: Uint8Array, alphaDepth: number) {
  const alpha = alphaDepth === 8 ? entry[3] : 255;
  return [entry[2], entry[1], entry[0], alpha];
}
