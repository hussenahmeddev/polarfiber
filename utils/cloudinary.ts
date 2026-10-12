import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env["CLOUDINARY_CLOUD_NAME"] || "dpvj4h8fc",
  api_key: process.env["CLOUDINARY_API_KEY"] || "558227119878479",
  api_secret: process.env["CLOUDINARY_API_SECRET"] || "E3FCvElwRBbsufFYI-bGRS38TbA",
});

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export async function uploadToCloudinary(
  file: string,
  folder: string = "polarfiber/products",
): Promise<CloudinaryUploadResult> {
  const result = await cloudinary.uploader.upload(file, {
    folder,
    resource_type: "image",
    transformation: [
      { quality: "auto", fetch_format: "auto" },
      { width: 1200, height: 1200, crop: "limit" },
    ],
  });
  return {
    public_id: result.public_id,
    secure_url: result.secure_url,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
  };
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}

export function getCloudinaryUrl(
  publicId: string,
  options: { width?: number; height?: number; crop?: string } = {},
): string {
  return cloudinary.url(publicId, {
    secure: true,
    ...options,
  });
}
