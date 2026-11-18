/**
 * PREVIEW FIXTURE. A snapshot of 12 public-domain artworks taken from the
 * Art Institute of Chicago API on 2026-11-18 (GET /artworks?ids=...). Metadata is CC0;
 * images are hotlinked from the AIC IIIF server and are not stored in this repo.
 *
 * Used only to lay out pages before the live API integration (Phase 2). Any UI that
 * renders this data must say it is a preview snapshot.
 */
import type { Artwork } from "@/lib/artwork/types";

export const PREVIEW_FIXTURE_DATE = "2026-11-18";

export const previewArtworks: readonly Artwork[] = [
  {
    "id": 27992,
    "title": "A Sunday on La Grande Jatte — 1884",
    "artist": "Georges Seurat",
    "dateDisplay": "1884–86, border added 1888–89",
    "type": "Painting",
    "medium": "Oil on canvas",
    "dimensions": "207.5 × 308.1 cm (81 3/4 × 121 1/4 in.)",
    "origin": "France",
    "creditLine": "Helen Birch Bartlett Memorial Collection",
    "image": {
      "src": "https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f9981972eb/full/843,/0/default.jpg",
      "srcSet": "https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f9981972eb/full/400,/0/default.jpg 400w, https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f9981972eb/full/600,/0/default.jpg 600w, https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f9981972eb/full/843,/0/default.jpg 843w, https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f9981972eb/full/1200,/0/default.jpg 1200w",
      "aspectRatio": 1.4927,
      "alt": "Large painting of people in a crowded park, brushstrokes are dots."
    },
    "sourceUrl": "https://www.artic.edu/artworks/27992",
    "isPublicDomain": true
  },
  {
    "id": 20684,
    "title": "Paris Street; Rainy Day",
    "artist": "Gustave Caillebotte",
    "dateDisplay": "1877",
    "type": "Painting",
    "medium": "Oil on canvas",
    "dimensions": "212.2 × 276.2 cm (83 1/2 × 108 3/4 in.); Framed: 241.3 × 306.1 × 10.2 cm (95 × 120 1/2 × 4 in.)",
    "origin": "Paris",
    "creditLine": "Charles H. and Mary F. S. Worcester Collection",
    "image": {
      "src": "https://www.artic.edu/iiif/2/f8fd76e9-c396-5678-36ed-6a348c904d27/full/843,/0/default.jpg",
      "srcSet": "https://www.artic.edu/iiif/2/f8fd76e9-c396-5678-36ed-6a348c904d27/full/400,/0/default.jpg 400w, https://www.artic.edu/iiif/2/f8fd76e9-c396-5678-36ed-6a348c904d27/full/600,/0/default.jpg 600w, https://www.artic.edu/iiif/2/f8fd76e9-c396-5678-36ed-6a348c904d27/full/843,/0/default.jpg 843w, https://www.artic.edu/iiif/2/f8fd76e9-c396-5678-36ed-6a348c904d27/full/1200,/0/default.jpg 1200w",
      "aspectRatio": 1.2878,
      "alt": "Life-size painting of an urban scene in Paris. A man in a top hat holding an umbrella and a woman in a long fashionable dark dress walk arm in arm toward the viewer as other city dwellers with umbrellas walk in various directions across cobblestone roads and sidewalks."
    },
    "sourceUrl": "https://www.artic.edu/artworks/20684",
    "isPublicDomain": true
  },
  {
    "id": 28560,
    "title": "The Bedroom",
    "artist": "Vincent van Gogh",
    "dateDisplay": "1889",
    "type": "Painting",
    "medium": "Oil on canvas",
    "dimensions": "73.6 × 92.3 cm (29 × 36 5/8 in.); Framed: 88.9 × 108 × 8.9 cm (35 × 42 1/2 × 3 1/2 in.)",
    "origin": "Saint-Rémy-de-Provence",
    "creditLine": "Helen Birch Bartlett Memorial Collection",
    "image": {
      "src": "https://www.artic.edu/iiif/2/6644829f-f292-c5c4-a73c-0356a6fdbf0d/full/843,/0/default.jpg",
      "srcSet": "https://www.artic.edu/iiif/2/6644829f-f292-c5c4-a73c-0356a6fdbf0d/full/400,/0/default.jpg 400w, https://www.artic.edu/iiif/2/6644829f-f292-c5c4-a73c-0356a6fdbf0d/full/600,/0/default.jpg 600w, https://www.artic.edu/iiif/2/6644829f-f292-c5c4-a73c-0356a6fdbf0d/full/843,/0/default.jpg 843w, https://www.artic.edu/iiif/2/6644829f-f292-c5c4-a73c-0356a6fdbf0d/full/1200,/0/default.jpg 1200w",
      "aspectRatio": 1.2774,
      "alt": "Painting of bedroom, blue walls, green window, tan bed, red bedding."
    },
    "sourceUrl": "https://www.artic.edu/artworks/28560",
    "isPublicDomain": true
  },
  {
    "id": 16568,
    "title": "Water Lilies",
    "artist": "Claude Monet",
    "dateDisplay": "1906",
    "type": "Painting",
    "medium": "Oil on canvas",
    "dimensions": "89.9 × 94.1 cm (35 3/8 × 37 1/16 in.); Framed: 103.2 × 107 × 5.8 cm (40 5/8 × 42 1/8 × 2 1/4 in.)",
    "origin": "France",
    "creditLine": "Mr. and Mrs. Martin A. Ryerson Collection",
    "image": {
      "src": "https://www.artic.edu/iiif/2/3c27b499-af56-f0d5-93b5-a7f2f1ad5813/full/843,/0/default.jpg",
      "srcSet": "https://www.artic.edu/iiif/2/3c27b499-af56-f0d5-93b5-a7f2f1ad5813/full/400,/0/default.jpg 400w, https://www.artic.edu/iiif/2/3c27b499-af56-f0d5-93b5-a7f2f1ad5813/full/600,/0/default.jpg 600w, https://www.artic.edu/iiif/2/3c27b499-af56-f0d5-93b5-a7f2f1ad5813/full/843,/0/default.jpg 843w, https://www.artic.edu/iiif/2/3c27b499-af56-f0d5-93b5-a7f2f1ad5813/full/1200,/0/default.jpg 1200w",
      "aspectRatio": 1.0411,
      "alt": "Painting of a pond seen up close spotted with thickly painted pink and white water lilies and a shadow across the top third of the picture."
    },
    "sourceUrl": "https://www.artic.edu/artworks/16568",
    "isPublicDomain": true
  },
  {
    "id": 64818,
    "title": "Stacks of Wheat (End of Summer)",
    "artist": "Claude Monet",
    "dateDisplay": "1890–91",
    "type": "Painting",
    "medium": "Oil on canvas",
    "dimensions": "60 × 100.5 cm (23 5/8 × 39 9/16 in.); Framed: 75.6 × 116.6 × 7.4 cm (29 3/4 × 45 7/8 × 2 7/8 in.)",
    "origin": "France",
    "creditLine": "Gift of Arthur M. Wood, Sr. in memory of Pauline Palmer Wood",
    "image": {
      "src": "https://www.artic.edu/iiif/2/a38e2828-ec6f-ece1-a30f-70243449197b/full/843,/0/default.jpg",
      "srcSet": "https://www.artic.edu/iiif/2/a38e2828-ec6f-ece1-a30f-70243449197b/full/400,/0/default.jpg 400w, https://www.artic.edu/iiif/2/a38e2828-ec6f-ece1-a30f-70243449197b/full/600,/0/default.jpg 600w, https://www.artic.edu/iiif/2/a38e2828-ec6f-ece1-a30f-70243449197b/full/843,/0/default.jpg 843w, https://www.artic.edu/iiif/2/a38e2828-ec6f-ece1-a30f-70243449197b/full/1200,/0/default.jpg 1200w",
      "aspectRatio": 1.6922,
      "alt": "Painting composed of short, dense brushstrokes depicts two domed stacks of wheat that cast long shadows on a field. The angled light indicates either a rising or setting sun."
    },
    "sourceUrl": "https://www.artic.edu/artworks/64818",
    "isPublicDomain": true
  },
  {
    "id": 14655,
    "title": "Two Sisters (On the Terrace)",
    "artist": "Pierre-Auguste Renoir",
    "dateDisplay": "1881",
    "type": "Painting",
    "medium": "Oil on canvas",
    "dimensions": "100.4 × 80.9 cm (39 1/2 × 31 7/8 in.); Framed: 119.1 × 100.1 × 9.6 cm (46 7/8 × 39 3/8 × 3 3/4 in.)",
    "origin": "France",
    "creditLine": "Mr. and Mrs. Lewis Larned Coburn Memorial Collection",
    "image": {
      "src": "https://www.artic.edu/iiif/2/3a608f55-d76e-fa96-d0b1-0789fbc48f1e/full/843,/0/default.jpg",
      "srcSet": "https://www.artic.edu/iiif/2/3a608f55-d76e-fa96-d0b1-0789fbc48f1e/full/400,/0/default.jpg 400w, https://www.artic.edu/iiif/2/3a608f55-d76e-fa96-d0b1-0789fbc48f1e/full/600,/0/default.jpg 600w, https://www.artic.edu/iiif/2/3a608f55-d76e-fa96-d0b1-0789fbc48f1e/full/843,/0/default.jpg 843w, https://www.artic.edu/iiif/2/3a608f55-d76e-fa96-d0b1-0789fbc48f1e/full/1200,/0/default.jpg 1200w",
      "aspectRatio": 0.8059,
      "alt": "Impressionist painting of two girls on balcony, bright flower hat, knitting basket."
    },
    "sourceUrl": "https://www.artic.edu/artworks/14655",
    "isPublicDomain": true
  },
  {
    "id": 111436,
    "title": "The Basket of Apples",
    "artist": "Paul Cezanne",
    "dateDisplay": "c. 1893",
    "type": "Painting",
    "medium": "Oil on canvas",
    "dimensions": "65 × 80 cm (25 7/16 × 31 1/2 in.); Framed: 88 × 104.2 × 9.6 cm (34 5/8 × 41 × 3 3/4 in.)",
    "origin": "France",
    "creditLine": "Helen Birch Bartlett Memorial Collection",
    "image": {
      "src": "https://www.artic.edu/iiif/2/52ac8996-3460-cf71-cb42-5c4d0aa29b74/full/843,/0/default.jpg",
      "srcSet": "https://www.artic.edu/iiif/2/52ac8996-3460-cf71-cb42-5c4d0aa29b74/full/400,/0/default.jpg 400w, https://www.artic.edu/iiif/2/52ac8996-3460-cf71-cb42-5c4d0aa29b74/full/600,/0/default.jpg 600w, https://www.artic.edu/iiif/2/52ac8996-3460-cf71-cb42-5c4d0aa29b74/full/843,/0/default.jpg 843w, https://www.artic.edu/iiif/2/52ac8996-3460-cf71-cb42-5c4d0aa29b74/full/1200,/0/default.jpg 1200w",
      "aspectRatio": 1.2522,
      "alt": "Painting of a basket of green and red-yellow apples spilling over into a white cloth placed on a wooden table, with a dark green bottle and a plate of pale biscuits behind."
    },
    "sourceUrl": "https://www.artic.edu/artworks/111436",
    "isPublicDomain": true
  },
  {
    "id": 80607,
    "title": "Self-Portrait",
    "artist": "Vincent van Gogh",
    "dateDisplay": "1887",
    "type": "Painting",
    "medium": "Oil on artist's board, mounted on cradled panel",
    "dimensions": "41 × 32.5 cm (16 1/8 × 12 13/16 in.); Framed: 61.6 × 53.4 × 8.9 cm (24 1/4 × 21 × 3 1/2 in.)",
    "origin": "Netherlands",
    "creditLine": "Joseph Winterbotham Collection",
    "image": {
      "src": "https://www.artic.edu/iiif/2/47c5bcb8-62ef-e5d7-55e7-f5121f409a30/full/843,/0/default.jpg",
      "srcSet": "https://www.artic.edu/iiif/2/47c5bcb8-62ef-e5d7-55e7-f5121f409a30/full/400,/0/default.jpg 400w, https://www.artic.edu/iiif/2/47c5bcb8-62ef-e5d7-55e7-f5121f409a30/full/600,/0/default.jpg 600w, https://www.artic.edu/iiif/2/47c5bcb8-62ef-e5d7-55e7-f5121f409a30/full/843,/0/default.jpg 843w, https://www.artic.edu/iiif/2/47c5bcb8-62ef-e5d7-55e7-f5121f409a30/full/1200,/0/default.jpg 1200w",
      "aspectRatio": 0.7847,
      "alt": "Painting of a red-haired, bearded man with light skin, painted in short brushstrokes and multicolored dots. The background is likewise a mass of small, closely spaced colored dots, these in green, blue, and red-orange."
    },
    "sourceUrl": "https://www.artic.edu/artworks/80607",
    "isPublicDomain": true
  },
  {
    "id": 24645,
    "title": "Under the Wave off Kanagawa (Kanagawa oki nami ura), also known as The Great Wave, from the series \"Thirty-Six Views of Mount Fuji (Fugaku sanjūrokkei)\"",
    "artist": "Katsushika Hokusai",
    "dateDisplay": "1830/33",
    "type": "Print",
    "medium": "Color woodblock print; oban",
    "dimensions": "25.4 × 37.6 cm (10 × 14 3/4 in.)",
    "origin": "Japan",
    "creditLine": "Clarence Buckingham Collection",
    "image": {
      "src": "https://www.artic.edu/iiif/2/b3974542-b9b4-7568-fc4b-966738f61d78/full/843,/0/default.jpg",
      "srcSet": "https://www.artic.edu/iiif/2/b3974542-b9b4-7568-fc4b-966738f61d78/full/400,/0/default.jpg 400w, https://www.artic.edu/iiif/2/b3974542-b9b4-7568-fc4b-966738f61d78/full/600,/0/default.jpg 600w, https://www.artic.edu/iiif/2/b3974542-b9b4-7568-fc4b-966738f61d78/full/843,/0/default.jpg 843w, https://www.artic.edu/iiif/2/b3974542-b9b4-7568-fc4b-966738f61d78/full/1200,/0/default.jpg 1200w",
      "aspectRatio": 1.4593,
      "alt": "A crashing wave looms over two small ships, Mount Fuji in the background."
    },
    "sourceUrl": "https://www.artic.edu/artworks/24645",
    "isPublicDomain": true
  },
  {
    "id": 16571,
    "title": "Arrival of the Normandy Train, Gare Saint-Lazare",
    "artist": "Claude Monet",
    "dateDisplay": "1877",
    "type": "Painting",
    "medium": "Oil on canvas",
    "dimensions": "60.3 × 80.2 cm (23 3/4 × 31 1/2 in.); Framed: 80.7 × 100.4 × 10.2 cm (31 3/4 × 39 1/2 × 4 in.)",
    "origin": "France",
    "creditLine": "Mr. and Mrs. Martin A. Ryerson Collection",
    "image": {
      "src": "https://www.artic.edu/iiif/2/0f1cc0e0-e42e-be16-3f71-2022da38cb93/full/843,/0/default.jpg",
      "srcSet": "https://www.artic.edu/iiif/2/0f1cc0e0-e42e-be16-3f71-2022da38cb93/full/400,/0/default.jpg 400w, https://www.artic.edu/iiif/2/0f1cc0e0-e42e-be16-3f71-2022da38cb93/full/600,/0/default.jpg 600w, https://www.artic.edu/iiif/2/0f1cc0e0-e42e-be16-3f71-2022da38cb93/full/843,/0/default.jpg 843w, https://www.artic.edu/iiif/2/0f1cc0e0-e42e-be16-3f71-2022da38cb93/full/1200,/0/default.jpg 1200w",
      "aspectRatio": 1.3327,
      "alt": "Loosely painted image of an open-air train station. On the right, a parked train gives off an enormous plumb of white smoke, making the scene look as though it were full of clouds. A huddled mass of barely discernible people crowd around the train on both sides of the tracks. Blue, green, and gray tones dominate."
    },
    "sourceUrl": "https://www.artic.edu/artworks/16571",
    "isPublicDomain": true
  },
  {
    "id": 87088,
    "title": "Water Lily Pond",
    "artist": "Claude Monet",
    "dateDisplay": "1900",
    "type": "Painting",
    "medium": "Oil on canvas",
    "dimensions": "89.8 × 101 cm (35 3/8 × 39 3/4 in.); Framed: 112.4 × 122.6 × 10.2 cm (44 1/4 × 48 1/4 × 4 in.)",
    "origin": "France",
    "creditLine": "Mr. and Mrs. Lewis Larned Coburn Memorial Collection",
    "image": {
      "src": "https://www.artic.edu/iiif/2/8534685d-1102-e1e3-e194-94f6e925e8b0/full/843,/0/default.jpg",
      "srcSet": "https://www.artic.edu/iiif/2/8534685d-1102-e1e3-e194-94f6e925e8b0/full/400,/0/default.jpg 400w, https://www.artic.edu/iiif/2/8534685d-1102-e1e3-e194-94f6e925e8b0/full/600,/0/default.jpg 600w, https://www.artic.edu/iiif/2/8534685d-1102-e1e3-e194-94f6e925e8b0/full/843,/0/default.jpg 843w, https://www.artic.edu/iiif/2/8534685d-1102-e1e3-e194-94f6e925e8b0/full/1200,/0/default.jpg 1200w",
      "aspectRatio": 1.1245,
      "alt": "Painting of a small pond dense with pink water lilies, their roots visible through the water, a railed footbridge arching over the pond and lush, dark green folliage surrounding it."
    },
    "sourceUrl": "https://www.artic.edu/artworks/87088",
    "isPublicDomain": true
  },
  {
    "id": 16487,
    "title": "The Bay of Marseille, Seen from L'Estaque",
    "artist": "Paul Cezanne",
    "dateDisplay": "c. 1885",
    "type": "Painting",
    "medium": "Oil on canvas",
    "dimensions": "80.2 × 100.6 cm (31 5/8 × 39 5/8 in.); Framed: 107.4 × 127.4 × 10.5 cm (42 1/4 × 50 1/8 × 4 1/8 in.)",
    "origin": "France",
    "creditLine": "Mr. and Mrs. Martin A. Ryerson Collection",
    "image": {
      "src": "https://www.artic.edu/iiif/2/d4ca6321-8656-3d3f-a362-2ee297b2b813/full/843,/0/default.jpg",
      "srcSet": "https://www.artic.edu/iiif/2/d4ca6321-8656-3d3f-a362-2ee297b2b813/full/400,/0/default.jpg 400w, https://www.artic.edu/iiif/2/d4ca6321-8656-3d3f-a362-2ee297b2b813/full/600,/0/default.jpg 600w, https://www.artic.edu/iiif/2/d4ca6321-8656-3d3f-a362-2ee297b2b813/full/843,/0/default.jpg 843w, https://www.artic.edu/iiif/2/d4ca6321-8656-3d3f-a362-2ee297b2b813/full/1200,/0/default.jpg 1200w",
      "aspectRatio": 1.2478,
      "alt": "Impressionist sea landscape, tan houses, blue ocean, distant mountains."
    },
    "sourceUrl": "https://www.artic.edu/artworks/16487",
    "isPublicDomain": true
  }
];
