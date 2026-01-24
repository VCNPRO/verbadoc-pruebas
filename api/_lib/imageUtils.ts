// @ts-nocheck
import sharp from 'sharp';
import { Region } from './types.js';

/**
 * Recorta una región específica de una imagen usando Sharp.
 * @param imageBase64 - La imagen completa en formato base64.
 * @param region - El objeto de región con coordenadas en porcentaje.
 * @returns Una promesa que se resuelve con la imagen recortada en formato base64.
 */
export const cropImage = async (
  imageBase64: string,
  region: Region
): Promise<string> => {
  try {
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('No se pudieron leer las dimensiones de la imagen.');
    }

    const realX = Math.floor((region.x / 100) * metadata.width);
    const realY = Math.floor((region.y / 100) * metadata.height);
    const realW = Math.floor((region.width / 100) * metadata.width);
    const realH = Math.floor((region.height / 100) * metadata.height);

    const croppedBuffer = await image
      .extract({ left: realX, top: realY, width: realW, height: realH })
      .toFormat('jpeg')
      .toBuffer();

    return croppedBuffer.toString('base64');
  } catch (error) {
    console.error(`Error al recortar la imagen para la región ${region.label}:`, error);
    throw error;
  }
};
