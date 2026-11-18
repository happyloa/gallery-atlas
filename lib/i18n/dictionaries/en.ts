/**
 * English interface strings. Plain strings only (placeholders in {braces}), so the whole
 * dictionary can cross the server/client boundary. zh-tw.ts must match this shape.
 */
export const en = {
  meta: {
    homeTitle: "Gallery Atlas · Public-domain art",
    description:
      "Walk a room of public-domain paintings from the Art Institute of Chicago, then search and browse the collection.",
    searchTitle: "{query} in the collection",
    notFoundTitle: "Page not found",
  },
  site: {
    tagline: "Public-domain art",
    skipToContent: "Skip to content",
    primaryNav: "Primary",
    discover: "Discover",
    collection: "My Collection",
    about: "About",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    switchLanguage: "中文",
    switchLanguageLabel: "Switch to Traditional Chinese",
    opensInNewTab: " (opens in a new tab)",
  },
  footer: {
    disclaimer:
      "This is an independent project and is not affiliated with the Art Institute of Chicago.",
    courtesy:
      "Image and artwork data courtesy of the Art Institute of Chicago. Only works marked public domain are shown.",
    source: "Source",
    museum: "Art Institute of Chicago",
    apiDocs: "API documentation",
    imageLicensing: "Image licensing",
    terms: "Terms",
    licensing: "Licensing",
    metadataLicense: "Artwork metadata: CC0",
    descriptionLicense: "Artwork descriptions: CC BY 4.0",
    imageLicense: "Images: public-domain works only, under the museum’s terms",
    aboutLink: "About this project",
  },
  hero: {
    eyebrowLive: "Room I · Highlights",
    eyebrowSnapshot: "Room I · Saved snapshot",
    headline: "Art is worth lingering over.",
    lede: "Step into a room of public-domain paintings and prints from the Art Institute of Chicago, then browse the collection at your own pace.",
    cta: "Explore the collection",
    snapshotNote:
      "The museum’s collection couldn’t be reached, so this room shows works saved on {date}.",
    position: "Work {current} of {total}",
    previous: "Previous work",
    next: "Next work",
    viewArtwork: "View artwork",
  },
  explore: {
    eyebrow: "The collection",
    heading: "Explore the collection",
    searchLabel: "Search artworks",
    searchPlaceholder: "Search by artist, title or subject",
    filterLabel: "Filter by type",
    allTypes: "All",
    clearFilters: "Clear filters",
    searching: "Searching…",
    loading: "Loading artworks…",
    summaryAll: "{count} works",
    summaryType: "{count} {type} works",
    summaryQuery: "{count} works matching “{q}”",
    summaryTypeQuery: "{count} {type} works matching “{q}”",
    showing: " · showing {from}–{to}",
    limited: "Search reaches the first {count} results.",
    emptyQueryTitle: "Nothing in the collection matches “{q}”.",
    emptyTitle: "No works to show here.",
    emptyHint:
      "Try a different spelling, an artist’s surname, or a broader type.",
    pastEndEyebrow: "Past the end",
    pageOutOfRangeTitle: "Search stops at page {max}.",
    pageOutOfRangeBody:
      "Search can show the first {count} results ({max} pages). Try a narrower search.",
    invalidPageEyebrow: "That page doesn’t exist",
    invalidPageTitle: "That page number isn’t valid.",
    invalidPageBody: "Page must be a whole number from 1.",
    pastEndTitleOne: "This search has 1 page.",
    pastEndTitleOther: "This search has {count} pages.",
    backToFirstPage: "Back to page 1",
    paginationLabel: "Pagination",
    previousPage: "Previous",
    nextPage: "Next",
    pageOf: "Page {page} of {total}",
    errorEyebrow: "Couldn’t reach the collection",
    errorTitle: "The museum’s collection didn’t answer just now.",
    errorRateLimited: "Too many requests reached the museum at once.",
    errorTimeout: "The request took too long.",
    errorGeneric: "The request failed.",
    errorRest: "The rest of the site still works.",
    tryAgain: "Try again",
    tryingAgain: "Trying again…",
  },
  types: {
    painting: "Painting",
    print: "Print",
    drawing: "Drawing",
    photograph: "Photograph",
    sculpture: "Sculpture",
    textile: "Textile",
    ceramics: "Ceramics",
  },
  artwork: {
    imageUnavailable: "Image unavailable",
    imageUnavailableLabel: "{alt} (image unavailable)",
  },
  errors: {
    eyebrow: "Something went wrong",
    title: "This room didn’t open as expected.",
    body: "The page hit an unexpected error. Trying again usually helps; if it keeps happening, come back a little later.",
    tryAgain: "Try again",
    backToDiscover: "Back to Discover",
    notFoundTitle: "There’s nothing hanging here.",
    notFoundBody: "The page may have moved, or the address has a typo.",
  },
  collection: {
    title: "My Collection",
    description:
      "Your saved artworks and personal exhibitions, kept in this browser.",
    emptyTitle: "Your walls are still bare.",
    emptyBody:
      "Favorites and personal exhibitions will live here. They’re saved in this browser only, so they won’t follow you to another device.",
    explore: "Explore the collection",
  },
  about: {
    title: "About",
    description:
      "Why Gallery Atlas exists, how it is built, and how artwork data and images from the Art Institute of Chicago are used.",
  },
};

export type Dictionary = typeof en;
