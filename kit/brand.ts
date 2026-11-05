/**
 * Brand + content for every composition. Source of truth for copy, colours and fonts.
 *
 * Everything here was taken from https://lanesite.pro (Nov 2026). When the site changes,
 * re-read it and update this file; never invent stats, testimonials or features.
 * For another brand, replace this file (keep the shape) and the templates follow.
 */

export const brand = {
  name: "LaneSite",
  url: "lanesite.pro",
  tagline: "AI website builder for local shops",
  promise: ["Describe your shop.", "We build the website."],
  lede: "LaneSite writes every page, picks the photos, tests the site in a real browser and publishes it with HTTPS.",
  cta: "Build my site free",
  ctaShort: "Start free",
  trust: ["Free to start", "No credit card", "Live with HTTPS"],

  colors: {
    bg: "#0d0c09",
    surface: "#16140f",
    surface2: "#1e1c16",
    line: "rgba(243,239,230,.09)",
    line2: "rgba(243,239,230,.16)",
    fg: "#f3efe6",
    fg2: "#cfc9bb",
    muted: "#a39e92",
    accent: "#d4b27a", // brass
    accent2: "#b08d57",
    accentInk: "#1b150a",
    accentSoft: "rgba(212,178,122,.12)",
    accentGlow: "rgba(212,178,122,.5)",
    forest: "#123e32",
    live: "#5bd69a",
  },
  /** CSS variables set by the /video layout (next/font) */
  fonts: {
    display: "var(--vk-display), 'Bricolage Grotesque', system-ui, sans-serif",
    body: "var(--vk-body), 'Plus Jakarta Sans', system-ui, sans-serif",
    mono: "var(--vk-mono), 'JetBrains Mono', ui-monospace, monospace",
  },
  /** the logo mark from the site header (24x24 viewBox, stroke icon) */
  logoPaths: ["M7 20L10.5 4M17 20L13.5 4", "M12 17.5v2M12 11v2.5M12 5.5v2"],

  shopTypes: ["Bakery", "Salon", "Pharmacy", "Auto care", "Clinic", "Boutique", "Fitness", "Academy"],

  demo: {
    shop: "Maple Bakery",
    area: "Park Slope, Brooklyn",
    brief: "Maple Bakery in Park Slope, Brooklyn. Fresh bread and cakes, open 7am to 10pm. Customers can order online.",
    liveUrl: "maple-bakery.lanesite.pro",
    heroTitle: "Fresh bread and cakes, baked every morning.",
    heroBody: "Order online or pick up from the shop. Open 7am to 10pm.",
    products: [
      { name: "Fresh milk bread", price: "$5" },
      { name: "Chocolate fudge cake, 2 lb", price: "$48" },
      { name: "Chicken patties, box of 6", price: "$12" },
    ],
    buildSteps: [
      { title: "Reading your brief", detail: "Maple Bakery · Park Slope, Brooklyn" },
      { title: "Choosing layout and colors", detail: "Palette: warm crust" },
      { title: "Finding photos", detail: "bread, cakes, bakery counter" },
      { title: "Writing the pages", detail: "Home · Menu · Gallery · Contact" },
      { title: "Adding bookings and your dashboard", detail: "Order form · owner dashboard" },
      { title: "Testing in a real browser", detail: "5 pages · 1 form · 0 broken links" },
      { title: "Publishing with HTTPS", detail: "maple-bakery.lanesite.pro" },
    ],
    editRequest: "Change Friday hours to 9am to 6pm",
  },

  steps: [
    { title: "Describe your shop", body: "A few lines about your business is enough." },
    { title: "LaneSite builds and checks it", body: "Writes every page, picks photos, tests in a real browser." },
    { title: "Your site goes live", body: "Published at yourshop.lanesite.pro with HTTPS." },
  ],

  features: [
    { key: "booking", title: "Customers book on your site", body: "Bookings, enquiries and order requests land in your dashboard." },
    { key: "dashboard", title: "Your own dashboard", body: "See every request and confirm it in the morning." },
    { key: "chat", title: "Change it by chatting", body: "New hours or a new price: ask in plain words." },
    { key: "photos", title: "Use your own photos", body: "Upload photos of your shop, or LaneSite picks ones that fit." },
    { key: "tested", title: "Tested before it goes live", body: "A real browser opens every page, link and form." },
    { key: "domain", title: "Your own domain", body: "Connect a domain you own and HTTPS is set up automatically.", pro: true },
    { key: "code", title: "Download your code", body: "Download the full HTML and CSS of your site any time.", pro: true },
  ],

  pricing: {
    headline: "Start free. Upgrade when you grow.",
    note: "Prices in US dollars. Cancel Pro whenever you like.",
    plans: [
      {
        name: "Free",
        blurb: "For your first shop website.",
        price: 0,
        period: "forever",
        cta: "Start free",
        items: ["1 website", "Built for you by AI", "5 AI edits", "yourshop.lanesite.pro with HTTPS", "Bookings and owner dashboard"],
      },
      {
        name: "Pro",
        blurb: "For shops that are growing.",
        price: 5,
        period: "a month",
        badge: "7 days free",
        cta: "Start free trial",
        items: ["5 websites", "100 AI edits a month", "Your own domain with HTTPS", "Download your site's code", "Priority queue and support"],
      },
    ],
  },

  /** verbatim from the site's testimonial wall */
  testimonials: [
    { quote: "I typed three lines about my salon and had a site with a booking form before my next client walked in.", name: "Emma C.", shop: "Glow Studio", place: "Austin, TX" },
    { quote: "Cake orders now come from the website. My phone used to ring all day.", name: "James C.", shop: "Carter Bakers", place: "Columbus, OH" },
    { quote: "Patients request appointments at night and I confirm them from the dashboard in the morning.", name: "Dr. Olivia M.", shop: "City Care Clinic", place: "Denver, CO" },
    { quote: "I changed my Friday timings with one message and every page updated.", name: "Liam T.", shop: "Turner Motors", place: "Phoenix, AZ" },
    { quote: "I uploaded photos of our new collection and the site looks like our shop, not a template.", name: "Sophia R.", shop: "Sophia Boutique", place: "Nashville, TN" },
    { quote: "Connected my own .com domain on Pro. HTTPS was already working.", name: "Noah A.", shop: "QuickFix Mobiles", place: "Seattle, WA" },
    { quote: "Parents can see our timings and fees now. Setting it up took one evening.", name: "Charlotte N.", shop: "Little Scholars Academy", place: "Charlotte, NC" },
    { quote: "Five dollars a month costs less than one round of printed flyers.", name: "Jack H.", shop: "Harris Fitness", place: "Atlanta, GA" },
  ],

  faq: [
    { q: "Is it really free to start?", a: "Yes. The Free plan gives you 1 website, built for you by AI, and 5 AI edits. You don't need a credit card." },
    { q: "How long does a build take?", a: "A few minutes. You can watch each step while it runs, and you can leave the page and come back." },
    { q: "Can customers book or order?", a: "Yes. Every site has a customer area for bookings, enquiries and order requests. They arrive in your owner dashboard." },
    { q: "Can I use my own photos?", a: "Yes. Upload photos of your shop and a short video when you create the site, or add them later." },
    { q: "Can I use my own domain?", a: "Yes, on Pro. Connect a domain you own and HTTPS is set up automatically." },
    { q: "Do I own the code?", a: "Yes. On Pro you can download the full HTML and CSS of your site from your dashboard at any time." },
  ],

  /** from https://lanesite.pro/changelog */
  changelog: {
    date: "November 2026",
    items: [
      { tag: "New", title: "7-day Pro trial", body: "Try Pro free for a week, one trial per account." },
      { tag: "New", title: "Your own domain", body: "Connect a domain with HTTPS set up automatically." },
      { tag: "New", title: "Bring your own AI key", body: "Add keys from several AI providers and pick the order." },
      { tag: "Builder", title: "More reliable builds", body: "Menu and footer now match on every page of your site." },
    ],
  },
} as const;

export type Brand = typeof brand;
