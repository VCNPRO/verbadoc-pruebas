// @ts-nocheck
/**
 * Endpoint de diagnóstico temporal para verificar dependencias del extractor híbrido.
 * ELIMINAR después de resolver el problema.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const diagnostics: Record<string, any> = {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  };

  // Test 1: @napi-rs/canvas
  try {
    const { createCanvas } = require('@napi-rs/canvas');
    const canvas = createCanvas(10, 10);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 10, 10);
    const buf = canvas.toBuffer('image/png');
    diagnostics.napiCanvas = { status: 'OK', pngBytes: buf.length };
  } catch (e: any) {
    diagnostics.napiCanvas = { status: 'FAIL', error: e.message };
  }

  // Test 2: pdfjs-serverless
  try {
    const { getDocument } = require('pdfjs-serverless');
    diagnostics.pdfjsServerless = { status: 'OK', getDocument: typeof getDocument };
  } catch (e: any) {
    diagnostics.pdfjsServerless = { status: 'FAIL', error: e.message };
  }

  // Test 3: sharp
  try {
    const sharp = require('sharp');
    const meta = await sharp(Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,207,192,0,0,0,2,0,1,226,33,188,51,0,0,0,0,73,69,78,68,174,66,96,130])).metadata();
    diagnostics.sharp = { status: 'OK', format: meta.format };
  } catch (e: any) {
    diagnostics.sharp = { status: 'FAIL', error: e.message };
  }

  return res.status(200).json(diagnostics);
}
