/** The museum shop's catalogue. Purchases happen on shop.artic.edu. */
import { z } from "zod";
import type { TextRun } from "@/lib/artwork/types";
import { aicGet } from "./client";
import { REVALIDATE_REFERENCE } from "./config";
import { plainTitle } from "./museum";
import {
  articUrl,
  imgixUrl,
  listField,
  LIST_SIZE,
  parseCopy,
  readRecord,
  textField,
  toRecordPage,
} from "./records";
import type { RecordPage } from "./records";

const price = z.number().nullish().catch(null);

const rawProduct = z.object({
  id: z.number().int().positive(),
  title: textField,
  image_url: textField,
  web_url: textField,
  description: textField,
  min_current_price: price,
  max_current_price: price,
  min_compare_at_price: price,
  artwork_ids: listField,
});

const FIELDS =
  "id,title,image_url,web_url,description,min_current_price,max_current_price,min_compare_at_price,artwork_ids";

export interface Product {
  id: number;
  title: string;
  image: string | null;
  largeImage: string | null;
  url: string;
  description: TextRun[][] | null;
  /** US dollars. */
  price: { from: number; to: number; was: number | null } | null;
  artworkIds: number[];
}

export function toProduct(raw: z.infer<typeof rawProduct>): Product | null {
  const title = plainTitle(raw.title, 200);
  if (!title) return null;
  const from = raw.min_current_price;
  const was = raw.min_compare_at_price;
  return {
    id: raw.id,
    title,
    image: imgixUrl(raw.image_url, 640),
    largeImage: imgixUrl(raw.image_url, 1200),
    url: articUrl(raw.web_url) ?? `https://shop.artic.edu/products/${raw.id}`,
    description: parseCopy(raw.description),
    price:
      typeof from === "number" && from > 0
        ? {
            from,
            to: raw.max_current_price ?? from,
            was: typeof was === "number" && was > from ? was : null,
          }
        : null,
    artworkIds: (raw.artwork_ids ?? []).filter(
      (id): id is number => Number.isInteger(id) && (id as number) > 0,
    ),
  };
}

/** The shop's search index is empty upstream, so the catalogue is paged through in order. */
export async function getProducts(page: number): Promise<RecordPage<Product>> {
  const json = await aicGet(
    `/products?limit=${LIST_SIZE}&page=${page}&fields=${FIELDS}`,
    { revalidate: REVALIDATE_REFERENCE },
  );
  const result = toRecordPage(json, rawProduct, LIST_SIZE, page);
  return {
    ...result,
    totalPages: Math.ceil(result.total / LIST_SIZE),
    items: result.items.flatMap((raw) => {
      const product = toProduct(raw);
      return product ? [product] : [];
    }),
  };
}

export async function getProduct(id: number): Promise<Product | null> {
  const raw = await readRecord(`/products/${id}?fields=${FIELDS}`, rawProduct);
  return raw ? toProduct(raw) : null;
}
