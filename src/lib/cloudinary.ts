import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
});

export { cloudinary };

export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  publicId: string
): Promise<{ publicId: string; url: string }> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder, public_id: publicId, resource_type: "image" },
        (err, result) => {
          if (err || !result) return reject(err ?? new Error("Upload fallito"));
          resolve({ publicId: result.public_id, url: result.secure_url });
        }
      )
      .end(buffer);
  });
}

/** Indirizzo del logo aziendale: nel database c'è il public_id di Cloudinary. */
export function logoUrl(publicId: string | null | undefined, width = 560): string | null {
  if (!publicId) return null;
  if (/^https?:\/\//.test(publicId)) return publicId;
  return cloudinary.url(publicId, { fetch_format: "auto", quality: "auto", width, crop: "limit", secure: true });
}

export async function deleteCloudinaryAsset(publicId: string) {
  return cloudinary.uploader.destroy(publicId);
}

export async function deleteCloudinaryFolder(folder: string) {
  try {
    await cloudinary.api.delete_resources_by_prefix(folder);
    await cloudinary.api.delete_folder(folder).catch(() => {});
  } catch {
    // cartella già inesistente o vuota
  }
}

export function optimizedUrl(url: string, width = 800): string {
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
}
